import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  orderItems,
  orders,
  paymentRequests,
  products,
  restaurantTables,
  settings,
  tableSessions,
} from "@/db/schema";
import { priceBand } from "@/lib/menu-options";
import { applyRecipeStock, nextOrderNo, validateStatusChange } from "@/lib/order-ops";

export type ApiCartLine = {
  id: number;
  name: string;
  emoji: string;
  price: number;
  qty: number;
  note?: string;
};


/** ลูกค้า "ขอเปิดโต๊ะ" (โหมดเข้ม แบบลูกค้าเริ่ม) — ตั้งสถานะโต๊ะเป็น open_requested ให้ staff เห็น
 *  ถ้าโต๊ะเปิดอยู่แล้ว (มี session active) ไม่ต้องทำอะไร */
export async function requestOpenTableFromApi(tableToken: string) {
  const table = await db
    .select()
    .from(restaurantTables)
    .where(eq(restaurantTables.qrToken, tableToken))
    .get();
  if (!table || !table.isActive) return { ok: false as const, error: "ไม่พบโต๊ะนี้" };

  const active = await db
    .select()
    .from(tableSessions)
    .where(and(eq(tableSessions.tableId, table.id), eq(tableSessions.status, "active")))
    .get();
  if (active) return { ok: true as const, alreadyOpen: true };

  await db
    .update(restaurantTables)
    .set({ status: "open_requested", updatedAt: new Date() })
    .where(eq(restaurantTables.id, table.id))
    .run();
  return { ok: true as const, alreadyOpen: false };
}

/** หา session ที่ active จาก order_token ของรอบนั้น (โทเคนลับที่ลูกค้าถือ) */
async function activeSessionByOrderToken(orderToken: string) {
  if (!orderToken) return null;
  return db
    .select()
    .from(tableSessions)
    .where(and(eq(tableSessions.orderToken, orderToken), eq(tableSessions.status, "active")))
    .get();
}

async function recalculateTableSession(sessionId: number): Promise<number> {
  const sessionOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.tableSessionId, sessionId))
    .all();
  const total = sessionOrders
    .filter((o) => o.status !== "cancelled" && o.status !== "ยกเลิก")
    .reduce((sum, o) => sum + o.finalTotal, 0);
  await db.update(tableSessions).set({ total }).where(eq(tableSessions.id, sessionId)).run();
  return total;
}

export async function createTableOrderFromApi(input: {
  cart: ApiCartLine[];
  orderToken: string;
  note?: string;
}) {
  if (!input.cart.length) return { ok: false as const, error: "ตะกร้าว่าง" };

  // ต้องมี session ที่พนักงานเปิดไว้ (order_token ตรง + ยัง active) เท่านั้น
  const session = await activeSessionByOrderToken(input.orderToken);
  if (!session) {
    return { ok: false as const, error: "โต๊ะนี้ยังไม่เปิด หรือปิดแล้ว — กรุณาเรียกพนักงาน" };
  }
  const table = await db
    .select()
    .from(restaurantTables)
    .where(eq(restaurantTables.id, session.tableId))
    .get();
  if (!table || !table.isActive) {
    return { ok: false as const, error: "ไม่พบโต๊ะนี้" };
  }

  // C2: ตรวจทุกบรรทัดกับ DB — public API ห้ามเชื่อราคา/ชื่อจาก client
  // ราคาต่อหน่วยต้องอยู่ในช่วง [ราคาฐาน, ราคาฐาน+ตัวเลือกเพิ่มสูงสุด]; ชื่อ/emoji ดึงจาก DB
  const validated: {
    productId: number; productName: string; emoji: string; price: number; qty: number; note: string;
  }[] = [];
  for (const c of input.cart) {
    const qty = Math.floor(Number(c.qty));
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      return { ok: false as const, error: "จำนวนไม่ถูกต้อง" };
    }
    const product = await db.select().from(products).where(eq(products.id, c.id)).get();
    if (!product || !product.isActive) {
      return { ok: false as const, error: "เมนูนี้ไม่พร้อมขาย กรุณาลองใหม่" };
    }
    const band = priceBand(product);
    const unit = Number(c.price);
    if (!Number.isFinite(unit) || unit < band.min || unit > band.max) {
      // นอกช่วงราคาที่ถูกต้อง = ถูกดัดแปลง → ปฏิเสธทั้งออเดอร์ (fail-closed)
      return { ok: false as const, error: "ราคาไม่ถูกต้อง กรุณาสั่งใหม่" };
    }
    validated.push({
      productId: product.id,
      productName: product.name, // จาก DB ไม่ใช่ client
      emoji: product.image,
      price: unit,
      qty,
      note: typeof c.note === "string" ? c.note.slice(0, 500) : "",
    });
  }

  const sub = validated.reduce((s, c) => s + c.price * c.qty, 0);
  const orderNo = await nextOrderNo();

  const created = await db
    .insert(orders)
    .values({
      orderNo,
      total: sub,
      discount: 0,
      finalTotal: sub,
      paymentMethod: "ยังไม่ชำระ",
      status: "new",
      tableId: table.id,
      tableSessionId: session.id,
      note: input.note?.trim().slice(0, 500) ?? "",
      createdAt: new Date(),
    })
    .returning({ id: orders.id })
    .get();

  await db
    .insert(orderItems)
    .values(
      validated.map((c) => ({
        orderId: created.id,
        productId: c.productId,
        productName: c.productName,
        emoji: c.emoji,
        price: c.price,
        quantity: c.qty,
        subtotal: c.price * c.qty,
        status: "new",
        note: c.note,
      })),
    )
    .run();

  // #2: หักสต็อกวัตถุดิบ (public order เดิมไม่หัก = ขายเกิน)
  await applyRecipeStock(validated.map((c) => ({ productId: c.productId, qty: c.qty })), -1);

  await recalculateTableSession(session.id);
  return { ok: true as const, orderNo };
}

/** ลูกค้ายกเลิกออเดอร์เอง — ได้เฉพาะออเดอร์ของรอบตัวเอง (order_token ตรง) และยังไม่รับเข้าครัว */
export async function cancelTableOrderFromApi(orderId: number, orderToken: string) {
  const order = await db.select().from(orders).where(eq(orders.id, orderId)).get();
  if (!order) return { ok: false as const, error: "ไม่พบออเดอร์" };

  const session = await activeSessionByOrderToken(orderToken);
  if (!session || order.tableSessionId !== session.id) {
    return { ok: false as const, error: "ออเดอร์ไม่ตรงกับรอบโต๊ะนี้" };
  }
  if (order.status !== "new") {
    return {
      ok: false as const,
      error: "ออเดอร์เริ่มทำแล้ว ยกเลิกเองไม่ได้ กรุณาเรียกพนักงาน",
    };
  }

  // #2: คืนสต็อกที่หักตอนสั่ง
  const its = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).all();
  await applyRecipeStock(its.map((i) => ({ productId: i.productId, qty: i.quantity })), 1);

  await db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, orderId)).run();
  await db.update(orderItems).set({ status: "cancelled" }).where(eq(orderItems.orderId, orderId)).run();
  if (order.tableSessionId) await recalculateTableSession(order.tableSessionId);
  return { ok: true as const };
}

export async function updateRestaurantOrderStatusFromApi(orderId: number, status: string) {
  const order = await db.select().from(orders).where(eq(orders.id, orderId)).get();
  if (!order) return { ok: false as const, error: "ไม่พบออเดอร์" };

  // #4: กันสถานะมั่ว + กันแก้ออเดอร์ที่ปิดแล้ว
  const check = validateStatusChange(order.status, status);
  if (!check.ok) return check;

  // #2: ยกเลิก → คืนสต็อก
  if (status === "cancelled" && order.status !== "cancelled") {
    const its = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).all();
    await applyRecipeStock(its.map((i) => ({ productId: i.productId, qty: i.quantity })), 1);
  }

  await db.update(orders).set({ status }).where(eq(orders.id, orderId)).run();
  await db.update(orderItems).set({ status }).where(eq(orderItems.orderId, orderId)).run();

  if (order.tableSessionId) await recalculateTableSession(order.tableSessionId);
  return { ok: true as const };
}

export async function requestTablePaymentFromApi(orderToken: string) {
  const session = await activeSessionByOrderToken(orderToken);
  if (!session) return { ok: false as const, error: "โต๊ะนี้ยังไม่เปิด หรือปิดแล้ว" };
  const table = await db
    .select()
    .from(restaurantTables)
    .where(eq(restaurantTables.id, session.tableId))
    .get();
  if (!table) return { ok: false as const, error: "ไม่พบโต๊ะนี้" };

  const amount = await recalculateTableSession(session.id);
  const existing = await db
    .select()
    .from(paymentRequests)
    .where(
      and(
        eq(paymentRequests.tableSessionId, session.id),
        eq(paymentRequests.status, "requested"),
      ),
    )
    .get();

  if (!existing) {
    await db
      .insert(paymentRequests)
      .values({
        tableSessionId: session.id,
        tableId: table.id,
        amount,
        status: "requested",
        promptpayPayload: "",
        createdAt: new Date(),
      })
      .run();
  }

  await db
    .update(tableSessions)
    .set({ paymentStatus: "requested" })
    .where(eq(tableSessions.id, session.id))
    .run();
  await db
    .update(restaurantTables)
    .set({ status: "payment_requested", updatedAt: new Date() })
    .where(eq(restaurantTables.id, table.id))
    .run();

  return { ok: true as const, amount };
}

export async function confirmTablePaymentFromApi(sessionId: number, adjustment = 0, method = "โอน") {
  const session = await db
    .select()
    .from(tableSessions)
    .where(eq(tableSessions.id, sessionId))
    .get();
  if (!session) return { ok: false as const, error: "ไม่พบรอบโต๊ะ" };

  // ยอดรายการจริง (server เป็นแหล่งความจริง) → +ปรับยอด → +ค่าบริการ% → +VAT% = ยอดสุทธิที่เก็บจริง
  const itemSum = await recalculateTableSession(sessionId);
  const cfg = await db.select().from(settings).where(eq(settings.id, 1)).get();
  const svcPct = cfg?.serviceChargePct ?? 0;
  const vatPct = cfg?.vatPct ?? 0;
  const adjustedSub = Math.max(0, itemSum + adjustment);
  const serviceAmt = Math.round((adjustedSub * svcPct) / 100);
  const vatAmt = Math.round(((adjustedSub + serviceAmt) * vatPct) / 100);
  const grandTotal = adjustedSub + serviceAmt + vatAmt;

  await db
    .update(paymentRequests)
    .set({ status: "paid", paidAt: new Date(), amount: grandTotal })
    .where(eq(paymentRequests.tableSessionId, sessionId))
    .run();
  await db
    .update(orders)
    .set({ status: "paid", paymentMethod: method })
    .where(eq(orders.tableSessionId, sessionId))
    .run();
  await db
    .update(tableSessions)
    .set({
      status: "closed",
      paymentStatus: "paid",
      total: grandTotal,
      closedAt: new Date(),
    })
    .where(eq(tableSessions.id, sessionId))
    .run();
  await db
    .update(restaurantTables)
    .set({ status: "available", updatedAt: new Date() })
    .where(eq(restaurantTables.id, session.tableId))
    .run();

  return { ok: true as const, total: grandTotal };
}
