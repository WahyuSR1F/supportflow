import type { IncomingMessage, ServerResponse } from 'node:http';
export declare function handleSupportFlowApi(request: IncomingMessage, response: ServerResponse): Promise<void | ServerResponse<IncomingMessage>>;
