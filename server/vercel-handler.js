import { handleSupportFlowApi } from './index.js';
// Vercel me-rewrite /api/* dan /manus-oauth/* ke /api?sfpath=<path asli>.
// Bangun ulang req.url agar router server melihat path aslinya kembali.
const rebuildUrl = (request) => {
    const parsed = new URL(request.url ?? '/', 'http://localhost');
    const original = parsed.searchParams.get('sfpath');
    if (original === null)
        return;
    parsed.searchParams.delete('sfpath');
    const query = parsed.searchParams.toString();
    request.url = original + (query ? `?${query}` : '');
};
// Vercel sudah mem-parse body ke req.body/req.rawBody sehingga stream bisa
// habis; sedangkan server membaca body lewat stream. Sediakan body cadangan.
const serializeBody = (request) => {
    if (typeof request.rawBody === 'string')
        return request.rawBody;
    const body = request.body;
    if (typeof body === 'string')
        return body;
    if (body && typeof body === 'object')
        return JSON.stringify(body);
    return null;
};
const withBody = (request, raw) => {
    const proxy = Object.create(request);
    Object.defineProperty(proxy, Symbol.asyncIterator, {
        configurable: true,
        value: async function* () {
            yield Buffer.from(raw, 'utf8');
        },
    });
    return proxy;
};
export async function handleVercelRequest(request, response) {
    rebuildUrl(request);
    const raw = serializeBody(request);
    await handleSupportFlowApi(raw === null ? request : withBody(request, raw), response);
}
