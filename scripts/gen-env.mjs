#!/usr/bin/env node
// สร้าง .env ให้อัตโนมัติ — สุ่ม POS_AUTH_TOKEN ให้เอง, เติม DB จาก args/env ถ้ามี
// ใช้: node scripts/gen-env.mjs [--force]
//   ค่า DB (ถ้ามี) ส่งผ่าน env ตอนรัน เช่น
//   DATABASE_URL=libsql://x.turso.io DATABASE_AUTH_TOKEN=xxx node scripts/gen-env.mjs
//
// เจตนา: ไม่ต้องตั้งรหัสแอดมินใน env — ตั้งที่หน้า /setup ตอนเปิดร้านครั้งแรก
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const force = process.argv.includes("--force");
const envPath = resolve(process.cwd(), ".env");

if (existsSync(envPath) && !force) {
  console.error("มี .env อยู่แล้ว — ไม่เขียนทับ (ใช้ --force ถ้าต้องการสร้างใหม่)");
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL || "file:sqlite.db";
const dbToken = process.env.DATABASE_AUTH_TOKEN || "";
const authToken = randomBytes(32).toString("hex"); // สุ่มใหม่ทุกครั้ง — กันปลอม cookie

const contents = `# สร้างอัตโนมัติโดย scripts/gen-env.mjs — POS_AUTH_TOKEN สุ่มให้แล้ว
# รหัสแอดมิน "ไม่" ตั้งที่นี่ — ตั้งที่หน้า /setup ตอนเปิดร้านครั้งแรก
DATABASE_URL=${dbUrl}
DATABASE_AUTH_TOKEN=${dbToken}
POS_AUTH_TOKEN=${authToken}
`;

writeFileSync(envPath, contents, { mode: 0o600 });

console.log("✓ เขียน .env แล้ว (POS_AUTH_TOKEN สุ่มให้)");
console.log("");
console.log("── สำหรับ Vercel: copy 3 บรรทัดนี้ไปวางในหน้า Environment Variables ──");
console.log(`DATABASE_URL=${dbUrl}`);
console.log(`DATABASE_AUTH_TOKEN=${dbToken}`);
console.log(`POS_AUTH_TOKEN=${authToken}`);
console.log("──────────────────────────────────────────────────────────────");
console.log("รหัสแอดมิน: ตั้งที่หน้า /setup (ไม่ต้องใส่ env)");
