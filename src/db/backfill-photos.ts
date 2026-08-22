/**
 * เติม path รูปจริง + จำนวนสต๊อกให้สินค้าที่มีอยู่แล้ว (จับคู่ตามชื่อ)
 * รันด้วย: npx tsx src/db/backfill-photos.ts
 */
import { eq } from "drizzle-orm";
import { count } from "drizzle-orm";
import { db } from "./index";
import { expenses, products } from "./schema";
import { SEED_EXPENSES, SEED_PRODUCTS } from "./seed-data";

let updated = 0;
for (const p of SEED_PRODUCTS) {
  const res = await db
    .update(products)
    .set({ photo: p.photo ?? null })
    .where(eq(products.name, p.name))
    .run();
  if (res.rowsAffected > 0) updated += res.rowsAffected;
}
console.log(`✅ เติมรูปให้สินค้า ${updated} รายการ`);

// ใส่รายจ่ายตัวอย่างถ้ายังไม่มี
const ec = await db.select({ c: count() }).from(expenses).get();
if (!ec || ec.c === 0) {
  await db.insert(expenses).values(SEED_EXPENSES).run();
  console.log(`✅ ใส่รายจ่ายตัวอย่าง ${SEED_EXPENSES.length} รายการ`);
}
process.exit(0);
