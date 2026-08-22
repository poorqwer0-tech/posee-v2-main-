/**
 * สคริปต์ใส่ข้อมูลตั้งต้น (รันด้วย `npm run db:seed`)
 * จะใส่ข้อมูลก็ต่อเมื่อฐานข้อมูลยังว่างเท่านั้น
 */
import { count } from "drizzle-orm";
import { db } from "./index";
import { products } from "./schema";
import { seedDatabase } from "./seed-data";

// ห่อใน main() — ไม่ใช้ top-level await เพราะ tsx/esbuild transform เป็น CJS แล้ว top-level await พัง
// (esbuild: "Top-level await is currently not supported with the cjs output format")
async function main() {
  const existing = await db.select({ c: count() }).from(products).get();

  if (existing && existing.c > 0) {
    console.log(`ℹ️  มีเมนูอยู่แล้ว ${existing.c} รายการ — ข้ามการ seed`);
  } else {
    await seedDatabase();
    console.log("✅ ใส่ข้อมูลตั้งต้นเรียบร้อย: เมนู 16 รายการ, บิลตัวอย่าง 5 บิล, ตั้งค่าร้าน");
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
