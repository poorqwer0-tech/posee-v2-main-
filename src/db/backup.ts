/**
 * สำรองฐานข้อมูล (รันด้วย `npm run backup`)
 * - ใช้ `VACUUM INTO` สร้าง snapshot ที่ consistent (ปลอดภัยกว่า copy ไฟล์ดิบตอนกำลังเขียน)
 * - เก็บไว้ใน `backups/pos-YYYYMMDD-HHmmss.db` แล้วเก็บแค่ N ไฟล์ล่าสุด (BACKUP_KEEP, default 14)
 * - ตรวจว่า snapshot เปิดได้จริง (นับตาราง) ก่อนถือว่าสำเร็จ
 *
 * เหมาะกับโหมด **local** (DATABASE_URL=file:...). โหมด cloud (Turso) ใช้ backup ของ Turso เอง
 * อัปขึ้น Drive/R2: ต่อท้ายด้วย rclone (ดู docs/backup.md) — สคริปต์นี้โฟกัสสร้าง snapshot ที่กู้ได้
 */
import { createClient } from "@libsql/client";
import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { resolve, join } from "node:path";

async function main() {
  const raw = process.env.DATABASE_URL || "file:sqlite.db";
  if (!(raw.startsWith("file:") || (!raw.includes("://") && raw.endsWith(".db")))) {
    console.error(
      `backup: DATABASE_URL ไม่ใช่ไฟล์ SQLite (${raw}) — โหมด cloud/Turso ให้ใช้ backup ของ Turso แทน`,
    );
    process.exit(1);
  }
  const dbPath = raw.replace(/^file:/, "");

  const backupDir = resolve(process.env.BACKUP_DIR || "backups");
  const keep = Math.max(1, Number(process.env.BACKUP_KEEP) || 14);
  mkdirSync(backupDir, { recursive: true });

  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "-")
    .slice(0, 15); // YYYYMMDD-HHmmss
  const outPath = join(backupDir, `pos-${stamp}.db`);

  const client = createClient({ url: `file:${dbPath}` });

  // VACUUM INTO ต้องใช้ path ที่ escape single-quote
  const safeOut = outPath.replace(/'/g, "''");
  await client.execute(`VACUUM INTO '${safeOut}'`);

  // ตรวจว่า snapshot เปิดได้ + มีตาราง (กัน backup เสียเงียบๆ)
  const check = createClient({ url: `file:${outPath}` });
  const tables = await check.execute(
    "SELECT count(*) AS n FROM sqlite_master WHERE type='table'",
  );
  const n = Number(tables.rows[0]?.n ?? 0);
  if (n === 0) {
    console.error(`backup: snapshot ${outPath} ไม่มีตาราง — น่าจะเสีย`);
    process.exit(1);
  }

  // เก็บแค่ N ไฟล์ล่าสุด
  const files = readdirSync(backupDir)
    .filter((f) => /^pos-\d{8}-\d{6}\.db$/.test(f))
    .map((f) => ({ f, t: statSync(join(backupDir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const { f } of files.slice(keep)) unlinkSync(join(backupDir, f));

  const sizeKb = Math.round(statSync(outPath).size / 1024);
  console.log(
    `✓ backup: ${outPath} (${n} ตาราง, ${sizeKb} KB) · เก็บ ${Math.min(files.length, keep)} ไฟล์`,
  );
}

main().catch((e) => {
  console.error("backup ล้มเหลว:", e);
  process.exit(1);
});
