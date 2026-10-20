/**
 * AI agent registry + fallback router (gaya OpenRouter).
 *
 * - Urutan array = urutan prioritas (index 0 = agent utama).
 * - Saat satu agent kehabisan quota / kena rate limit / timeout, router
 *   otomatis mencoba agent berikutnya sampai ada yang berhasil.
 * - Konfigurasi di-seed dari env AI_AGENTS (JSON array) atau fallback ke
 *   MANUS_API_URL / MANUS_API_KEY; disimpan lewat persistence hook dari index.ts.
 */
import { systemPrompt } from './knowledge-base.js'

export type AgentConfig = {
  id: string
  name: string
  model: string
  apiUrl: string
  apiKey: string
  enabled: boolean
}

export type AgentStatus = 'ready' | 'exhausted' | 'unconfigured' | 'disabled'

export type AgentPublic = {
  id: string
  name: string
  model: string
  apiUrl: string
  keyHint: string
  enabled: boolean
  status: AgentStatus
}

export type RouterAttempt = { agent: string; error: string }

export type RouterResult = {
  content: string
  agent: { id: string; name: string; model: string }
  switchedFrom: string | null
  attempts: RouterAttempt[]
}

export type AgentUsage = { promptTokens: number; completionTokens: number }

export type AgentsPersistence = {
  load: () => Promise<{ agents: AgentConfig[]; autoFallback: boolean } | null>
  save: (agents: AgentConfig[], autoFallback: boolean) => Promise<void>
  recordUsage?: (agentId: string, model: string, usage: AgentUsage) => Promise<void>
}

export const EXHAUSTED_COOLDOWN_MS = 5 * 60_000
const MAX_AGENTS = 10

let chain: AgentConfig[] | null = null
let autoFallback = true
let persistence: AgentsPersistence | null = null
const exhaustedUntil = new Map<string, number>()

export const registerAgentsPersistence = (hooks: AgentsPersistence) => {
  persistence = hooks
}

const cleanString = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

const normalizeAgent = (raw: unknown, index: number): AgentConfig | null => {
  if (!raw || typeof raw !== 'object') return null
  const entry = raw as Record<string, unknown>
  const name = cleanString(entry.name) || `Agent ${index + 1}`
  const model = cleanString(entry.model)
  const apiUrl = cleanString(entry.apiUrl) || cleanString(entry.baseUrl) || cleanString(entry.url)
  const apiKey = cleanString(entry.apiKey)
  const id = cleanString(entry.id) || `${name}-${index + 1}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return { id, name, model, apiUrl, apiKey, enabled: entry.enabled !== false }
}

const normalizeChain = (agents: AgentConfig[]) =>
  agents
    .filter((agent) => agent && typeof agent === 'object')
    .slice(0, MAX_AGENTS)
    .map((agent, index) => ({
      id: agent.id || `agent-${index + 1}`,
      name: agent.name || `Agent ${index + 1}`,
      model: cleanString(agent.model),
      apiUrl: cleanString(agent.apiUrl),
      apiKey: cleanString(agent.apiKey),
      enabled: agent.enabled !== false,
    }))

/** Seed default: env AI_AGENTS (JSON) atau MANUS_API_URL / MANUS_API_KEY. */
export const seedAgentsFromEnv = (): AgentConfig[] => {
  const raw = process.env.AI_AGENTS
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        const agents = parsed.map((entry, index) => normalizeAgent(entry, index)).filter((agent): agent is AgentConfig => Boolean(agent))
        if (agents.length) return normalizeChain(agents)
      }
    } catch { /* format tidak valid → fallback ke seed di bawah */ }
  }
  const apiUrl = process.env.MANUS_API_URL ?? ''
  const apiKey = process.env.MANUS_API_KEY ?? ''
  return [{
    id: 'primary',
    name: 'Primary · Managed LLM',
    model: 'gpt-5-mini',
    apiUrl,
    apiKey,
    enabled: true,
  }]
}

const ensureChain = async (): Promise<AgentConfig[]> => {
  if (chain) return chain
  let persisted: { agents: AgentConfig[]; autoFallback: boolean } | null = null
  if (persistence) {
    try { persisted = await persistence.load() } catch { /* database opsional → pakai seed */ }
  }
  chain = persisted && persisted.agents.length ? normalizeChain(persisted.agents) : seedAgentsFromEnv()
  autoFallback = persisted ? persisted.autoFallback !== false : true
  return chain
}

export const getAutoFallback = () => autoFallback

export const markExhausted = (id: string) => exhaustedUntil.set(id, Date.now() + EXHAUSTED_COOLDOWN_MS)
export const clearExhausted = (id: string) => exhaustedUntil.delete(id)

export const agentStatus = (agent: AgentConfig): AgentStatus => {
  if (!agent.enabled) return 'disabled'
  if (!agent.apiUrl || !agent.apiKey || !agent.model) return 'unconfigured'
  if ((exhaustedUntil.get(agent.id) ?? 0) > Date.now()) return 'exhausted'
  return 'ready'
}

export const toPublicAgent = (agent: AgentConfig): AgentPublic => ({
  id: agent.id,
  name: agent.name,
  model: agent.model,
  apiUrl: agent.apiUrl,
  keyHint: agent.apiKey ? `••••${agent.apiKey.slice(-4)}` : '',
  enabled: agent.enabled,
  status: agentStatus(agent),
})

export const listAgents = async (): Promise<AgentPublic[]> => (await ensureChain()).map(toPublicAgent)

export const agentsSummary = () => {
  const agents = chain ?? seedAgentsFromEnv()
  return { total: agents.length, enabled: agents.filter((agent) => agent.enabled).length }
}

/** Snapshot sinkron untuk health check (tanpa sentuh database). */
export const getAgentChainSnapshot = () => ({ agents: chain ?? seedAgentsFromEnv(), autoFallback })

/**
 * Terima konfigurasi baru (mis. dari POST /api/agents), lalu simpan
 * best-effort: memori selalu, database jika persistence tersedia.
 */
export const saveAgents = async (agents: AgentConfig[], fallback: boolean): Promise<'turso' | 'memory'> => {
  chain = normalizeChain(agents)
  autoFallback = fallback
  exhaustedUntil.clear()
  if (!persistence) return 'memory'
  try {
    await persistence.save(chain, autoFallback)
    return 'turso'
  } catch {
    return 'memory'
  }
}

/** Hanya untuk test: reset runtime state. */
export const resetAgentsRuntime = () => {
  chain = null
  autoFallback = true
  exhaustedUntil.clear()
}

const resolveCompletionsUrl = (apiUrl: string) => {
  const base = apiUrl.replace(/\/+$/, '')
  if (base.endsWith('/chat/completions')) return base
  if (/\/v\d+(\.\d+)?$/.test(base) || base.endsWith('/v1')) return `${base}/chat/completions`
  return `${base}/v1/chat/completions`
}

const callAgent = async (agent: AgentConfig, messages: Array<{ role: 'user' | 'assistant'; content: string }>) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)
  try {
    const response = await fetch(resolveCompletionsUrl(agent.apiUrl), {
      method: 'POST',
      headers: { authorization: `Bearer ${agent.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: agent.model, messages: [{ role: 'system', content: systemPrompt }, ...messages] }),
      signal: controller.signal,
    })
    const payload = await response.json() as { error?: { message?: string }; choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } }
    if (!response.ok || payload.error) throw new Error(`HTTP ${response.status}: ${payload.error?.message ?? 'request failed'}`)
    const content = payload.choices?.[0]?.message?.content?.trim()
    if (!content) throw new Error('LLM returned an empty response')
    const usage: AgentUsage = {
      promptTokens: Number(payload.usage?.prompt_tokens ?? 0) || 0,
      completionTokens: Number(payload.usage?.completion_tokens ?? 0) || 0,
    }
    return { content, usage }
  } finally {
    clearTimeout(timeout)
  }
}

/** Deteksi quota habis / rate limit / timeout → tandai cooldown + lanjut ke agent berikutnya. */
export const isExhaustionError = (message: string) =>
  /\b(429|503)\b|rate.?limit|quota|exceed|too many requests|insufficient credit|capacity|timed? ?out|aborted/i.test(message)

const orderChain = (agents: AgentConfig[], preferredAgentId?: string) => {
  if (!preferredAgentId) return agents
  const preferred = agents.find((agent) => agent.id === preferredAgentId)
  if (!preferred) return agents
  return [preferred, ...agents.filter((agent) => agent.id !== preferred.id)]
}

/**
 * Panggil AI dengan rantai fallback: agent utama → agent cadangan berikutnya.
 * Melempar error hanya jika SEMUA agent gagal (pemanggil bisa fallback ke KB).
 */
export const callAgentWithRouter = async (
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  preferredAgentId?: string,
): Promise<RouterResult> => {
  const agents = await ensureChain()
  const ordered = orderChain(agents, preferredAgentId)
  // Auto-switch mati → hanya agent terpilih/utama yang boleh dicoba
  // (agent nonaktif atau belum dikonfigurasi tetap dilewati).
  const candidates = autoFallback
    ? ordered
    : ordered.filter((agent) => ['disabled', 'unconfigured'].includes(agentStatus(agent)) === false).slice(0, 1)
  const firstChoice = candidates[0]
  const attempts: RouterAttempt[] = []

  for (const agent of candidates) {
    const status = agentStatus(agent)
    if (status !== 'ready') {
      attempts.push({ agent: agent.name, error: `skipped (${status})` })
      continue
    }
    try {
      const result = await callAgent(agent, messages)
      clearExhausted(agent.id)
      // Catat pemakaian token async — tidak memperlambat respons chat.
      if (persistence?.recordUsage) void persistence.recordUsage(agent.id, agent.model, result.usage).catch(() => undefined)
      return {
        content: result.content,
        agent: { id: agent.id, name: agent.name, model: agent.model },
        switchedFrom: firstChoice && agent.id !== firstChoice.id ? firstChoice.name : null,
        attempts,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      attempts.push({ agent: agent.name, error: message })
      if (isExhaustionError(message)) markExhausted(agent.id)
    }
  }

  throw new Error(`All AI agents are unavailable → ${attempts.map((attempt) => `${attempt.agent}: ${attempt.error}`).join(' | ') || 'no configured agent'}`)
}
