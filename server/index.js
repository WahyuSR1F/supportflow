import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createClient } from '@libsql/client';
import { HANDOFF_ACKNOWLEDGEMENT, OUT_OF_SCOPE_HANDOFF, HANDOFF_MARKER, isEscalationRequest, answerFromKnowledgeBase } from './knowledge-base.js';
import { registerWithEmailAndPassword, loginWithEmailAndPassword, googleConfigured, googleAuthUrl, exchangeGoogleCode, signSessionJwt } from './auth.js';
import { registerAgentsPersistence, getAgentChainSnapshot, getAutoFallback, listAgents, saveAgents, agentsSummary, callAgentWithRouter, EXHAUSTED_COOLDOWN_MS, } from './agents.js';
const SESSION_COOKIE = 'webdev_app_session';
const NONCE_COOKIE = 'supportflow_oauth_nonce';
const WIDGET_CONVERSATION_ID = 'northstar-widget-demo';
let databaseClient = null;
let databaseSchema = null;
const json = (response, payload, status = 200) => {
    response.statusCode = status;
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.setHeader('cache-control', 'no-store');
    response.end(JSON.stringify(payload));
};
const setCookies = (response, cookies) => response.setHeader('set-cookie', cookies);
const cookie = (name, value, options) => `${name}=${value}; ${options}`;
const clearCookie = (name) => cookie(name, '', 'Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
const parseCookies = (request) => Object.fromEntries((request.headers.cookie ?? '').split(';').map((part) => part.trim().split('=')).filter(([name, value]) => name && value).map(([name, ...value]) => [name, value.join('=')]));
const encodeBase64Url = (value) => Buffer.from(value).toString('base64url');
const decodeBase64Url = (value) => Buffer.from(value, 'base64url').toString('utf8');
const getDatabase = () => {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url || !authToken)
        throw new Error('Turso database is not configured');
    if (!databaseClient)
        databaseClient = createClient({ url, authToken });
    return databaseClient;
};
const ensureDatabase = async () => {
    if (!databaseSchema) {
        const db = getDatabase();
        databaseSchema = (async () => {
            await db.execute(`CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`);
            await db.execute(`CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('user', 'assistant')), content TEXT NOT NULL, created_at TEXT NOT NULL)`);
            await db.execute(`CREATE TABLE IF NOT EXISTS conversation_status (conversation_id TEXT PRIMARY KEY, status TEXT NOT NULL, reason TEXT, updated_at TEXT NOT NULL)`);
            await db.execute(`CREATE TABLE IF NOT EXISTS ai_agents (id TEXT PRIMARY KEY, name TEXT NOT NULL, model TEXT NOT NULL, api_url TEXT NOT NULL, api_key TEXT NOT NULL, enabled INTEGER NOT NULL, priority INTEGER NOT NULL, updated_at TEXT NOT NULL)`);
            await db.execute(`CREATE TABLE IF NOT EXISTS ai_agent_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)`);
            await db.execute(`CREATE TABLE IF NOT EXISTS team_members (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, role TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', last_active TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`);
            await db.execute(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)`);
            await db.execute(`CREATE TABLE IF NOT EXISTS knowledge_documents (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, size TEXT NOT NULL, status TEXT NOT NULL, chunks INTEGER NOT NULL DEFAULT 0, content TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL, created_at TEXT NOT NULL)`);
            await db.execute(`CREATE TABLE IF NOT EXISTS agent_usage_daily (agent_id TEXT NOT NULL, date TEXT NOT NULL, model TEXT NOT NULL DEFAULT '', prompt_tokens INTEGER NOT NULL DEFAULT 0, completion_tokens INTEGER NOT NULL DEFAULT 0, requests INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, PRIMARY KEY (agent_id, date))`);
            await db.execute(`CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages (conversation_id, created_at)`);
            await db.execute(`CREATE INDEX IF NOT EXISTS conversations_updated_idx ON conversations (updated_at)`);
            await db.execute(`CREATE INDEX IF NOT EXISTS conversation_status_status_idx ON conversation_status (status)`);
            await db.execute(`CREATE INDEX IF NOT EXISTS agent_usage_daily_date_idx ON agent_usage_daily (date)`);
            // Migrasi kolom denormalisasi: preview inbox cukup 1 query (tanpa join N+1) → terasa cepat seperti WA.
            for (const [column, ddl] of [['last_message', 'TEXT'], ['last_message_role', 'TEXT'], ['last_message_at', 'TEXT']]) {
                try {
                    await db.execute(`ALTER TABLE conversations ADD COLUMN ${column} ${ddl}`);
                }
                catch { /* kolom sudah ada */ }
            }
        })().catch((error) => {
            databaseSchema = null;
            throw error;
        });
    }
    await databaseSchema;
    return getDatabase();
};
// Persistensi konfigurasi AI agent (best-effort — database opsional).
registerAgentsPersistence({
    load: async () => {
        const db = await ensureDatabase();
        const rows = await db.execute('SELECT id, name, model, api_url, api_key, enabled FROM ai_agents ORDER BY priority ASC');
        if (!rows.rows.length)
            return null;
        const setting = await db.execute({ sql: "SELECT value FROM ai_agent_settings WHERE key = 'auto_fallback'" });
        const agents = rows.rows.map((row) => ({
            id: String(row.id),
            name: String(row.name),
            model: String(row.model),
            apiUrl: String(row.api_url),
            apiKey: String(row.api_key),
            enabled: Number(row.enabled) === 1,
        }));
        return { agents, autoFallback: setting.rows[0] ? String(setting.rows[0].value) !== 'false' : true };
    },
    save: async (agents, autoFallback) => {
        const db = await ensureDatabase();
        const now = new Date().toISOString();
        await db.execute('DELETE FROM ai_agents');
        for (const [index, agent] of agents.entries()) {
            await db.execute({ sql: 'INSERT INTO ai_agents (id, name, model, api_url, api_key, enabled, priority, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', args: [agent.id, agent.name, agent.model, agent.apiUrl, agent.apiKey, agent.enabled ? 1 : 0, index, now] });
        }
        await db.execute({ sql: `INSERT INTO ai_agent_settings (key, value, updated_at) VALUES ('auto_fallback', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`, args: [autoFallback ? 'true' : 'false', now] });
    },
    // Token usage per agent per hari → dasbor Analytics (fire-and-call dari router).
    recordUsage: async (agentId, model, usage) => {
        const db = await ensureDatabase();
        const now = new Date().toISOString();
        await db.execute({
            sql: `INSERT INTO agent_usage_daily (agent_id, date, model, prompt_tokens, completion_tokens, requests, updated_at)
            VALUES (?, ?, ?, ?, ?, 1, ?)
            ON CONFLICT(agent_id, date) DO UPDATE SET
              model = excluded.model,
              prompt_tokens = prompt_tokens + excluded.prompt_tokens,
              completion_tokens = completion_tokens + excluded.completion_tokens,
              requests = requests + 1,
              updated_at = excluded.updated_at`,
            args: [agentId, now.slice(0, 10), model, usage.promptTokens, usage.completionTokens, now],
        });
    },
});
const databaseReady = async () => {
    try {
        const db = await ensureDatabase();
        await db.execute({ sql: 'SELECT 1' });
        return true;
    }
    catch {
        return false;
    }
};
const persistMessage = async (conversationId, message) => {
    const db = await ensureDatabase();
    const now = new Date().toISOString();
    await db.execute({ sql: 'INSERT OR IGNORE INTO conversations (id, workspace_id, created_at, updated_at) VALUES (?, ?, ?, ?)', args: [conversationId, 'northstar-goods', now, now] });
    await db.execute({ sql: 'INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)', args: [`${conversationId}:${Date.now()}:${randomBytes(5).toString('hex')}`, conversationId, message.role, message.content, now] });
    // Preview denormalisasi → list inbox cukup SELECT conversations saja (satu baris, cepat).
    await db.execute({ sql: 'UPDATE conversations SET updated_at = ?, last_message = ?, last_message_role = ?, last_message_at = ? WHERE id = ?', args: [now, message.content.slice(0, 400), message.role, now, conversationId] });
};
const loadHistory = async (conversationId, limit = 200) => {
    const db = await ensureDatabase();
    const safeLimit = Math.min(Math.max(Number(limit) || 80, 1), 500);
    const result = await db.execute({ sql: 'SELECT role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC, id ASC LIMIT ?', args: [conversationId, safeLimit] });
    return result.rows.map((row) => ({ role: String(row.role), content: String(row.content), createdAt: String(row.created_at) }));
};
const setConversationStatus = async (conversationId, status, reason = '') => {
    const db = await ensureDatabase();
    const now = new Date().toISOString();
    await db.execute({ sql: `INSERT INTO conversation_status (conversation_id, status, reason, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(conversation_id) DO UPDATE SET status = excluded.status, reason = excluded.reason, updated_at = excluded.updated_at`, args: [conversationId, status, reason, now] });
};
const getConversationStatus = async (conversationId) => {
    const db = await ensureDatabase();
    const result = await db.execute({ sql: 'SELECT status, reason FROM conversation_status WHERE conversation_id = ?', args: [conversationId] });
    const row = result.rows[0];
    if (!row)
        return null;
    return { status: String(row.status), reason: String(row.reason ?? '') };
};
// Knowledge base: dokumen workspace disimpan di database (seed sekali saat kosong).
const KNOWLEDGE_SEED = [
    { name: 'Shipping & delivery policy.pdf', type: 'PDF', size: '1.2 MB', status: 'Indexed', chunks: 148 },
    { name: 'Returns and exchanges.md', type: 'MD', size: '84 KB', status: 'Indexed', chunks: 62 },
    { name: 'Product care guide.txt', type: 'TXT', size: '42 KB', status: 'Indexed', chunks: 31 },
    { name: 'International shipping rates.pdf', type: 'PDF', size: '760 KB', status: 'Processing', chunks: 0 },
];
const knowledgeChunksFrom = (content, fallback) => {
    const trimmed = content.trim();
    if (!trimmed)
        return fallback;
    return Math.max(1, Math.ceil(trimmed.length / 400));
};
const ensureKnowledgeSeed = async (db) => {
    const count = await db.execute('SELECT COUNT(*) AS total FROM knowledge_documents');
    if (Number(count.rows[0]?.total ?? 0) > 0)
        return;
    const now = Date.now();
    for (const [index, seed] of KNOWLEDGE_SEED.entries()) {
        const updatedAt = new Date(now - (index + 1) * 3600000).toISOString();
        await db.execute({ sql: 'INSERT INTO knowledge_documents (id, name, type, size, status, chunks, content, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', args: [`kb-${index + 1}`, seed.name, seed.type, seed.size, seed.status, seed.chunks, '', updatedAt, updatedAt] });
    }
};
const whatsappConfigured = () => Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_VERIFY_TOKEN);
const verifyMetaSignature = (rawBody, signature) => {
    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret)
        return process.env.NODE_ENV !== 'production';
    if (!signature?.startsWith('sha256='))
        return false;
    const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
    const received = signature.slice('sha256='.length);
    return received.length === expected.length && timingSafeEqual(Buffer.from(received), Buffer.from(expected));
};
const sendWhatsAppText = async (to, body) => {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const version = process.env.WHATSAPP_GRAPH_VERSION ?? 'v26.0';
    if (!phoneNumberId || !accessToken)
        throw new Error('WhatsApp outbound messaging is not configured');
    const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { preview_url: false, body } }),
    });
    const payload = await response.json();
    if (!response.ok || payload.error)
        throw new Error(payload.error?.message ?? `WhatsApp send failed (${response.status})`);
    return payload.messages?.[0]?.id ?? null;
};
const handleWhatsAppWebhook = async (rawBody) => {
    const payload = JSON.parse(rawBody);
    let received = 0;
    let replied = 0;
    for (const entry of payload.entry ?? []) {
        for (const change of entry.changes ?? []) {
            for (const incoming of change.value?.messages ?? []) {
                if (incoming.type !== 'text' || !incoming.from || !incoming.text?.body)
                    continue;
                received += 1;
                const conversationId = `whatsapp:${incoming.from}`;
                await persistMessage(conversationId, { role: 'user', content: incoming.text.body });
                if (process.env.WHATSAPP_AUTO_REPLY === 'true' && whatsappConfigured()) {
                    const history = await loadHistory(conversationId);
                    const reply = await callLiveLlm(history.slice(-12));
                    await sendWhatsAppText(incoming.from, reply);
                    await persistMessage(conversationId, { role: 'assistant', content: reply });
                    replied += 1;
                }
            }
        }
    }
    return { received, replied };
};
const signJwt = (identity) => {
    const secret = process.env.MANUS_JWT_SECRET;
    const appId = process.env.MANUS_PROJECT_ID;
    if (!secret || !appId)
        throw new Error('Authentication runtime is not configured');
    const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = encodeBase64Url(JSON.stringify({ appId, openId: identity.openId, name: identity.name, email: identity.email, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 }));
    const unsigned = `${header}.${payload}`;
    return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
};
const verifyJwt = (token) => {
    try {
        const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
        if (!encodedHeader || !encodedPayload || !encodedSignature || !process.env.MANUS_JWT_SECRET)
            return null;
        const header = JSON.parse(decodeBase64Url(encodedHeader));
        const payload = JSON.parse(decodeBase64Url(encodedPayload));
        const expected = createHmac('sha256', process.env.MANUS_JWT_SECRET).update(`${encodedHeader}.${encodedPayload}`).digest();
        const received = Buffer.from(encodedSignature, 'base64url');
        if (header.alg !== 'HS256' || received.length !== expected.length || !timingSafeEqual(received, expected))
            return null;
        if (payload.appId !== (process.env.MANUS_PROJECT_ID ?? 'supportflow') || !payload.openId || !payload.exp || payload.exp < Math.floor(Date.now() / 1000))
            return null;
        return { openId: payload.openId, name: payload.name, email: payload.email };
    }
    catch {
        return null;
    }
};
const readRawBody = async (request) => {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > 64000)
            throw new Error('Request body is too large');
        chunks.push(buffer);
    }
    return Buffer.concat(chunks).toString('utf8');
};
const readBody = async (request) => readRawBody(request);
// Panggilan LLM dengan router fallback: agent utama → agent cadangan berikutnya.
const callLiveLlm = async (messages) => (await callAgentWithRouter(messages)).content;
const exchangeOAuthCode = async (code, redirectUri) => {
    const apiUrl = process.env.MANUS_OAUTH_API_URL;
    const clientId = process.env.MANUS_PROJECT_ID;
    if (!apiUrl || !clientId)
        throw new Error('OAuth runtime is not configured');
    const exchangeResponse = await fetch(`${apiUrl}/webdev.v1.WebDevAuthPublicService/ExchangeToken`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clientId, grantType: 'authorization_code', code, redirectUri }) });
    const exchange = await exchangeResponse.json();
    if (!exchangeResponse.ok || !exchange.accessToken)
        throw new Error(exchange.error?.message ?? 'OAuth token exchange failed');
    const userResponse = await fetch(`${apiUrl}/webdev.v1.WebDevAuthPublicService/GetUserInfo`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ accessToken: exchange.accessToken }) });
    const user = await userResponse.json();
    if (!userResponse.ok || !user.openId)
        throw new Error(user.error?.message ?? 'OAuth identity lookup failed');
    return { openId: user.openId, name: user.name, email: user.email };
};
const authStart = (response, redirectUri) => {
    const portal = process.env.MANUS_OAUTH_PORTAL_URL;
    const appId = process.env.MANUS_PROJECT_ID;
    if (!portal || !appId)
        return json(response, { error: 'OAuth runtime is not configured' }, 500);
    const parsed = new URL(redirectUri);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.pathname.endsWith('/manus-oauth/callback'))
        return json(response, { error: 'Invalid OAuth redirect URI' }, 400);
    const nonce = randomBytes(24).toString('base64url');
    const state = encodeBase64Url(JSON.stringify({ redirectUri, nonce }));
    const authUrl = new URL('/app-auth', portal);
    authUrl.searchParams.set('appId', appId);
    authUrl.searchParams.set('redirectUri', redirectUri);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('responseType', 'code');
    setCookies(response, [cookie(NONCE_COOKIE, nonce, 'Path=/; Max-Age=600; HttpOnly; SameSite=None; Secure')]);
    response.statusCode = 302;
    response.setHeader('location', authUrl.toString());
    response.end();
};
// Endpoint publik yang boleh dipanggil lintas origin oleh supportflow-widget.
const WIDGET_PUBLIC_PATHS = new Set(['/api/health', '/api/conversations', '/api/chat/public', '/api/chat/public/history']);
export async function handleSupportFlowApi(request, response) {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const method = request.method ?? 'GET';
    const cookies = parseCookies(request);
    if (WIDGET_PUBLIC_PATHS.has(url.pathname)) {
        const configured = (process.env.WIDGET_ALLOWED_ORIGINS ?? '*').split(',').map((value) => value.trim()).filter(Boolean);
        const allowAll = configured.includes('*');
        const origin = request.headers.origin;
        if (origin && (allowAll || configured.includes(origin))) {
            response.setHeader('access-control-allow-origin', allowAll ? '*' : origin);
            response.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
            response.setHeader('access-control-allow-headers', 'content-type');
            response.setHeader('access-control-max-age', '600');
            response.setHeader('vary', 'origin');
        }
        if (method === 'OPTIONS') {
            response.statusCode = 204;
            response.end();
            return;
        }
    }
    if (method === 'GET' && url.pathname === '/api/health')
        return json(response, { ok: true, service: 'supportflow-web', status: 'operational', llm: Boolean(process.env.MANUS_API_URL && process.env.MANUS_API_KEY), agents: agentsSummary().enabled, auth: Boolean(process.env.MANUS_OAUTH_API_URL && process.env.MANUS_JWT_SECRET), database: await databaseReady(), whatsapp: whatsappConfigured() });
    if (method === 'GET' && url.pathname === '/api/auth/session') {
        const identity = cookies[SESSION_COOKIE] ? verifyJwt(cookies[SESSION_COOKIE]) : null;
        if (!identity)
            return json(response, { authenticated: false }, 401);
        return json(response, { authenticated: true, user: identity });
    }
    if (method === 'GET' && url.pathname === '/api/auth/providers') {
        return json(response, { email: true, google: googleConfigured(), manus: Boolean(process.env.MANUS_OAUTH_API_URL && process.env.MANUS_JWT_SECRET) });
    }
    if (method === 'POST' && url.pathname === '/api/auth/register') {
        try {
            const body = JSON.parse(await readBody(request));
            if (!body.email || !body.password)
                return json(response, { error: 'Email dan password wajib diisi' }, 400);
            const identity = await registerWithEmailAndPassword({ name: body.name ?? '', email: body.email, password: body.password });
            setCookies(response, [cookie(SESSION_COOKIE, signSessionJwt(identity), 'Path=/; Max-Age=604800; HttpOnly; SameSite=None; Secure')]);
            return json(response, { authenticated: true, user: identity });
        }
        catch (error) {
            return json(response, { error: error instanceof Error ? error.message : 'Registrasi gagal' }, 400);
        }
    }
    if (method === 'POST' && url.pathname === '/api/auth/login') {
        try {
            const body = JSON.parse(await readBody(request));
            if (!body.email || !body.password)
                return json(response, { error: 'Email dan password wajib diisi' }, 400);
            const identity = await loginWithEmailAndPassword({ email: body.email, password: body.password });
            setCookies(response, [cookie(SESSION_COOKIE, signSessionJwt(identity), 'Path=/; Max-Age=604800; HttpOnly; SameSite=None; Secure')]);
            return json(response, { authenticated: true, user: identity });
        }
        catch (error) {
            return json(response, { error: error instanceof Error ? error.message : 'Login gagal' }, 400);
        }
    }
    if (method === 'GET' && url.pathname === '/api/auth/google/start') {
        if (!googleConfigured())
            return json(response, { error: 'Login Google belum dikonfigurasi' }, 503);
        try {
            const redirectUri = url.searchParams.get('redirectUri') ?? `${url.protocol}//${url.host}/api/auth/google/callback`;
            const nonce = randomBytes(24).toString('base64url');
            setCookies(response, [cookie('google_oauth_nonce', nonce, 'Path=/; Max-Age=600; HttpOnly; SameSite=None; Secure')]);
            const state = encodeBase64Url(JSON.stringify({ nonce, redirectUri }));
            response.statusCode = 302;
            response.setHeader('location', googleAuthUrl(redirectUri, state));
            return response.end();
        }
        catch {
            return json(response, { error: 'Gagal memulai login Google' }, 400);
        }
    }
    if (method === 'GET' && url.pathname === '/api/auth/google/callback') {
        const code = url.searchParams.get('code') ?? '';
        const stateValue = url.searchParams.get('state') ?? '';
        try {
            const state = JSON.parse(decodeBase64Url(stateValue));
            if (!code || !state.nonce || state.nonce !== cookies['google_oauth_nonce'])
                throw new Error('State Google tidak valid');
            const redirectUri = state.redirectUri ?? `${url.protocol}//${url.host}/api/auth/google/callback`;
            const identity = await exchangeGoogleCode(code, redirectUri);
            setCookies(response, [cookie(SESSION_COOKIE, signSessionJwt(identity), 'Path=/; Max-Age=604800; HttpOnly; SameSite=None; Secure'), clearCookie('google_oauth_nonce')]);
            response.statusCode = 302;
            response.setHeader('location', '/app');
            return response.end();
        }
        catch (error) {
            return json(response, { error: error instanceof Error ? error.message : 'Login Google gagal' }, 401);
        }
    }
    if (method === 'GET' && url.pathname === '/api/auth/start') {
        try {
            return authStart(response, url.searchParams.get('redirectUri') ?? '');
        }
        catch {
            return json(response, { error: 'Invalid OAuth redirect URI' }, 400);
        }
    }
    if (method === 'GET' && url.pathname === '/manus-oauth/callback') {
        const stateValue = url.searchParams.get('state') ?? '';
        const code = url.searchParams.get('code') ?? '';
        try {
            const state = JSON.parse(decodeBase64Url(stateValue));
            if (!code || !state.redirectUri || !state.nonce || state.nonce !== cookies[NONCE_COOKIE])
                throw new Error('OAuth state validation failed');
            const identity = await exchangeOAuthCode(code, state.redirectUri);
            setCookies(response, [cookie(SESSION_COOKIE, signJwt(identity), 'Path=/; Max-Age=604800; HttpOnly; SameSite=None; Secure'), clearCookie(NONCE_COOKIE)]);
            response.statusCode = 302;
            response.setHeader('location', '/app');
            return response.end();
        }
        catch (error) {
            return json(response, { error: error instanceof Error ? error.message : 'OAuth callback failed' }, 401);
        }
    }
    if (method === 'GET' && url.pathname === '/manus-oauth/logout') {
        setCookies(response, [clearCookie(SESSION_COOKIE), clearCookie(NONCE_COOKIE)]);
        response.statusCode = 302;
        response.setHeader('location', '/');
        return response.end();
    }
    // --- AI agent router (settings) -----------------------------------------
    if (method === 'GET' && url.pathname === '/api/agents') {
        const identity = cookies[SESSION_COOKIE] ? verifyJwt(cookies[SESSION_COOKIE]) : null;
        if (!identity)
            return json(response, { error: 'Authentication required' }, 401);
        return json(response, { agents: await listAgents(), autoFallback: getAutoFallback(), cooldownMinutes: Math.round(EXHAUSTED_COOLDOWN_MS / 60000) });
    }
    if (method === 'POST' && url.pathname === '/api/agents') {
        const identity = cookies[SESSION_COOKIE] ? verifyJwt(cookies[SESSION_COOKIE]) : null;
        if (!identity)
            return json(response, { error: 'Authentication required' }, 401);
        try {
            const body = JSON.parse(await readBody(request));
            if (!Array.isArray(body.agents))
                return json(response, { error: 'agents must be an array' }, 400);
            // API key bersifat write-only: kosong = pertahankan key tersimpan.
            const existingKeys = new Map(getAgentChainSnapshot().agents.map((agent) => [agent.id, agent.apiKey]));
            const sanitized = [];
            for (const [index, raw] of body.agents.slice(0, 10).entries()) {
                if (!raw || typeof raw !== 'object')
                    continue;
                const entry = raw;
                const name = typeof entry.name === 'string' ? entry.name.trim() : '';
                if (!name)
                    throw new Error(`Agent ${index + 1} needs a name`);
                const id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim().slice(0, 80) : `agent-${index + 1}`;
                const providedKey = typeof entry.apiKey === 'string' ? entry.apiKey.trim() : '';
                sanitized.push({
                    id,
                    name: name.slice(0, 60),
                    model: typeof entry.model === 'string' ? entry.model.trim().slice(0, 80) : '',
                    apiUrl: typeof entry.apiUrl === 'string' ? entry.apiUrl.trim().slice(0, 300) : '',
                    apiKey: providedKey || existingKeys.get(id) || '',
                    enabled: entry.enabled !== false,
                });
            }
            if (!sanitized.length)
                return json(response, { error: 'At least one agent is required' }, 400);
            const persistenceMode = await saveAgents(sanitized, body.autoFallback !== false);
            return json(response, { ok: true, persistence: persistenceMode, agents: await listAgents(), autoFallback: getAutoFallback() });
        }
        catch (error) {
            return json(response, { error: error instanceof Error ? error.message : 'Invalid agent settings' }, 400);
        }
    }
    if (method === 'GET' && url.pathname === '/api/conversations') {
        try {
            const db = await ensureDatabase();
            const statusRows = await db.execute('SELECT conversation_id, status, reason, updated_at FROM conversation_status');
            const statusMap = new Map(statusRows.rows.map((row) => [String(row.conversation_id), { status: String(row.status), reason: String(row.reason ?? ''), updatedAt: String(row.updated_at) }]));
            const conversationRows = await db.execute('SELECT id, workspace_id, created_at, updated_at, last_message, last_message_role FROM conversations ORDER BY updated_at DESC LIMIT 100');
            const data = conversationRows.rows.map((row) => {
                const conversationId = String(row.id);
                const tracked = statusMap.get(conversationId);
                return {
                    id: conversationId,
                    workspaceId: String(row.workspace_id),
                    createdAt: String(row.created_at),
                    updatedAt: String(row.updated_at),
                    status: tracked?.status ?? 'AI',
                    handoffReason: tracked?.reason ?? '',
                    preview: row.last_message ? String(row.last_message) : '',
                    lastMessageRole: row.last_message_role ? String(row.last_message_role) : '',
                };
            });
            return json(response, { data, meta: { tenant: 'northstar-goods', status: 'AI | HUMAN_HANDOFF | RESOLVED' } });
        }
        catch {
            return json(response, { data: [], meta: { tenant: 'northstar-goods', status: 'AI | HUMAN_HANDOFF | RESOLVED' } });
        }
    }
    if (method === 'GET' && url.pathname === '/api/overview') {
        try {
            const db = await ensureDatabase();
            const conversationRows = await db.execute('SELECT id, created_at, updated_at FROM conversations ORDER BY updated_at DESC LIMIT 500');
            const statusRows = await db.execute('SELECT conversation_id, status, updated_at FROM conversation_status');
            const messageRows = await db.execute('SELECT conversation_id, role, content, created_at FROM messages ORDER BY created_at ASC LIMIT 4000');
            const statusMap = new Map(statusRows.rows.map((row) => [String(row.conversation_id), { status: String(row.status), updatedAt: String(row.updated_at) }]));
            const messagesByConversation = new Map();
            for (const row of messageRows.rows) {
                const conversationId = String(row.conversation_id);
                const list = messagesByConversation.get(conversationId) ?? [];
                list.push({ role: String(row.role), content: String(row.content), createdAt: String(row.created_at) });
                messagesByConversation.set(conversationId, list);
            }
            const nowMs = Date.now();
            const DAY_MS = 86400000;
            const dayKey = (value) => new Date(value).toISOString().slice(0, 10);
            const inWindow = (value, daysBack) => {
                const timestamp = new Date(value).getTime();
                const threshold = nowMs - daysBack * DAY_MS;
                return timestamp >= threshold;
            };
            // Derive channel from conversation id prefix (no channel column exists).
            const channelOf = (conversationId) => conversationId.startsWith('whatsapp:') ? 'WhatsApp' : conversationId.startsWith('instagram:') ? 'Instagram' : 'Web chat';
            const nameOf = (conversationId) => {
                if (conversationId.startsWith('whatsapp:') || conversationId.startsWith('instagram:'))
                    return `${conversationId.split(':')[1] ?? conversationId}`;
                return 'Web visitor';
            };
            const statusCounts = { AI: 0, HUMAN_HANDOFF: 0, RESOLVED: 0 };
            const channels = { WhatsApp: 0, Instagram: 0, 'Web chat': 0 };
            const createdDaily = new Map();
            for (const row of conversationRows.rows) {
                const conversationId = String(row.id);
                const status = statusMap.get(conversationId)?.status ?? 'AI';
                statusCounts[status] = (statusCounts[status] ?? 0) + 1;
                channels[channelOf(conversationId)] += 1;
                const key = dayKey(String(row.created_at));
                createdDaily.set(key, (createdDaily.get(key) ?? 0) + 1);
            }
            const resolvedDaily = new Map();
            for (const [, value] of statusMap) {
                if (value.status !== 'RESOLVED')
                    continue;
                const key = dayKey(value.updatedAt);
                resolvedDaily.set(key, (resolvedDaily.get(key) ?? 0) + 1);
            }
            const series = [];
            for (let offset = 6; offset >= 0; offset -= 1) {
                const date = new Date(nowMs - offset * DAY_MS);
                const key = dayKey(date);
                series.push({ date: key, label: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()], incoming: createdDaily.get(key) ?? 0, resolved: resolvedDaily.get(key) ?? 0 });
            }
            // Unread = percakapan yang pesan terakhirnya dari pengguna (belum ada balasan).
            const unread = [];
            let responseTimesMs = 0;
            let responseTimesCount = 0;
            for (const row of conversationRows.rows) {
                const conversationId = String(row.id);
                const messages = messagesByConversation.get(conversationId) ?? [];
                const last = messages[messages.length - 1];
                if (last?.role === 'user') {
                    let trailing = 0;
                    for (let index = messages.length - 1; index >= 0 && messages[index].role === 'user'; index -= 1)
                        trailing += 1;
                    const statusKey = statusMap.get(conversationId)?.status ?? 'AI';
                    unread.push({
                        id: conversationId,
                        name: nameOf(conversationId),
                        channel: channelOf(conversationId),
                        preview: last.content.slice(0, 160),
                        time: String(row.updated_at),
                        unread: trailing,
                        status: statusKey === 'HUMAN_HANDOFF' ? 'Needs handoff' : statusKey === 'RESOLVED' ? 'Resolved' : 'AI active',
                    });
                }
                for (let index = 1; index < messages.length; index += 1) {
                    const previous = messages[index - 1];
                    const current = messages[index];
                    if (previous.role === 'user' && current.role === 'assistant') {
                        const gap = new Date(current.createdAt).getTime() - new Date(previous.createdAt).getTime();
                        if (gap >= 0 && gap <= 10 * 60000) {
                            responseTimesMs += gap;
                            responseTimesCount += 1;
                        }
                    }
                }
            }
            unread.sort((a, b) => (a.time < b.time ? 1 : -1));
            const seriesIncoming = series.reduce((sum, day) => sum + day.incoming, 0);
            const prevIncoming = [...createdDaily.entries()].reduce((sum, [key, count]) => {
                const age = (nowMs - new Date(`${key}T23:59:59.999Z`).getTime()) / DAY_MS;
                return age > 7 && age <= 14 ? sum + count : sum;
            }, 0);
            const trendPercent = prevIncoming > 0 ? Math.round(((seriesIncoming - prevIncoming) / prevIncoming) * 100) : null;
            return json(response, {
                meta: { source: 'turso', generatedAt: new Date().toISOString() },
                total: conversationRows.rows.length,
                statusCounts,
                unanswered: unread.length,
                avgResponseSeconds: responseTimesCount > 0 ? Math.round(responseTimesMs / responseTimesCount / 1000) : null,
                aiResolvedPercent: conversationRows.rows.length > 0 ? Math.round((statusCounts.RESOLVED / conversationRows.rows.length) * 1000) / 10 : 0,
                trendPercent,
                series,
                channels,
                unread: unread.slice(0, 50),
            });
        }
        catch (error) {
            return json(response, { error: 'Overview unavailable', detail: error instanceof Error ? error.message : 'Database error' }, 503);
        }
    }
    if (method === 'GET' && url.pathname === '/api/knowledge/documents') {
        try {
            const db = await ensureDatabase();
            await ensureKnowledgeSeed(db);
            const rows = await db.execute('SELECT id, name, type, size, status, chunks, updated_at FROM knowledge_documents ORDER BY updated_at DESC');
            const documents = rows.rows.map((row) => ({ id: String(row.id), name: String(row.name), type: String(row.type), size: String(row.size), status: String(row.status), chunks: Number(row.chunks ?? 0), updatedAt: String(row.updated_at) }));
            const stats = {
                total: documents.length,
                indexed: documents.filter((document) => document.status === 'Indexed').length,
                chunks: documents.reduce((sum, document) => sum + document.chunks, 0),
                lastSync: documents.reduce((latest, document) => (!latest || document.updatedAt > latest ? document.updatedAt : latest), null),
            };
            return json(response, { documents, stats });
        }
        catch (error) {
            return json(response, { error: error instanceof Error ? error.message : 'Knowledge base unavailable' }, 503);
        }
    }
    if (method === 'POST' && url.pathname === '/api/knowledge/documents') {
        try {
            const body = JSON.parse(await readBody(request));
            const name = typeof body.name === 'string' ? body.name.trim().slice(0, 180) : '';
            const content = typeof body.content === 'string' ? body.content.slice(0, 200000) : '';
            if (!name)
                return json(response, { error: 'Dokumen butuh nama file' }, 400);
            if (!content.trim())
                return json(response, { error: 'Konten dokumen wajib diisi' }, 400);
            const db = await ensureDatabase();
            const id = `kb-${randomBytes(8).toString('hex')}`;
            const now = new Date().toISOString();
            const extension = name.includes('.') && name.split('.').pop() ? name.split('.').pop().toUpperCase().slice(0, 5) : '';
            const type = extension || 'TXT';
            const bytes = Buffer.byteLength(content, 'utf8');
            const size = bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
            const chunks = knowledgeChunksFrom(content, 1);
            await db.execute({ sql: 'INSERT INTO knowledge_documents (id, name, type, size, status, chunks, content, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', args: [id, name, type, size, 'Indexed', chunks, content, now, now] });
            return json(response, { document: { id, name, type, size, status: 'Indexed', chunks, updatedAt: now } });
        }
        catch (error) {
            return json(response, { error: error instanceof Error ? error.message : 'Gagal menambah dokumen' }, 500);
        }
    }
    if (method === 'POST' && url.pathname === '/api/knowledge/reindex') {
        try {
            const rawBody = await readBody(request);
            const body = (rawBody ? JSON.parse(rawBody) : {});
            const db = await ensureDatabase();
            if (!body.id)
                await ensureKnowledgeSeed(db);
            const rows = body.id
                ? await db.execute({ sql: 'SELECT id, chunks, content FROM knowledge_documents WHERE id = ?', args: [body.id] })
                : await db.execute('SELECT id, chunks, content FROM knowledge_documents');
            if (!rows.rows.length)
                return json(response, { error: 'Dokumen tidak ditemukan' }, 404);
            const now = new Date().toISOString();
            for (const row of rows.rows) {
                const chunks = knowledgeChunksFrom(String(row.content ?? ''), Number(row.chunks ?? 0));
                await db.execute({ sql: "UPDATE knowledge_documents SET chunks = ?, status = 'Indexed', updated_at = ? WHERE id = ?", args: [chunks, now, String(row.id)] });
            }
            return json(response, { ok: true, count: rows.rows.length, lastSync: now });
        }
        catch (error) {
            return json(response, { error: error instanceof Error ? error.message : 'Re-index gagal' }, 500);
        }
    }
    if (method === 'POST' && url.pathname === '/api/knowledge/documents/delete') {
        try {
            const body = JSON.parse(await readBody(request));
            if (!body.id)
                return json(response, { error: 'id is required' }, 400);
            const db = await ensureDatabase();
            const result = await db.execute({ sql: 'DELETE FROM knowledge_documents WHERE id = ?', args: [body.id] });
            if (!result.rowsAffected)
                return json(response, { error: 'Dokumen tidak ditemukan' }, 404);
            return json(response, { ok: true, id: body.id });
        }
        catch (error) {
            return json(response, { error: error instanceof Error ? error.message : 'Gagal menghapus dokumen' }, 500);
        }
    }
    // --- Inbox dashboard (percakapan nyata dari database) ---------------------
    const requireSession = () => (cookies[SESSION_COOKIE] ? verifyJwt(cookies[SESSION_COOKIE]) : null);
    const conversationIdFromPath = (prefix) => decodeURIComponent(url.pathname.slice(prefix.length)).replace(/\/+$/, '');
    if (method === 'GET' && url.pathname.startsWith('/api/conversations/') && url.pathname.endsWith('/messages')) {
        const conversationId = conversationIdFromPath('/api/conversations/').slice(0, -'/messages'.length);
        if (!conversationId)
            return json(response, { error: 'conversationId is required' }, 400);
        try {
            const messages = await loadHistory(conversationId, Number(url.searchParams.get('limit') ?? 200));
            return json(response, { conversationId, messages, persistence: 'turso' });
        }
        catch (error) {
            return json(response, { error: error instanceof Error ? error.message : 'Messages unavailable' }, 503);
        }
    }
    if (method === 'POST' && url.pathname === '/api/conversations/messages') {
        if (!requireSession())
            return json(response, { error: 'Authentication required' }, 401);
        try {
            const body = JSON.parse(await readBody(request));
            const conversationId = typeof body.conversationId === 'string' ? body.conversationId.trim() : '';
            const role = body.role === 'user' ? 'user' : 'assistant';
            const content = typeof body.content === 'string' ? body.content.trim() : '';
            if (!conversationId || !content)
                return json(response, { error: 'conversationId and content are required' }, 400);
            if (content.length > 8000)
                return json(response, { error: 'content must be 8000 characters or fewer' }, 400);
            await persistMessage(conversationId, { role, content });
            return json(response, { ok: true, conversationId, persistence: 'turso' });
        }
        catch (error) {
            return json(response, { error: error instanceof Error ? error.message : 'Failed to persist message' }, 500);
        }
    }
    if (method === 'PATCH' && url.pathname.startsWith('/api/conversations/')) {
        if (!requireSession())
            return json(response, { error: 'Authentication required' }, 401);
        const conversationId = conversationIdFromPath('/api/conversations/');
        if (!conversationId)
            return json(response, { error: 'conversationId is required' }, 400);
        try {
            const body = JSON.parse(await readBody(request));
            const status = body.status;
            if (status !== 'AI' && status !== 'HUMAN_HANDOFF' && status !== 'RESOLVED') {
                return json(response, { error: 'status must be AI, HUMAN_HANDOFF, or RESOLVED' }, 400);
            }
            await setConversationStatus(conversationId, status, typeof body.reason === 'string' ? body.reason.slice(0, 300) : '');
            return json(response, { ok: true, conversationId, status });
        }
        catch (error) {
            return json(response, { error: error instanceof Error ? error.message : 'Failed to update status' }, 500);
        }
    }
    if (method === 'DELETE' && url.pathname.startsWith('/api/conversations/')) {
        if (!requireSession())
            return json(response, { error: 'Authentication required' }, 401);
        const conversationId = conversationIdFromPath('/api/conversations/');
        if (!conversationId)
            return json(response, { error: 'conversationId is required' }, 400);
        try {
            const db = await ensureDatabase();
            await db.execute({ sql: 'DELETE FROM messages WHERE conversation_id = ?', args: [conversationId] });
            await db.execute({ sql: 'DELETE FROM conversation_status WHERE conversation_id = ?', args: [conversationId] });
            await db.execute({ sql: 'DELETE FROM conversations WHERE id = ?', args: [conversationId] });
            return json(response, { ok: true, conversationId });
        }
        catch (error) {
            return json(response, { error: error instanceof Error ? error.message : 'Failed to delete conversation' }, 500);
        }
    }
    // --- Token usage per AI agent (Analytics) ---------------------------------
    if (method === 'GET' && url.pathname === '/api/agents/usage') {
        if (!requireSession())
            return json(response, { error: 'Authentication required' }, 401);
        try {
            const days = Math.min(Math.max(Number(url.searchParams.get('days') ?? 7), 1), 90);
            const since = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
            const db = await ensureDatabase();
            const rows = await db.execute({ sql: 'SELECT agent_id, date, model, prompt_tokens, completion_tokens, requests FROM agent_usage_daily WHERE date >= ? ORDER BY date ASC', args: [since] });
            const agents = await listAgents();
            const nameById = new Map(agents.map((agent) => [agent.id, agent.name]));
            const byAgent = new Map();
            for (const row of rows.rows) {
                const agentId = String(row.agent_id);
                const entry = byAgent.get(agentId) ?? { agentId, name: nameById.get(agentId) ?? agentId, model: String(row.model ?? ''), promptTokens: 0, completionTokens: 0, requests: 0, days: [] };
                entry.model = String(row.model ?? '') || entry.model;
                entry.promptTokens += Number(row.prompt_tokens ?? 0);
                entry.completionTokens += Number(row.completion_tokens ?? 0);
                entry.requests += Number(row.requests ?? 0);
                entry.days.push({ date: String(row.date), promptTokens: Number(row.prompt_tokens ?? 0), completionTokens: Number(row.completion_tokens ?? 0), requests: Number(row.requests ?? 0) });
                byAgent.set(agentId, entry);
            }
            // Agent tanpa pemakaian tetap ditampilkan (angka nol) agar tabel Analytics lengkap.
            for (const agent of agents) {
                if (!byAgent.has(agent.id))
                    byAgent.set(agent.id, { agentId: agent.id, name: agent.name, model: agent.model, promptTokens: 0, completionTokens: 0, requests: 0, days: [] });
            }
            return json(response, { since, days, agents: [...byAgent.values()] });
        }
        catch (error) {
            return json(response, { error: error instanceof Error ? error.message : 'Usage unavailable' }, 503);
        }
    }
    if (method === 'GET' && url.pathname === '/api/team') {
        try {
            const db = await ensureDatabase();
            const rows = await db.execute('SELECT id, name, email, role, status, last_active, created_at FROM team_members ORDER BY created_at DESC');
            const members = rows.rows.map(r => ({ id: String(r.id), name: String(r.name), email: String(r.email), role: String(r.role), status: String(r.status), last_active: r.last_active ? String(r.last_active) : null, created_at: String(r.created_at) }));
            return json(response, { members });
        }
        catch {
            return json(response, { members: [] });
        }
    }
    if (method === 'POST' && url.pathname === '/api/team') {
        try {
            const body = JSON.parse(await readBody(request));
            if (!body.name || !body.email)
                return json(response, { error: 'name and email required' }, 400);
            const db = await ensureDatabase();
            const id = randomBytes(8).toString('hex');
            const now = new Date().toISOString();
            await db.execute({ sql: 'INSERT INTO team_members (id, name, email, role, status, last_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', args: [id, body.name, body.email, body.role || 'agent', 'active', now, now, now] });
            return json(response, { ok: true, member: { id, name: body.name, email: body.email, role: body.role || 'agent', status: 'active', last_active: now } });
        }
        catch (e) {
            return json(response, { error: 'Failed to add member' }, 500);
        }
    }
    if (method === 'PATCH' && url.pathname.startsWith('/api/team/')) {
        try {
            const memberId = decodeURIComponent(url.pathname.slice('/api/team/'.length)).replace(/\/+$/, '');
            if (!memberId)
                return json(response, { error: 'member id is required' }, 400);
            const body = JSON.parse(await readBody(request));
            const db = await ensureDatabase();
            const now = new Date().toISOString();
            const sets = [];
            const args = [];
            if (typeof body.name === 'string' && body.name.trim()) {
                sets.push('name = ?');
                args.push(body.name.trim());
            }
            if (typeof body.email === 'string' && body.email.trim()) {
                sets.push('email = ?');
                args.push(body.email.trim());
            }
            if (typeof body.role === 'string' && body.role.trim()) {
                sets.push('role = ?');
                args.push(body.role.trim());
            }
            if (body.status === 'active' || body.status === 'inactive') {
                sets.push('status = ?');
                args.push(body.status);
            }
            if (!sets.length)
                return json(response, { error: 'nothing to update' }, 400);
            sets.push('updated_at = ?');
            args.push(now);
            const result = await db.execute({ sql: `UPDATE team_members SET ${sets.join(', ')} WHERE id = ?`, args: [...args, memberId] });
            if (!result.rowsAffected)
                return json(response, { error: 'Member tidak ditemukan' }, 404);
            return json(response, { ok: true, id: memberId });
        }
        catch (error) {
            return json(response, { error: error instanceof Error ? error.message : 'Failed to update member' }, 500);
        }
    }
    if (method === 'DELETE' && url.pathname.startsWith('/api/team/')) {
        try {
            const memberId = decodeURIComponent(url.pathname.slice('/api/team/'.length)).replace(/\/+$/, '');
            if (!memberId)
                return json(response, { error: 'member id is required' }, 400);
            const db = await ensureDatabase();
            const result = await db.execute({ sql: 'DELETE FROM team_members WHERE id = ?', args: [memberId] });
            if (!result.rowsAffected)
                return json(response, { error: 'Member tidak ditemukan' }, 404);
            return json(response, { ok: true, id: memberId });
        }
        catch (error) {
            return json(response, { error: error instanceof Error ? error.message : 'Failed to delete member' }, 500);
        }
    }
    if (method === 'GET' && url.pathname === '/api/settings') {
        try {
            const db = await ensureDatabase();
            const rows = await db.execute('SELECT key, value FROM settings');
            const settings = {};
            rows.rows.forEach(r => { settings[String(r.key)] = String(r.value); });
            return json(response, { settings });
        }
        catch {
            return json(response, { settings: {} });
        }
    }
    if (method === 'POST' && url.pathname === '/api/settings') {
        try {
            const body = JSON.parse(await readBody(request));
            const db = await ensureDatabase();
            const now = new Date().toISOString();
            const settings = body.settings || {};
            for (const [k, v] of Object.entries(settings)) {
                await db.execute({ sql: `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`, args: [k, String(v), now] });
            }
            return json(response, { ok: true });
        }
        catch {
            return json(response, { error: 'Failed to save settings' }, 500);
        }
    }
    if (method === 'GET' && url.pathname === '/api/chat/public/history') {
        try {
            const conversationId = url.searchParams.get('conversationId') ?? WIDGET_CONVERSATION_ID;
            return json(response, { conversationId, messages: await loadHistory(conversationId), persistence: 'turso' });
        }
        catch {
            return json(response, { conversationId: url.searchParams.get('conversationId') ?? WIDGET_CONVERSATION_ID, messages: [], persistence: 'unavailable' }, 503);
        }
    }
    if (method === 'POST' && url.pathname === '/api/channels/whatsapp/send') {
        const identity = cookies[SESSION_COOKIE] ? verifyJwt(cookies[SESSION_COOKIE]) : null;
        if (!identity)
            return json(response, { error: 'Authentication required' }, 401);
        try {
            const body = JSON.parse(await readBody(request));
            if (!body.to || !body.text || body.text.length > 4096)
                return json(response, { error: 'to and text are required; text must be 4096 characters or fewer' }, 400);
            const messageId = await sendWhatsAppText(body.to, body.text);
            return json(response, { ok: true, channel: 'WHATSAPP', messageId, sentBy: identity.openId });
        }
        catch (error) {
            return json(response, { error: error instanceof Error ? error.message : 'WhatsApp send failed' }, 502);
        }
    }
    if (method === 'POST' && url.pathname === '/api/chat/public') {
        try {
            const body = JSON.parse(await readBody(request));
            const messages = Array.isArray(body.messages) ? body.messages.filter((message) => message && (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string').slice(-12) : [];
            if (!messages.length || messages[messages.length - 1]?.role !== 'user')
                return json(response, { error: 'A user message is required' }, 400);
            const conversationId = body.conversationId ?? WIDGET_CONVERSATION_ID;
            const current = await getConversationStatus(conversationId).catch(() => null);
            let persistence = 'unavailable';
            try {
                await persistMessage(conversationId, messages[messages.length - 1]);
                persistence = 'turso';
            }
            catch { /* keep AI response available if persistence is temporarily unavailable */ }
            if (current?.status === 'HUMAN_HANDOFF') {
                return json(response, { id: `msg_${Date.now()}`, status: 'HUMAN_HANDOFF', confidence: 1, citations: [], conversationId, persistence, message: HANDOFF_ACKNOWLEDGEMENT });
            }
            const latestUserText = messages[messages.length - 1].content;
            const userRequestedHuman = isEscalationRequest(latestUserText);
            let message;
            let conversationStatus = 'AI_ACTIVE';
            let routedAgent = null;
            let switchedFrom = null;
            if (userRequestedHuman) {
                message = HANDOFF_ACKNOWLEDGEMENT;
                conversationStatus = 'HUMAN_HANDOFF';
            }
            else {
                try {
                    const routed = await callAgentWithRouter(messages, body.agentId);
                    message = routed.content;
                    routedAgent = routed.agent;
                    switchedFrom = routed.switchedFrom;
                }
                catch {
                    const kb = answerFromKnowledgeBase(latestUserText);
                    if (!kb) {
                        message = OUT_OF_SCOPE_HANDOFF;
                        conversationStatus = 'HUMAN_HANDOFF';
                    }
                    else {
                        message = kb;
                    }
                }
                if (message.includes(HANDOFF_MARKER)) {
                    message = HANDOFF_ACKNOWLEDGEMENT;
                    conversationStatus = 'HUMAN_HANDOFF';
                }
            }
            if (conversationStatus === 'HUMAN_HANDOFF') {
                try {
                    await setConversationStatus(conversationId, 'HUMAN_HANDOFF', latestUserText.slice(0, 300));
                }
                catch { /* status tracking is best-effort */ }
            }
            try {
                await persistMessage(conversationId, { role: 'assistant', content: message });
                persistence = 'turso';
            }
            catch { /* keep the response available */ }
            return json(response, { id: `msg_${Date.now()}`, status: conversationStatus, confidence: conversationStatus === 'HUMAN_HANDOFF' ? 1 : 0.9, citations: conversationStatus === 'HUMAN_HANDOFF' ? [] : ['Knowledge Base resmi'], conversationId, persistence, message, agent: routedAgent, switchedFrom });
        }
        catch (error) {
            return json(response, { error: 'AI response unavailable', detail: error instanceof Error ? error.message : 'Unknown error' }, 502);
        }
    }
    if (method === 'GET' && (url.pathname === '/api/webhooks/meta' || url.pathname === '/api/webhooks/whatsapp')) {
        const mode = url.searchParams.get('hub.mode');
        const token = url.searchParams.get('hub.verify_token');
        const challenge = url.searchParams.get('hub.challenge');
        if (!process.env.WHATSAPP_VERIFY_TOKEN)
            return json(response, { error: 'WhatsApp webhook is not configured' }, 503);
        if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
            response.statusCode = 200;
            response.setHeader('content-type', 'text/plain');
            return response.end(challenge ?? '');
        }
        return json(response, { error: 'Webhook verification failed' }, 403);
    }
    if (method === 'POST' && (url.pathname === '/api/webhooks/meta' || url.pathname === '/api/webhooks/whatsapp')) {
        try {
            const rawBody = await readRawBody(request);
            const signature = typeof request.headers['x-hub-signature-256'] === 'string' ? request.headers['x-hub-signature-256'] : undefined;
            if (!verifyMetaSignature(rawBody, signature))
                return json(response, { error: 'Invalid Meta webhook signature' }, 401);
            const result = await handleWhatsAppWebhook(rawBody);
            return json(response, { accepted: true, normalized: true, channel: 'WHATSAPP', ...result }, 200);
        }
        catch (error) {
            return json(response, { error: error instanceof Error ? error.message : 'Webhook processing failed' }, 400);
        }
    }
    return json(response, { error: 'Not found' }, 404);
}
