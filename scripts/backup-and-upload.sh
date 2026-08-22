#!/usr/bin/env bash
# สร้าง snapshot DB แล้วอัปขึ้นคลาวด์ (สำหรับ cron) — โหมด local เท่านั้น
# ใช้: ./scripts/backup-and-upload.sh
#   ตั้ง RCLONE_REMOTE=drive:pos-backups  (ถ้าอยากอัปคลาวด์; ไม่ตั้ง = snapshot ในเครื่องอย่างเดียว)
#   ตั้ง HEALTHCHECK_URL=https://hc-ping.com/xxx  (ถ้าอยาก ping monitoring เมื่อสำเร็จ)
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env ]; then set -a; . ./.env; set +a; fi

npm run backup   # src/db/backup.ts → backups/pos-*.db (+ verify + prune)

if [ -n "${RCLONE_REMOTE:-}" ]; then
  echo "→ uploading to $RCLONE_REMOTE"
  rclone copy backups/ "$RCLONE_REMOTE" --max-age 25h
fi

# ping monitoring ว่า backup ยังวิ่ง (ไม่งั้นพังเงียบ)
if [ -n "${HEALTHCHECK_URL:-}" ]; then
  curl -fsS -m 10 --retry 3 "$HEALTHCHECK_URL" >/dev/null || true
fi
