import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { createClient } from '@libsql/client';
const ensureAuthSchema = async () => {
    const db = getAuthDb();
    await db.execute(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password_hash TEXT,
    name TEXT,
    google_sub TEXT UNIQUE,
    avatar_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
    return db;
};
let authClient = null;
const getAuthDb = () => {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url || !authToken)
        throw new Error('Turso database is not configured');
    if (!authClient)
        authClient = createClient({ url, authToken });
    return authClient;
};
export const authDatabaseReady = async () => {
    try {
        await ensureAuthSchema();
        return true;
    }
    catch {
        return false;
    }
};
const scryptHash = (password, salt) => scryptSync(password, salt, 64).toString('hex');
const hashPassword = (password) => {
    const salt = randomBytes(16).toString('hex');
    return `scrypt:${salt}:${scryptHash(password, salt)}`;
};
const verifyPassword = (password, stored) => {
    const [scheme, salt, digest] = stored.split(':');
    if (scheme !== 'scrypt' || !salt || !digest)
        return false;
    const expected = Buffer.from(scryptHash(password, salt), 'hex');
    const received = Buffer.from(digest, 'hex');
    return expected.length === received.length && timingSafeEqual(expected, received);
};
const findUserByEmail = async (db, email) => {
    const result = await db.execute({ sql: 'SELECT id, email, password_hash, name, google_sub FROM users WHERE lower(email) = lower(?)', args: [email] });
    return result.rows[0] ?? null;
};
export const registerWithEmailAndPassword = async (input) => {
    const db = await ensureAuthSchema();
    const email = input.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw new Error('Format email tidak valid');
    if (input.password.length < 8)
        throw new Error('Password minimal 8 karakter');
    const existing = await findUserByEmail(db, email);
    if (existing)
        throw new Error('Email sudah terdaftar. Silakan login.');
    const id = `usr_${randomBytes(12).toString('hex')}`;
    const now = new Date().toISOString();
    await db.execute({
        sql: 'INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        args: [id, email.toLowerCase(), hashPassword(input.password), input.name.trim() || email.split('@')[0], now, now],
    });
    return { openId: id, name: input.name.trim() || email.split('@')[0], email: email.toLowerCase() };
};
export const loginWithEmailAndPassword = async (input) => {
    const db = await ensureAuthSchema();
    const row = await findUserByEmail(db, input.email.trim());
    if (!row || !row.password_hash)
        throw new Error('Email atau password salah');
    if (!verifyPassword(input.password, String(row.password_hash)))
        throw new Error('Email atau password salah');
    const identity = { openId: String(row.id), email: String(row.email) };
    if (row.name)
        identity.name = String(row.name);
    return identity;
};
export const googleConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';
export const googleAuthUrl = (redirectUri, state) => {
    const url = new URL(GOOGLE_AUTH_ENDPOINT);
    url.searchParams.set('client_id', String(process.env.GOOGLE_CLIENT_ID));
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('access_type', 'online');
    url.searchParams.set('prompt', 'select_account');
    return url.toString();
};
export const exchangeGoogleCode = async (code, redirectUri) => {
    const db = await ensureAuthSchema();
    const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: String(process.env.GOOGLE_CLIENT_ID),
            client_secret: String(process.env.GOOGLE_CLIENT_SECRET),
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
        }),
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || !tokens.access_token)
        throw new Error(tokens.error_description ?? 'Pertukaran token Google gagal');
    const userinfoResponse = await fetch(GOOGLE_USERINFO_ENDPOINT, { headers: { authorization: `Bearer ${tokens.access_token}` } });
    const userinfo = await userinfoResponse.json();
    if (!userinfoResponse.ok || !userinfo.sub)
        throw new Error('Profil Google tidak dapat dibaca');
    const googleSub = userinfo.sub;
    const email = userinfo.email?.toLowerCase() ?? null;
    const name = userinfo.name ?? email?.split('@')[0] ?? 'Pengguna Google';
    const byGoogleSub = await db.execute({ sql: 'SELECT id, email, name FROM users WHERE google_sub = ?', args: [googleSub] });
    const existingBySub = byGoogleSub.rows[0];
    if (existingBySub) {
        return { openId: String(existingBySub.id), name: String(existingBySub.name ?? name), email: String(existingBySub.email ?? email ?? ''), provider: 'google' };
    }
    if (email) {
        const existing = await findUserByEmail(db, email);
        if (existing) {
            await db.execute({ sql: 'UPDATE users SET google_sub = ?, updated_at = ? WHERE id = ?', args: [googleSub, new Date().toISOString(), String(existing.id)] });
            return { openId: String(existing.id), name: String(existing.name ?? name), email, provider: 'google' };
        }
    }
    const id = `usr_${randomBytes(12).toString('hex')}`;
    const now = new Date().toISOString();
    await db.execute({
        sql: 'INSERT INTO users (id, email, password_hash, name, google_sub, avatar_url, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?, ?, ?)',
        args: [id, email, name, googleSub, userinfo.picture ?? null, now, now],
    });
    return { openId: id, name, email: email ?? '', provider: 'google' };
};
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
export const signSessionJwt = (identity) => {
    const secret = process.env.MANUS_JWT_SECRET;
    if (!secret)
        throw new Error('Session secret belum dikonfigurasi (MANUS_JWT_SECRET)');
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
        appId: process.env.MANUS_PROJECT_ID ?? 'supportflow',
        openId: identity.openId,
        name: identity.name,
        email: identity.email,
        exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    })).toString('base64url');
    const unsigned = `${header}.${payload}`;
    return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
};
