# scripts/ — รัน POS แบบ local (เครื่องในร้าน)

สคริปต์ช่วยรัน + auto-start + backup สำหรับโหมด **local/single** (ไม่เกี่ยวกับ cloud/Vercel).
ภาพรวมการติดตั้งอยู่ที่ root `CLAUDE.md`; ที่นี่คือรายละเอียดของ ops.

| ไฟล์ | ทำอะไร |
|---|---|
| `start-local.sh` | build (ถ้ายังไม่มี) + copy static/public + รัน standalone bind `0.0.0.0`. อ่าน `.env` |
| `backup-and-upload.sh` | `npm run backup` (snapshot) + อัป rclone → คลาวด์ + ping healthcheck (สำหรับ cron) |
| `pos.service.example` | systemd unit — auto-start บน Linux mini-PC |
| `com.pos.server.plist.example` | launchd — auto-start บน macOS |

## รันเร็ว (ทดสอบ)

```bash
cp .env.example .env
# แก้ .env: DATABASE_URL=file:sqlite.db, POS_AUTH_TOKEN=$(openssl rand -hex 32)
npm install && npm run db:push
./scripts/start-local.sh        # → http://<ip เครื่อง>:3000
```

## auto-start (reboot/crash เด้งเอง)

- **Linux:** แก้ path ใน `pos.service.example` → คัดลอกไป `/etc/systemd/system/pos.service` → `systemctl enable --now pos`
- **macOS:** แก้ path ใน `com.pos.server.plist.example` → คัดลอกไป `~/Library/LaunchAgents/` → `launchctl load …`

ทั้งคู่ตั้ง restart-on-crash ให้แล้ว (systemd `Restart=always` / launchd `KeepAlive`).

## auto-backup (cron)

```cron
# ทุกชั่วโมง — snapshot + อัปคลาวด์ + ping monitoring
0 * * * * cd /path/to/pos && RCLONE_REMOTE=drive:pos-backups HEALTHCHECK_URL=https://hc-ping.com/xxx ./scripts/backup-and-upload.sh >> /tmp/pos-backup.log 2>&1
```

ตั้ง `rclone config` ครั้งเดียวก่อน (Google Drive / R2 / S3). ดูรายละเอียด restore ที่ `docs/backup.md`.

## tunnel (ลูกค้าสแกน 4G)

ไม่ได้อยู่ในสคริปต์นี้ (ต้อง login บัญชีเอง) — ดู `CLAUDE.md` หัวข้อ Local:
`tailscale up` → `tailscale funnel --bg 3000` → เอา URL ไปทำ QR โต๊ะ.
