#!/usr/bin/env bash
# รัน POS แบบ local (standalone Node server) — สำหรับเครื่องในร้าน
# ใช้: ./scripts/start-local.sh   (อ่านค่าจาก .env, bind 0.0.0.0)
set -euo pipefail
cd "$(dirname "$0")/.."

# โหลด .env ถ้ามี (DATABASE_URL, POS_AUTH_TOKEN, PORT, ...)
if [ -f .env ]; then set -a; . ./.env; set +a; fi

PORT="${PORT:-3000}"
export HOSTNAME="0.0.0.0"   # สำคัญ: ต้อง bind ทุก interface ไม่งั้น LAN/Tailscale เข้าไม่ได้

# DATABASE_URL ต้องเป็น absolute path — Next standalone chdir ไป .next/standalone
# → relative "file:sqlite.db" จะเปิด/สร้าง DB ว่างในนั้น (ไม่ใช่ตัวที่ db:push ลงไว้) = 500 no such table
DB_URL="${DATABASE_URL:-file:$PWD/sqlite.db}"
case "$DB_URL" in
  file:/*) : ;;                                    # absolute อยู่แล้ว
  file:*)  DB_URL="file:$PWD/${DB_URL#file:}" ;;    # relative file → ทำเป็น absolute
esac
export DATABASE_URL="$DB_URL"

if [ -z "${POS_AUTH_TOKEN:-}" ]; then
  echo "❌ POS_AUTH_TOKEN ไม่ได้ตั้ง — สร้างด้วย: openssl rand -hex 32 แล้วใส่ใน .env" >&2
  exit 1
fi

# build ถ้ายังไม่มี standalone (หรือสั่ง REBUILD=1)
if [ "${REBUILD:-0}" = "1" ] || [ ! -f .next/standalone/server.js ]; then
  echo "→ building standalone…"
  npm run build
fi
# standalone ต้องมี static + public (Next ไม่ copy ให้เอง)
# rm ก่อน copy — ไม่งั้น re-run (auto-start/KeepAlive) จะ copy ซ้อนเป็น .../static/static แล้ว asset 404
rm -rf .next/standalone/.next/static .next/standalone/public
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

echo "→ POS running at http://0.0.0.0:$PORT  (DATABASE_URL=$DATABASE_URL)"
exec node .next/standalone/server.js
