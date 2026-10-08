import type { IncomingMessage, ServerResponse } from 'node:http';
type VercelRequest = IncomingMessage & {
    body?: unknown;
    rawBody?: string;
};
export declare function handleVercelRequest(request: VercelRequest, response: ServerResponse): Promise<void>;
export {};
