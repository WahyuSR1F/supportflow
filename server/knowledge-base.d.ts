/**
 * Knowledge Base resmi — satu-satunya sumber jawaban CS AI.
 * Edit konten di sini; system prompt dibangun otomatis dari data ini.
 */
export type KnowledgeSection = {
    title: string;
    items: string[];
};
export declare const knowledgeSections: KnowledgeSection[];
export declare const escalationRules: string;
export declare const systemPrompt: string;
export declare const HANDOFF_ACKNOWLEDGEMENT = "Baik, percakapan kamu sedang saya hubungkan ke tim Customer Service kami. Mohon ditunggu sebentar, ya.";
export declare const OUT_OF_SCOPE_HANDOFF = "Mohon maaf, pertanyaan Anda berada di luar cakupan pengetahuan saya. Percakapan ini akan saya hubungkan ke tim Customer Service kami untuk dibantu lebih lanjut. Terima kasih atas pengertiannya.";
export declare const HANDOFF_MARKER = "[[ESCALATE_TO_HUMAN]]";
export declare const isEscalationRequest: (text: string) => boolean;
export declare const answerFromKnowledgeBase: (text: string) => string | null;
