#!/usr/bin/env node
'use strict'

// Static server mini untuk halaman demo (tanpa dependensi).
// Jalankan: node demo/serve.js  →  http://localhost:8080

const http = require('node:http')
const { createReadStream, existsSync, statSync } = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const port = Number(process.env.DEMO_PORT || 8080)
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
}

http.createServer((request, response) => {
  const urlPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  let filePath = path.join(root, urlPath === '/' ? '/demo/index.html' : urlPath)
  if (!filePath.startsWith(root)) {
    response.writeHead(403).end('Forbidden')
    return
  }
  if (existsSync(filePath) && statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html')
  if (!existsSync(filePath)) {
    response.writeHead(404).end('Not found')
    return
  }
  response.writeHead(200, { 'content-type': types[path.extname(filePath)] || 'application/octet-stream' })
  createReadStream(filePath).pipe(response)
}).listen(port, () => {
  console.log(`Demo berjalan di http://localhost:${port}/demo/index.html`)
})
