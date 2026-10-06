import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleSupportFlowApi } from './index.js'

// Loader .env sederhana (tanpa dependency) agar TURSO_* dkk. terbaca saat `npm start`
try {
  const { readFileSync } = await import('node:fs')
  const envPath = resolve(fileURLToPath(new URL('../.env', import.meta.url)))
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match || line.trim().startsWith('#')) continue
    const key = match[1]
    const value = match[2].replace(/^['"]|['"]$/g, '')
    if (!(key in process.env)) process.env[key] = value
  }
} catch { /* .env opsional */ }

const distRoot = resolve(fileURLToPath(new URL('../dist', import.meta.url)))
const mimeTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
}

const serveFile = async (path: string, response: import('node:http').ServerResponse) => {
  const body = await readFile(path)
  response.statusCode = 200
  response.setHeader('content-type', mimeTypes[extname(path)] ?? 'application/octet-stream')
  response.setHeader('cache-control', path.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache')
  response.end(body)
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost')
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/manus-oauth/')) {
    try { await handleSupportFlowApi(request, response) } catch { if (!response.headersSent) { response.statusCode = 500; response.setHeader('content-type', 'application/json; charset=utf-8'); response.end(JSON.stringify({ error: 'Unexpected server error' })) } }
    return
  }

  try {
    const requested = decodeURIComponent(url.pathname)
    const relative = requested === '/' ? 'index.html' : requested.replace(/^\//, '')
    const candidate = resolve(distRoot, relative)
    if (!candidate.startsWith(distRoot)) { response.statusCode = 400; return response.end('Bad request') }
    try { await serveFile(candidate, response) } catch {
      if (!extname(requested)) await serveFile(resolve(distRoot, 'index.html'), response)
      else { response.statusCode = 404; response.end('Not found') }
    }
  } catch { response.statusCode = 400; response.end('Bad request') }
})

const port = Number(process.env.PORT ?? 3000)
server.listen(port, '0.0.0.0', () => console.log(`SupportFlow production server listening on ${port}`))
