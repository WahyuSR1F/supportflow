#!/usr/bin/env bash
# =============================================================================
# SupportFlow — Launcher aplikasi
#
# Pemakaian:
#   ./run.sh              Jalankan mode development (hot-reload) → http://localhost:3000
#   ./run.sh dev          Sama dengan perintah di atas
#   ./run.sh prod         Build frontend lalu jalankan server produksi
#   ./run.sh build        Hanya build produksi (tsc -b && vite build)
#   ./run.sh start        Jalankan server produksi (butuh folder dist/)
#   ./run.sh typecheck    Jalankan pemeriksaan TypeScript (tsc --noEmit)
#   ./run.sh docker       Build image Docker lalu jalankan container
#   ./run.sh health       Cek GET /api/health pada port aktif
#   ./run.sh help         Tampilkan bantuan
#
# Port bisa diganti lewat variabel PORT, contoh: PORT=3001 ./run.sh
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

MODE="${1:-dev}"
PORT="${PORT:-3000}"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info() { printf "${GREEN}✔${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}⚠${NC} %s\n" "$1"; }
die()  { printf "${RED}✖ %s${NC}\n" "$1" >&2; exit 1; }

# --- Validasi port -----------------------------------------------------------
case "$PORT" in
  ''|*[!0-9]*) die "PORT harus berupa angka (diterima: '$PORT')" ;;
esac
[ "$PORT" -ge 1 ] && [ "$PORT" -le 65535 ] || die "PORT di luar rentang 1-65535"

# Deteksi port terpakai (bash /dev/tcp, tanpa dependency)
port_in_use() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

# --- Persiapan runtime (Node, package manager, .env, dependencies) -----------
prepare_runtime() {
  command -v node >/dev/null 2>&1 \
    || die "Node.js tidak ditemukan. Install Node.js 20+ dari https://nodejs.org"
  info "Node $(node --version)"

  PM=""
  if command -v pnpm >/dev/null 2>&1; then
    PM="pnpm"
  else
    if command -v corepack >/dev/null 2>&1; then
      warn "pnpm tidak ditemukan — mencoba mengaktifkan via corepack..."
      corepack enable >/dev/null 2>&1 || true
      corepack prepare pnpm@10.14.0 --activate >/dev/null 2>&1 || true
    fi
    if command -v pnpm >/dev/null 2>&1; then
      PM="pnpm"
    else
      PM="npm"
      warn "pnpm tetap tidak tersedia — memakai npm sebagai fallback."
    fi
  fi
  info "Package manager: $PM"

  if [ ! -f .env ] && [ -f .env.example ]; then
    cp .env.example .env
    warn "File .env belum ada — dibuat salinan dari .env.example."
    warn "Isi minimal TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, dan MANUS_JWT_SECRET agar fitur utama aktif."
  fi

  if [ ! -d node_modules ]; then
    info "Menginstall dependencies (hanya sekali di awal)..."
    if [ "$PM" = "pnpm" ]; then
      pnpm install --frozen-lockfile || pnpm install
    else
      npm install
    fi
    info "Dependencies terpasang."
  fi
}

# --- Perintah ----------------------------------------------------------------
run_dev() {
  if port_in_use "$PORT"; then
    die "Port $PORT sudah dipakai proses lain. Hentikan prosesnya atau jalankan: PORT=$((PORT + 1)) ./run.sh dev"
  fi
  info "Menjalankan mode development → http://localhost:$PORT"
  info "Tekan Ctrl+C untuk berhenti."
  if [ "$PORT" = "3000" ]; then
    exec "$PM" run dev
  else
    # Script "dev" di package.json mengunci port 3000; untuk port lain panggil vite langsung.
    exec "$PM" exec vite --host 0.0.0.0 --port "$PORT" --strictPort
  fi
}

run_build() {
  info "Membangun produksi (tsc -b && vite build)..."
  "$PM" run build
  info "Build selesai — output di folder dist/."
}

run_start() {
  [ -d dist ] || die "Folder dist/ belum ada. Jalankan dulu: ./run.sh build"
  if port_in_use "$PORT"; then
    die "Port $PORT sudah dipakai proses lain. Hentikan prosesnya atau jalankan: PORT=$((PORT + 1)) ./run.sh start"
  fi
  info "Menjalankan server produksi → http://localhost:$PORT"
  info "Tekan Ctrl+C untuk berhenti."
  PORT="$PORT" exec "$PM" start
}

run_prod() {
  run_build
  run_start
}

run_typecheck() {
  info "Menjalankan pemeriksaan TypeScript..."
  "$PM" run typecheck
  info "Typecheck lolos tanpa error."
}

run_docker() {
  command -v docker >/dev/null 2>&1 || die "Docker tidak ditemukan. Pastikan Docker Desktop/Engine berjalan."
  [ -f .env ] || warn "File .env tidak ada — container akan berjalan tanpa env (fitur database/LLM/auth nonaktif)."
  info "Membangun image Docker (bisa memakan beberapa menit)..."
  docker build -t supportflow:latest .
  info "Menjalankan container → http://localhost:$PORT"
  if [ -f .env ]; then
    exec docker run --rm -p "$PORT:3000" --env-file .env supportflow:latest
  else
    exec docker run --rm -p "$PORT:3000" supportflow:latest
  fi
}

run_health() {
  command -v curl >/dev/null 2>&1 || die "curl tidak ditemukan untuk pengecekan health."
  echo "→ GET http://localhost:$PORT/api/health"
  curl -s -m 5 "http://localhost:$PORT/api/health" \
    || die "Tidak bisa menghubungi http://localhost:$PORT/api/health — apakah servernya sudah berjalan?"
  echo
}

usage() {
  sed -n '2,16p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

# --- Router ------------------------------------------------------------------
case "$MODE" in
  dev|prod|build|start|typecheck)
    prepare_runtime
    "run_$MODE"
    ;;
  docker)  run_docker ;;
  health)  run_health ;;
  help|-h|--help) usage ;;
  *)
    usage
    die "Perintah tidak dikenal: '$MODE'"
    ;;
esac
