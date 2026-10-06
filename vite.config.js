import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleSupportFlowApi } from './server/index';
// Muat .env ke process.env sebelum server API dibuat (mode dev)
try {
    const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '.env');
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!match || line.trim().startsWith('#'))
            continue;
        const key = match[1];
        const value = match[2].replace(/^['"]|['"]$/g, '');
        if (!(key in process.env))
            process.env[key] = value;
    }
}
catch { /* .env opsional */ }
const supportFlowApi = () => ({
    name: 'supportflow-api',
    configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
            if (!request.url?.startsWith('/api/'))
                return next();
            try {
                await handleSupportFlowApi(request, response);
            }
            catch {
                if (!response.headersSent) {
                    response.statusCode = 500;
                    response.setHeader('content-type', 'application/json; charset=utf-8');
                    response.end(JSON.stringify({ error: 'Unexpected API error' }));
                }
            }
        });
    },
});
export default defineConfig({
    plugins: [react(), supportFlowApi()],
    server: {
        host: '0.0.0.0',
        allowedHosts: true,
        port: 3000,
        strictPort: true,
    },
});
