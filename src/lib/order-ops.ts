/**
 * ตรรกะออเดอร์ที่ใช้ร่วมกันระหว่าง actions.ts (UI) และ restaurant-order-service.ts (API)
 * — รวมไว้ที่เดียวกันกันโค้ดซ้ำ drift (เดิมมี nextOrderNo/สถานะ/สต็อก คนละก๊อป)
 */
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { counters, ingredients, orders, recipeItems } from "@/db/schema";

// ---------- สถานะออเดอร์ (lifecycle ย่อ 2 ขั้น) ----------
// new = รับออเดอร์ (เข้าครัว/กำลังทำ) → ready = ทำเสร็จแล้ว
// paid = ปิดบิลโต๊ะแล้ว (terminal), cancelled = ยกเลิก (terminal)
export const ORDER_STATUSES = ["new", "ready", "paid", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const TERMINAL = new Set<string>(["paid", "cancelled"]);
export function isTerminalStatus(s: string): boolean {
  return TERMINAL.has(s);
}

/**
 * #4: กันสถานะมั่ว + กันแก้ออเดอร์ที่ปิดแล้ว (paid/cancelled)
 * - status ต้องเป็นค่าที่รู้จัก
 * - ออเดอร์ที่ปิดแล้ว เปลี่ยนต่อไม่ได้ (กันจอค้างดัน paid→cooking / ยอดเพี้ยน)
 */
export function validateStatusChange(
  current: string,
  next: string,
): { ok: true } | { ok: false; error: string } {
  if (!ORDER_STATUSES.includes(next as OrderStatus)) {
    return { ok: false, error: "สถานะไม่ถูกต้อง" };
  }
  if (TERMINAL.has(current) && current !== next) {
    return { ok: false, error: "ออเดอร์นี้ปิดแล้ว เปลี่ยนสถานะไม่ได้" };
  }
  return { ok: true };
}

// ---------- #3: เลขบิลแบบ atomic (กันชนกันหลายเครื่อง) ----------
const ORDER_NO_KEY = "order_no";
const ORDER_NO_BASE = 1042; // เริ่มที่ A1043 (คงรูปแบบเดิม)

/** ให้แน่ใจว่ามีแถวตัวนับเลขบิล (เรียกจาก ensureSeeded) — init จาก max เดิมถ้ามีออเดอร์อยู่แล้ว */
export async function ensureOrderCounter(): Promise<void> {
  const existing = await db.select().from(counters).where(eq(counters.name, ORDER_NO_KEY)).get();
  if (existing) return;
  const rows = await db.select({ orderNo: orders.orderNo }).from(orders).all();
  let max = ORDER_NO_BASE;
  for (const r of rows) {
    const n = parseInt(r.orderNo.replace(/[^0-9]/g, ""), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  await db.insert(counters).values({ name: ORDER_NO_KEY, value: max }).onConflictDoNothing().run();
}

/** เลขบิลถัดไป — UPDATE ... RETURNING เป็น atomic (SQLite serialize ต่อแถว) = ไม่ชนกัน */
export async function nextOrderNo(): Promise<string> {
  const row = await db
    .update(counters)
    .set({ value: sql`${counters.value} + 1` })
    .where(eq(counters.name, ORDER_NO_KEY))
    .returning({ v: counters.value })
    .get();
  if (row) return "A" + row.v;
  // แถวหาย (ไม่ควรเกิดหลัง ensureSeeded) — สร้างแล้วลองใหม่
  await ensureOrderCounter();
  const retry = await db
    .update(counters)
    .set({ value: sql`${counters.value} + 1` })
    .where(eq(counters.name, ORDER_NO_KEY))
    .returning({ v: counters.value })
    .get();
  return "A" + (retry?.v ?? ORDER_NO_BASE + 1);
}

// ---------- #2: หัก/คืนสต็อกวัตถุดิบตามสูตร ----------
/**
 * ปรับสต็อกวัตถุดิบตามสูตรของแต่ละเมนู
 * @param dir -1 = หัก (ตอนสั่ง), +1 = คืน (ตอนยกเลิก). ไม่มีสูตร = no-op (ร้านที่ไม่ใช้สต็อก)
 */
export async function applyRecipeStock(
  items: { productId: number | null; qty: number }[],
  dir: 1 | -1,
): Promise<void> {
  for (const it of items) {
    if (it.productId == null) continue; // เมนูถูกลบไปแล้ว (denormalized) — ไม่มีสูตรให้ปรับ
    const recs = await db
      .select()
      .from(recipeItems)
      .where(eq(recipeItems.productId, it.productId))
      .all();
    for (const r of recs) {
      const delta = r.qty * it.qty * dir;
      await db
        .update(ingredients)
        .set({ stock: sql`MAX(0, ${ingredients.stock} + ${delta})` })
        .where(eq(ingredients.id, r.ingredientId))
        .run();
    }
  }
}
