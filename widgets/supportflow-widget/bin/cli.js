#!/usr/bin/env node
'use strict'

// supportflow-widget init — CLI instalasi interaktif.
// Menanyakan base URL, conversation id, lalu: semua endpoint ATAU endpoint tertentu.

const { writeFile, access } = require('node:fs/promises')
const { constants } = require('node:fs')
const path = require('node:path')
const readline = require('node:readline')
const { stdin: input, stdout: output } = require('node:process')

const { CATALOG } = require('../src/widget.js')

const HELP = `supportflow-widget init — instalasi widget SupportFlow ke project lain

Penggunaan:
  npx supportflow-widget init [opsi]

Opsi:
  --yes, -y            Jawab semua pertanyaan dengan default (non-interaktif)
  --base-url=<url>     Base URL backend SupportFlow
  --conversation=<id>  Conversation ID (default: dibuat otomatis)
  --endpoints=<list>   "all" atau daftar id dipisah koma (contoh: chat,history)
  --title=<nama>       Judul widget
  --color=<hex>        Warna aksen
  --out=<path>         Path config yang ditulis (default: ./supportflow-widget.config.json)
  --help, -h           Tampilkan bantuan ini
`

function parseArgs(argv) {
  const options = { yes: false, out: 'supportflow-widget.config.json' }
  for (const arg of argv) {
    if (arg === '--yes' || arg === '-y') options.yes = true
    else if (arg === '--help' || arg === '-h') options.help = true
    else if (arg.startsWith('--base-url=')) options.baseUrl = arg.slice('--base-url='.length)
    else if (arg.startsWith('--conversation=')) options.conversationId = arg.slice('--conversation='.length)
    else if (arg.startsWith('--endpoints=')) options.endpoints = arg.slice('--endpoints='.length)
    else if (arg.startsWith('--title=')) options.title = arg.slice('--title='.length)
    else if (arg.startsWith('--color=')) options.color = arg.slice('--color='.length)
    else if (arg.startsWith('--out=')) options.out = arg.slice('--out='.length)
    else throw new Error(`Opsi tidak dikenal: ${arg}`)
  }
  return options
}

const DEFAULTS = {
  baseUrl: 'http://localhost:3000',
  title: 'SupportFlow',
  color: '#4263eb'
}

function generateConversationId() {
  return `sfw-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
}

function printCatalog() {
  console.log('\nPilih endpoint yang BOLEH dipakai widget (balas dengan nomor, pisahkan koma):')
  CATALOG.forEach((entry, index) => {
    console.log(`  ${index + 1}. ${entry.label}`)
    console.log(`     ${entry.method} ${entry.path} — ${entry.enables}`)
  })
}

function parseEndpointSelection(raw) {
  const numbers = raw.split(/[\s,]+/).filter(Boolean).map(Number)
  if (!numbers.length || numbers.some((value) => !Number.isInteger(value) || value < 1 || value > CATALOG.length)) {
    throw new Error(`Pilihan tidak valid. Masukkan nomor 1-${CATALOG.length}, pisahkan koma (contoh: 1,2)`)
  }
  const selected = [...new Set(numbers)].sort((a, b) => a - b).map((value) => CATALOG[value - 1].id)
  if (!selected.includes('chat')) {
    console.log('\n  Catatan: tanpa endpoint "chat", widget hanya menampilkan notifikasi (pengiriman pesan nonaktif).')
  }
  return selected
}

function normalizeEndpointsFlag(raw) {
  if (raw === 'all' || raw === '*') return '*'
  const ids = raw.split(',').map((value) => value.trim()).filter(Boolean)
  const unknown = ids.filter((id) => !CATALOG.some((entry) => entry.id === id))
  if (unknown.length) throw new Error(`Endpoint tidak dikenal: ${unknown.join(', ')}. Pilihan: ${CATALOG.map((e) => e.id).join(', ')} atau "all"`)
  if (!ids.length) throw new Error('Daftar endpoint kosong')
  return ids
}

function validateUrl(value) {
  let parsed
  try { parsed = new URL(value) } catch { throw new Error(`URL tidak valid: ${value}`) }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`URL harus http/https: ${value}`)
  return value.replace(/\/+$/, '')
}

function validateColor(value) {
  if (!/^#[0-9a-fA-F]{6}$/.test(value)) throw new Error(`Warna harus format HEX 6 digit (contoh: #4263eb), diterima: ${value}`)
  return value
}

// Pakai async iterator (bukan rl.question) supaya jawaban dari pipa stdin tidak hilang
// saat semua baris datang sekaligus, dan EOF memberi pesan error, bukan exit diam-diam.
function makeAsk(rl) {
  const iterator = rl[Symbol.asyncIterator]()
  return async function ask(question, fallback) {
    output.write(question)
    const next = await iterator.next()
    if (next.done) throw new Error('Input berakhir sebelum konfigurasi selesai.')
    const answer = String(next.value ?? '').trim()
    return answer || fallback
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(HELP)
    return
  }

  const config = {
    baseUrl: DEFAULTS.baseUrl,
    conversationId: '',
    title: DEFAULTS.title,
    accentColor: DEFAULTS.color,
    endpoints: '*'
  }

  if (options.yes) {
    if (options.baseUrl) config.baseUrl = validateUrl(options.baseUrl)
    if (options.conversationId) config.conversationId = options.conversationId
    if (options.title) config.title = options.title
    if (options.color) config.accentColor = validateColor(options.color)
    if (options.endpoints) config.endpoints = normalizeEndpointsFlag(options.endpoints)
  } else {
    console.log('SupportFlow widget — instalasi interaktif\n')
    const rl = readline.createInterface({ input, output })
    const ask = makeAsk(rl)
    try {
      config.baseUrl = validateUrl(await ask(`Base URL backend SupportFlow [${DEFAULTS.baseUrl}]: `, DEFAULTS.baseUrl))
      config.conversationId = await ask('Conversation ID (kosongkan untuk otomatis): ', '')
      config.title = await ask(`Judul widget [${DEFAULTS.title}]: `, DEFAULTS.title)
      config.accentColor = validateColor(await ask(`Warna aksen HEX [${DEFAULTS.color}]: `, DEFAULTS.color))

      console.log('\nEndpoint yang boleh dipakai widget:')
      console.log('  1. Semua endpoint')
      console.log('  2. Pilih endpoint tertentu')
      const mode = await ask('Pilih [1]: ', '1')
      if (mode === '2') {
        printCatalog()
        config.endpoints = parseEndpointSelection(await ask('Nomor endpoint: ', ''))
      } else if (mode !== '1') {
        throw new Error(`Pilihan tidak valid: ${mode} (harus 1 atau 2)`)
      }
    } finally {
      rl.close()
    }
  }

  if (!config.conversationId) config.conversationId = generateConversationId()

  const outPath = path.resolve(process.cwd(), options.out)
  try {
    await access(outPath, constants.F_OK)
    console.log(`\nCatatan: ${options.out} sudah ada dan akan ditimpa.`)
  } catch { /* file baru */ }
  await writeFile(outPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')

  const endpointSummary = config.endpoints === '*'
    ? `semua endpoint (${CATALOG.map((entry) => entry.id).join(', ')})`
    : config.endpoints.join(', ')

  console.log(`\n✔ Config ditulis ke ${options.out}`)
  console.log(`  baseUrl      : ${config.baseUrl}`)
  console.log(`  conversation : ${config.conversationId}`)
  console.log(`  endpoints    : ${endpointSummary}`)
  console.log(`  judul/warna  : ${config.title} · ${config.accentColor}`)

  const configLiteral = JSON.stringify(config, null, 2)
  console.log(`\nCara pakai di project tujuan:\n`)
  console.log(`1. Install paketnya:`)
  console.log(`     npm install supportflow-widget   # atau: pnpm add supportflow-widget`)
  console.log(`\n2a. Lewat script tag (HTML apa pun):`)
  console.log(`     <script src="https://unpkg.com/supportflow-widget/src/widget.js"></script>`)
  console.log(`     <script>window.SUPPORTFLOW_WIDGET_CONFIG = ${compact(configLiteral)};</script>`)
  console.log(`\n2b. Lewat JS (React/Vue/Next, panggil setelah DOM siap):`)
  console.log(`     const SupportFlowWidget = require('supportflow-widget')`)
  console.log(`     // import SupportFlowWidget from 'supportflow-widget' (di bundler ESM)`)
  console.log(`     SupportFlowWidget.init(${compact(configLiteral)})`)
  console.log(`\nConfig juga tersimpan di ${options.out} agar bisa dimuat ulang saat init berikutnya.`)
}

function compact(json) {
  return json.replace(/\n\s*/g, ' ')
}

main().catch((error) => {
  console.error(`\n✖ ${error instanceof Error ? error.message : error}`)
  process.exitCode = 1
})
