# SupportFlow

> Dashboard operasi dukungan pelanggan berbasis AI — satu inbox untuk WhatsApp, Instagram, dan web chat, dengan balasan AI yang berbasis Knowledge Base, kontrol *human handoff*, widget chat, dan analitik.

![Landing](public/supportflow-logo.svg)

## ✨ Fitur

- **Inbox multi-kanal** — WhatsApp, Instagram, dan web chat dalam satu antrean percakapan.
- **AI CS berbasis Knowledge Base** — jawaban digenerate LLM dengan system prompt yang dibangun dari `server/knowledge-base.js`; jika LLM tidak tersedia, ada mesin jawab deterministik dari Knowledge Base yang sama.
- **Human handoff otomatis** — deteksi eskalasi di sisi server (pola regex) + marker `[[ESCALATE_TO_HUMAN]]` dari LLM, dengan status percakapan `AI | HUMAN_HANDOFF | RESOLVED`.
- **Widget chat live di landing page** — bubble melayang di pojok kanan bawah yang terhubung ke `POST /api/chat/public`, dengan riwayat per-pengunjung (ID percakapan disimpan di localStorage) dan indikasi *human handoff*.
- **Knowledge base editor, widget preview, dan analytics** di dalam dashboard.
- **Autentikasi** — registrasi/login email + password (scrypt, session JWT HttpOnly), login Google OAuth, dan Manus OAuth.
- **Webhook WhatsApp Cloud API** — verifikasi `hub.challenge`, validasi signature `x-hub-signature-256`, auto-reply opsional.
- **Persistensi Turso (LibSQL)** — percakapan, pesan, status, dan pengguna tersimpan di database.

## 🧱 Teknologi

| Bagian | Teknologi |
|---|---|
| Frontend | React + Vite + TypeScript, lucide-react, CSS kustom (`src/styles.css`) |
| Backend | Node.js murni tanpa framework — `server/index.ts` (dev) dan `server/production.js` (prod) |
| Database | Turso / LibSQL via `@libsql/client` |
| LLM | API kompatibel OpenAI (`MANUS_API_URL`), model `gpt-5-mini` — opsional |
| RAG service | FastAPI boilerplate di `python-ai-service/` (opsional, belum terhubung) |
| Docker | `Dockerfile` (node:22-alpine, pnpm, multi-step build) |

## 📋 Prasyarat

- **Node.js 20+** (disarankan 22 — sama seperti Dockerfile).
- **pnpm 10** — otomatis diaktifkan lewat `corepack` oleh script; jika gagal, script fallback ke `npm`.
- **Akun Turso** (gratis di [turso.tech](https://turso.tech)) untuk database & autentikasi.
- **Docker** (opsional, hanya untuk `./run.sh docker`).

## 🚀 Cara Menjalankan (paling cepat)

```bash
./run.sh          # mode development (hot-reload) → http://localhost:3000
./run.sh prod     # build produksi lalu jalankan server produksi
./run.sh help     # lihat semua perintah
```

> **Pengguna Windows:** jalankan lewat **Git Bash** (`bash run.sh`), atau klik `run.cmd` / ketik `run.cmd dev` di cmd/PowerShell.

Ganti port bila 3000 dipakai: `PORT=3001 ./run.sh dev`

### Semua perintah script

| Perintah | Fungsi |
|---|---|
| `./run.sh` atau `./run.sh dev` | Mode development: Vite dev server + API middleware di port 3000 |
| `./run.sh prod` | `pnpm build` lalu jalankan server produksi |
| `./run.sh build` | Hanya build produksi (`tsc -b && vite build`) |
| `./run.sh start` | Jalankan server produksi tanpa build ulang |
| `./run.sh typecheck` | Pemeriksaan TypeScript (`tsc --noEmit`) |
| `./run.sh docker` | Build image & jalankan container di `$PORT:3000` |
| `./run.sh health` | Cek `GET /api/health` |
| `./run.sh help` | Bantuan |

Script otomatis: memasang dependencies bila `node_modules` belum ada, membuat `.env` dari `.env.example` bila belum ada, dan memberi peringatan bila port sudah dipakai.

## ⚙️ Konfigurasi Environment

```bash
cp .env.example .env   # juga dilakukan otomatis oleh run.sh
```

### Wajib (fitur inti)

| Variabel | Fungsi |
|---|---|
| `TURSO_DATABASE_URL` | URL database LibSQL, format `libsql://...` |
| `TURSO_AUTH_TOKEN` | Token akses database |
| `MANUS_JWT_SECRET` | String acak untuk menandatangani session JWT (bisa isi acak panjang untuk lokal) |

Tanpa tiga nilai di atas aplikasi tetap bisa dibuka, tetapi `database: false` di health check dan registrasi/login/persistensi gagal.

Cara mendapat kredensial Turso (via CLI):

```bash
turso db create supportflow
turso db show supportflow --url      # → TURSO_DATABASE_URL
turso db tokens create supportflow   # → TURSO_AUTH_TOKEN
```

### Opsional

| Variabel | Fungsi |
|---|---|
| `MANUS_API_URL`, `MANUS_API_KEY` | LLM terkelola; jika kosong, jawaban memakai fallback Knowledge Base |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Login dengan Google (redirect URI: `http://localhost:3000/api/auth/google/callback`) |
| `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN` | Integrasi WhatsApp Cloud API |
| `META_APP_SECRET` | Validasi signature webhook Meta |
| `WHATSAPP_AUTO_REPLY` | `true` untuk membalas pesan masuk otomatis (default nonaktif) |
| `PORT` | Port server produksi (default `3000`) |

## 🔍 Verifikasi

Setelah server berjalan:

```bash
curl http://localhost:3000/api/health
```

Contoh respons:

```json
{"ok":true,"service":"supportflow-web","status":"operational","llm":true,"auth":true,"database":true,"whatsapp":false}
```

- `database: true` → Turso terhubung (skema dibuat otomatis pada request pertama).
- `llm: false` → AI memakai fallback Knowledge Base, bukan LLM.
- `whatsapp: false` → Webhook WhatsApp belum dikonfigurasi (opsional).

Buka `http://localhost:3000` untuk landing page, `/register` untuk membuat akun, dan `/app` untuk dashboard.

## 🛠️ Menjalankan Manual (tanpa script)

```bash
pnpm install --frozen-lockfile

# Development (frontend + API dalam satu server Vite)
pnpm dev

# Produksi
pnpm build
pnpm start          # menjalankan node server/production.js
```

- **Dev**: Vite menyajikan SPA dan memasang API (`server/index.ts`) sebagai middleware — semua di port 3000.
- **Prod**: `server/production.js` menyajikan folder `dist/` + endpoint `/api/*` dan `/manus-oauth/*` di `$PORT`.

## 🐳 Docker

```bash
docker build -t supportflow .
docker run --rm -p 3000:3000 --env-file .env supportflow
```

## 🐍 Layanan RAG Python (opsional)

`python-ai-service/` adalah boilerplate FastAPI untuk ingestion dokumen dan jawaban ber-grounding (RAG) — belum terhubung ke alur utama. Untuk mencobanya:

```bash
cd python-ai-service
pip install fastapi uvicorn python-multipart
uvicorn main:app --reload --port 8000
# Health: http://localhost:8000/api/v1/health
```

## 📡 Endpoint API Utama

| Method & Path | Fungsi |
|---|---|
| `GET /api/health` | Status layanan (llm, auth, database, whatsapp) |
| `POST /api/auth/register` / `POST /api/auth/login` | Registrasi & login email + password |
| `GET /api/auth/providers` | Daftar metode login yang aktif |
| `GET /api/auth/google/start` → `/api/auth/google/callback` | Login Google OAuth |
| `GET /api/auth/start` → `/manus-oauth/callback` | Login Manus OAuth |
| `POST /api/chat/public` | Kirim pesan ke AI CS (dengan status & confidence) |
| `GET /api/chat/public/history` | Riwayat percakapan widget |
| `GET /api/conversations` | Daftar percakapan + status (khusus sesi login) |
| `POST /api/channels/whatsapp/send` | Kirim pesan WhatsApp keluar (butuh login) |
| `GET/POST /api/webhooks/whatsapp` (alias `/api/webhooks/meta`) | Verifikasi & webhook WhatsApp |

Dokumentasi lebih lanjut: [`docs/API.md`](docs/API.md) dan [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## 📁 Struktur Proyek

```
├── run.sh / run.cmd          # Script launcher (buat menjalankan aplikasi)
├── package.json              # Script pnpm: dev, build, start, typecheck
├── vite.config.ts            # Konfigurasi Vite + middleware API mode dev
├── index.html                # Entry HTML
├── src/                      # Aplikasi React (dashboard, marketing, auth)
│   ├── App.tsx               # Dashboard: inbox, KB, widget, analytics
│   ├── Marketing.tsx         # Landing (termasuk chat widget), login, register, callback
│   └── styles.css            # Sistem visual responsif
├── server/
│   ├── index.ts/.js          # Seluruh endpoint API (chat, auth, webhook, dll.)
│   ├── auth.js               # Register/login email, Google OAuth, session JWT
│   ├── knowledge-base.js     # Knowledge Base resmi + aturan eskalasi + fallback
│   └── production.js         # Server produksi (dist/ + API)
├── python-ai-service/        # FastAPI RAG boilerplate (opsional)
├── docs/                     # API.md dan DEPLOYMENT.md
├── Dockerfile
└── .env.example              # Template konfigurasi environment
```

## 🚢 Deployment Produksi

Ringkasan: build dengan `pnpm build`, jalankan `node server/production.js` di `0.0.0.0:$PORT`, pastikan routing mengarahkan `/api/*` dan `/manus-oauth/*` ke server (bukan static SPA), lalu verifikasi `/api/health`. Panduan lengkap (OAuth produksi, Turso, aktivasi WhatsApp, checklist rilis): **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

## 🧯 Troubleshooting

| Masalah | Solusi |
|---|---|
| `Port 3000 sudah dipakai` | Jalankan `PORT=3001 ./run.sh dev`, atau matikan proses yang memakai port 3000 |
| `database: false` di health | Periksa `TURSO_DATABASE_URL` & `TURSO_AUTH_TOKEN` di `.env`, lalu restart server |
| Registrasi/login gagal "Session secret belum dikonfigurasi" | Isi `MANUS_JWT_SECRET` di `.env` (string acak apa pun untuk lokal) |
| Jawaban AI selalu generik / tidak dinamis | `MANUS_API_URL`/`MANUS_API_KEY` kosong — aplikasi memakai fallback Knowledge Base |
| `pnpm: command not found` | Jalankan `corepack enable`, atau biarkan `run.sh` memakai `npm` |
| Membangun ulang setelah mengubah kode server | Mode dev otomatis (Vite); mode produksi perlu `./run.sh build` ulang |
