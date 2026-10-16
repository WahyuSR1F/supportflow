export type AgentConfig = {
    id: string;
    name: string;
    model: string;
    apiUrl: string;
    apiKey: string;
    enabled: boolean;
};
export type AgentStatus = 'ready' | 'exhausted' | 'unconfigured' | 'disabled';
export type AgentPublic = {
    id: string;
    name: string;
    model: string;
    apiUrl: string;
    keyHint: string;
    enabled: boolean;
    status: AgentStatus;
};
export type RouterAttempt = {
    agent: string;
    error: string;
};
export type RouterResult = {
    content: string;
    agent: {
        id: string;
        name: string;
        model: string;
    };
    switchedFrom: string | null;
    attempts: RouterAttempt[];
};
export type AgentsPersistence = {
    load: () => Promise<{
        agents: AgentConfig[];
        autoFallback: boolean;
    } | null>;
    save: (agents: AgentConfig[], autoFallback: boolean) => Promise<void>;
};
export declare const EXHAUSTED_COOLDOWN_MS: number;
export declare const registerAgentsPersistence: (hooks: AgentsPersistence) => void;
/** Seed default: env AI_AGENTS (JSON) atau MANUS_API_URL / MANUS_API_KEY. */
export declare const seedAgentsFromEnv: () => AgentConfig[];
export declare const getAutoFallback: () => boolean;
export declare const markExhausted: (id: string) => Map<string, number>;
export declare const clearExhausted: (id: string) => boolean;
export declare const agentStatus: (agent: AgentConfig) => AgentStatus;
export declare const toPublicAgent: (agent: AgentConfig) => AgentPublic;
export declare const listAgents: () => Promise<AgentPublic[]>;
export declare const agentsSummary: () => {
    total: number;
    enabled: number;
};
/** Snapshot sinkron untuk health check (tanpa sentuh database). */
export declare const getAgentChainSnapshot: () => {
    agents: AgentConfig[];
    autoFallback: boolean;
};
/**
 * Terima konfigurasi baru (mis. dari POST /api/agents), lalu simpan
 * best-effort: memori selalu, database jika persistence tersedia.
 */
export declare const saveAgents: (agents: AgentConfig[], fallback: boolean) => Promise<'turso' | 'memory'>;
/** Hanya untuk test: reset runtime state. */
export declare const resetAgentsRuntime: () => void;
/** Deteksi quota habis / rate limit / timeout → tandai cooldown + lanjut ke agent berikutnya. */
export declare const isExhaustionError: (message: string) => boolean;
/**
 * Panggil AI dengan rantai fallback: agent utama → agent cadangan berikutnya.
 * Melempar error hanya jika SEMUA agent gagal (pemanggil bisa fallback ke KB).
 */
export declare const callAgentWithRouter: (messages: Array<{
    role: 'user' | 'assistant';
    content: string;
}>, preferredAgentId?: string) => Promise<RouterResult>;
