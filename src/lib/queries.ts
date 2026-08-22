import { and, desc, eq, gte, inArray, isNull, lt, ne, or } from "drizzle-orm";
import { db } from "@/db";
import {
  expenses,
  ingredients,
  orderItems,
  orders,
  paymentRequests,
  products,
  recipeItems,
  restaurantTables,
  settings,
  staff,
  tableSessions,
} from "@/db/schema";
import { SEED_SETTINGS } from "@/db/seed-data";

// #1: คิดขอบเขต "วัน" ตามเขตเวลาไทย (Asia/Bangkok = UTC+7 คงที่ ไม่มี DST)
// ไม่พึ่งเขตเวลา server (Vercel = UTC → เดิมวันรีเซ็ต 07:00 ไทย = ยอดรายวันเพี้ยน)
const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;

/** instant (UTC) ของเที่ยงคืนเวลาไทย + offset วัน */
function bangkokDayStart(offsetDays = 0): Date {
  const nowBkk = new Date(Date.now() + BKK_OFFSET_MS); // เวลาไทยแบบ wall-clock (อ่านผ่าน getUTC*)
  const midnightWallMs = Date.UTC(
    nowBkk.getUTCFullYear(),
    nowBkk.getUTCMonth(),
    nowBkk.getUTCDate() + offsetDays,
  );
  return new Date(midnightWallMs - BKK_OFFSET_MS); // แปลง wall-clock กลับเป็น instant จริง
}

/** เริ่มต้นของวันนี้ (00:00 เวลาไทย) */
function startOfToday(): Date {
  return bangkokDayStart(0);
}

/** เริ่มต้นของวันถัดไป (00:00 เวลาไทย) */
function startOfTomorrow(): Date {
  return bangkokDayStart(1);
}

const THAI_DOW = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

// รายได้จริง = บิลหน้าร้าน (จ่ายที่เคาน์เตอร์แล้ว = ไม่มี table_session) หรือ บิลโต๊ะที่ session จ่ายแล้ว
// — ไม่รวมบิลที่ยกเลิก และไม่รวมบิลโต๊ะที่ยังไม่ปิด (กันนับยอดโต๊ะที่ยังนั่งอยู่)
function revenueCondition() {
  const paidSessions = db
    .select({ id: tableSessions.id })
    .from(tableSessions)
    .where(eq(tableSessions.paymentStatus, "paid"));
  return and(
    ne(orders.status, "cancelled"),
    or(isNull(orders.tableSessionId), inArray(orders.tableSessionId, paidSessions)),
  );
}

// ---------- เมนู / สินค้า ----------

export async function getAllProducts() {
  return db.select().from(products).orderBy(products.id).all();
}

export async function getActiveProducts() {
  return db
    .select()
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(products.id)
    .all();
}

// ---------- วัตถุดิบ + สูตร ----------

export type RecipeLine = {
  ingredientId: number;
  name: string;
  unit: string;
  emoji: string;
  qty: number;
};

export type PosProduct = {
  id: number;
  name: string;
  category: string;
  price: number;
  image: string;
  photo: string | null;
  isActive: boolean;
  isSoldOut: boolean;
  makeable: number | null; // ทำได้กี่หน่วยจากวัตถุดิบ (null = ยังไม่ตั้งสูตร/ไม่จำกัด)
  recipe: RecipeLine[];
  options: string | null; // JSON ตัวเลือกเมนู (null = ใช้ค่าเริ่มต้นตามหมวด)
};

export async function getIngredients() {
  return db.select().from(ingredients).orderBy(ingredients.id).all();
}

export async function getLowIngredients() {
  const ings = await getIngredients();
  return ings.filter((i) => i.stock <= i.lowThreshold);
}

/** รวมสินค้า + สูตร + คำนวณว่าทำได้กี่หน่วยจากวัตถุดิบที่มี */
async function buildProductViews(activeOnly: boolean): Promise<PosProduct[]> {
  const prods = await (
    activeOnly
      ? db.select().from(products).where(eq(products.isActive, true))
      : db.select().from(products)
  )
    .orderBy(products.id)
    .all();

  const ings = await db.select().from(ingredients).all();
  const ingById = new Map(ings.map((i) => [i.id, i]));

  const recs = await db.select().from(recipeItems).all();
  const byProduct = new Map<number, typeof recs>();
  for (const r of recs) {
    const arr = byProduct.get(r.productId) ?? [];
    arr.push(r);
    byProduct.set(r.productId, arr);
  }

  return prods.map((p) => {
    const items = byProduct.get(p.id) ?? [];
    const recipe: RecipeLine[] = items.map((it) => {
      const ing = ingById.get(it.ingredientId);
      return {
        ingredientId: it.ingredientId,
        name: ing?.name ?? "?",
        unit: ing?.unit ?? "",
        emoji: ing?.emoji ?? "📦",
        qty: it.qty,
      };
    });

    let makeable: number | null = null;
    if (items.length) {
      makeable = Math.min(
        ...items.map((it) => {
          const s = ingById.get(it.ingredientId)?.stock ?? 0;
          return it.qty > 0 ? Math.floor(s / it.qty) : Infinity;
        }),
      );
      if (!Number.isFinite(makeable)) makeable = null;
    }

    return {
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
      image: p.image,
      photo: p.photo,
      isActive: p.isActive,
      isSoldOut: p.isSoldOut,
      makeable,
      recipe,
      options: p.options,
    };
  });
}

export async function getPosProducts() {
  return buildProductViews(true);
}

export async function getCustomerProducts() {
  return (await buildProductViews(true)).filter((p) => !p.isSoldOut);
}

export async function getManageProducts() {
  return buildProductViews(false);
}

export type BestSeller = PosProduct & { sold: number };

/** เมนูขายดี "มาแรง" — นับจำนวนที่ขายได้จากบิลที่สำเร็จ/ชำระแล้ว */
export async function getBestSellerProducts(limit = 6): Promise<BestSeller[]> {
  const doneOrders = await db
    .select({ id: orders.id })
    .from(orders)
    .where(revenueCondition())
    .all();
  const doneIds = new Set(doneOrders.map((o) => o.id));
  const items = await db.select().from(orderItems).all();
  const soldByProduct = new Map<number, number>();
  for (const it of items) {
    if (it.productId == null || !doneIds.has(it.orderId)) continue;
    soldByProduct.set(it.productId, (soldByProduct.get(it.productId) ?? 0) + it.quantity);
  }
  const products = await getCustomerProducts();
  return products
    .map((p) => ({ ...p, sold: soldByProduct.get(p.id) ?? 0 }))
    .filter((p) => p.sold > 0)
    .sort((a, b) => b.sold - a.sold)
    .slice(0, limit);
}

// ---------- พนักงานขาย ----------

export async function getAllStaff() {
  return db.select().from(staff).orderBy(staff.id).all();
}

export async function getActiveStaff() {
  return db
    .select()
    .from(staff)
    .where(eq(staff.isActive, true))
    .orderBy(staff.id)
    .all();
}

// ---------- ออเดอร์ ----------

export async function getOrders() {
  const rows = await db.select().from(orders).orderBy(desc(orders.id)).all();
  return Promise.all(
    rows.map(async (o) => {
      const items = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, o.id))
        .all();
      return { ...o, items };
    }),
  );
}

export async function getOrderById(id: number) {
  const o = await db.select().from(orders).where(eq(orders.id, id)).get();
  if (!o) return null;
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, o.id))
    .all();
  return { ...o, items };
}

export async function getRestaurantTableByToken(token: string) {
  return db
    .select()
    .from(restaurantTables)
    .where(eq(restaurantTables.qrToken, token))
    .get();
}

async function getSessionOrders(sessionId: number) {
  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.tableSessionId, sessionId))
    .orderBy(desc(orders.id))
    .all();
  return Promise.all(
    rows.map(async (o) => ({
      ...o,
      items: await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, o.id))
        .all(),
    })),
  );
}

export async function getCustomerTableView(token: string) {
  const table = await getRestaurantTableByToken(token);
  if (!table || !table.isActive) return null;

  let session = await db
    .select()
    .from(tableSessions)
    .where(and(eq(tableSessions.tableId, table.id), eq(tableSessions.status, "active")))
    .get();

  // โหมด auto-open: ลูกค้าสแกน QR โต๊ะแล้วเปิดรอบให้เลย (ไม่ต้องรอ staff อนุมัติ)
  if (!session) {
    const cfg = await db.select().from(settings).where(eq(settings.id, 1)).get();
    if (cfg?.tableAutoOpen) {
      session = await db
        .insert(tableSessions)
        .values({
          tableId: table.id,
          status: "active",
          paymentStatus: "unpaid",
          orderToken: crypto.randomUUID(),
          openedAt: new Date(),
        })
        .returning()
        .get();
      await db
        .update(restaurantTables)
        .set({ status: "occupied", updatedAt: new Date() })
        .where(eq(restaurantTables.id, table.id))
        .run();
      table.status = "occupied";
    }
  }

  const payment = session
    ? await db
        .select()
        .from(paymentRequests)
        .where(eq(paymentRequests.tableSessionId, session.id))
        .orderBy(desc(paymentRequests.id))
        .get()
    : null;

  return {
    table,
    session,
    orders: session ? await getSessionOrders(session.id) : [],
    payment,
  };
}

/** มุมมองหน้าสั่งอาหารจาก order_token โดยตรง (ลิงก์ชั่วคราว /t/<token>)
 *  คืน null ถ้า token ไม่ตรง session ที่ active (ลิงก์หมดอายุ/ปิดโต๊ะแล้ว) */
export async function getOrderTokenView(orderToken: string) {
  if (!orderToken) return null;
  const session = await db
    .select()
    .from(tableSessions)
    .where(and(eq(tableSessions.orderToken, orderToken), eq(tableSessions.status, "active")))
    .get();
  if (!session) return null;
  const table = await db
    .select()
    .from(restaurantTables)
    .where(eq(restaurantTables.id, session.tableId))
    .get();
  if (!table) return null;
  const payment = await db
    .select()
    .from(paymentRequests)
    .where(eq(paymentRequests.tableSessionId, session.id))
    .orderBy(desc(paymentRequests.id))
    .get();
  return { table, session, orders: await getSessionOrders(session.id), payment };
}

export async function getKitchenOrders() {
  const rows = (
    await db
      .select()
      .from(orders)
      .where(
        and(
          gte(orders.createdAt, startOfToday()),
          lt(orders.createdAt, startOfTomorrow()),
        ),
      )
      .orderBy(desc(orders.id))
      .all()
  ).filter((o) => ["new", "ready"].includes(o.status));

  const tables = await db.select().from(restaurantTables).all();
  const tableById = new Map(tables.map((t) => [t.id, t]));

  return Promise.all(
    rows.map(async (o) => ({
      ...o,
      tableName: o.tableId ? tableById.get(o.tableId)?.name ?? "ไม่ทราบโต๊ะ" : "หน้าร้าน",
      tableToken: o.tableId ? tableById.get(o.tableId)?.qrToken ?? "" : "",
      items: await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, o.id))
        .all(),
    })),
  );
}

/**
 * สถานะแจ้งเตือน (ใช้ poll จากทุกหน้าเพื่อเล่นเสียง)
 * - newOrderIds: ออเดอร์ใหม่วันนี้ (ยังไม่รับ)
 * - ready: ออเดอร์ที่ทำเสร็จรอเสิร์ฟ
 * - payments: โต๊ะที่กำลังเรียกเก็บเงิน
 */
export async function getNotificationState() {
  const tables = await db.select().from(restaurantTables).all();
  const tById = new Map(tables.map((t) => [t.id, t]));

  const todays = await db
    .select()
    .from(orders)
    .where(
      and(gte(orders.createdAt, startOfToday()), lt(orders.createdAt, startOfTomorrow())),
    )
    .all();

  const newOrderIds = todays.filter((o) => o.status === "new").map((o) => o.id);
  const ready = todays
    .filter((o) => o.status === "ready")
    .map((o) => ({
      id: o.id,
      token: o.tableId ? tById.get(o.tableId)?.qrToken ?? "" : "",
      name: o.tableId ? tById.get(o.tableId)?.name ?? "หน้าร้าน" : "หน้าร้าน",
    }));

  const reqs = await db
    .select()
    .from(paymentRequests)
    .where(eq(paymentRequests.status, "requested"))
    .all();
  const payments = reqs.map((r) => ({
    tableId: r.tableId,
    token: tById.get(r.tableId)?.qrToken ?? "",
    name: tById.get(r.tableId)?.name ?? "",
  }));

  // ลูกค้า "ขอเปิดโต๊ะ" (โหมดเข้ม) — โต๊ะสถานะ open_requested รอ staff กดเปิด
  const openRequests = tables
    .filter((t) => t.status === "open_requested")
    .map((t) => ({ tableId: t.id, token: t.qrToken, name: t.name }));

  return { newOrderIds, ready, payments, openRequests };
}

/** โต๊ะทั้งหมด รวมที่ปิดอยู่ (สำหรับจัดการในหน้าตั้งค่า) */
export async function getAllTables() {
  return db.select().from(restaurantTables).orderBy(restaurantTables.id).all();
}

/** โต๊ะที่เปิดใช้งาน (สำหรับเลือกส่งออเดอร์เข้าโต๊ะจากหน้าขายของ) */
export async function getActiveTables() {
  return db
    .select()
    .from(restaurantTables)
    .where(eq(restaurantTables.isActive, true))
    .orderBy(restaurantTables.id)
    .all();
}

export async function getStaffTableViews() {
  const tables = await db
    .select()
    .from(restaurantTables)
    .where(eq(restaurantTables.isActive, true))
    .orderBy(restaurantTables.id)
    .all();

  return Promise.all(
    tables.map(async (table) => {
      const session = await db
        .select()
        .from(tableSessions)
        .where(and(eq(tableSessions.tableId, table.id), eq(tableSessions.status, "active")))
        .get();
      const sessionOrders = session ? await getSessionOrders(session.id) : [];
      const payment = session
        ? await db
            .select()
            .from(paymentRequests)
            .where(eq(paymentRequests.tableSessionId, session.id))
            .orderBy(desc(paymentRequests.id))
            .get()
        : null;
      const total = sessionOrders
        .filter((o) => o.status !== "cancelled" && o.status !== "ยกเลิก")
        .reduce((sum, o) => sum + o.finalTotal, 0);
      const hasReady = sessionOrders.some((o) => o.status === "ready");
      const hasActive = sessionOrders.some((o) => ["new", "ready"].includes(o.status));

      return {
        table,
        session,
        orders: sessionOrders,
        payment,
        total,
        hasReady,
        hasActive,
      };
    }),
  );
}

// ---------- ตั้งค่าร้าน ----------

export async function getSettings() {
  const s = await db.select().from(settings).where(eq(settings.id, 1)).get();
  return s ?? { id: 1, ...SEED_SETTINGS };
}

// ---------- ยอดขายวันนี้ (ใช้โชว์บน topbar) ----------

export async function getTodaySales(): Promise<number> {
  const rows = await db
    .select({ ft: orders.finalTotal })
    .from(orders)
    .where(
      and(
        revenueCondition(),
        gte(orders.createdAt, startOfToday()),
        lt(orders.createdAt, startOfTomorrow()),
      ),
    )
    .all();
  return rows.reduce((s, r) => s + r.ft, 0);
}

// ---------- รายจ่าย ----------

export async function getExpenses() {
  return db.select().from(expenses).orderBy(desc(expenses.id)).all();
}

export async function getTodayExpenses(): Promise<number> {
  const rows = await db
    .select({ a: expenses.amount })
    .from(expenses)
    .where(
      and(
        gte(expenses.createdAt, startOfToday()),
        lt(expenses.createdAt, startOfTomorrow()),
      ),
    )
    .all();
  return rows.reduce((s, r) => s + r.a, 0);
}

// ---------- รายงาน ----------

export async function getReport() {
  // เฉพาะบิลที่สำเร็จของวันนี้
  const todayDone = await db
    .select()
    .from(orders)
    .where(
      and(
        revenueCondition(),
        gte(orders.createdAt, startOfToday()),
        lt(orders.createdAt, startOfTomorrow()),
      ),
    )
    .all();

  const todaySales = todayDone.reduce((s, o) => s + o.finalTotal, 0);
  const orderCount = todayDone.length;
  const avg = orderCount ? Math.round(todaySales / orderCount) : 0;

  // ยอดขาย 7 วันล่าสุด (ขอบเขตวัน + วันในสัปดาห์ ตามเวลาไทย)
  const sevenDaysAgo = bangkokDayStart(-6);
  const recent = await db
    .select()
    .from(orders)
    .where(and(revenueCondition(), gte(orders.createdAt, sevenDaysAgo)))
    .all();

  const dailyBars = Array.from({ length: 7 }, (_, i) => {
    const day = bangkokDayStart(i - 6);
    const next = bangkokDayStart(i - 5);
    const value = recent
      .filter((o) => o.createdAt >= day && o.createdAt < next)
      .reduce((s, o) => s + o.finalTotal, 0);
    // วันในสัปดาห์ตามเวลาไทย (getUTCDay ของ wall-clock ที่บวก offset แล้ว)
    const dow = new Date(day.getTime() + BKK_OFFSET_MS).getUTCDay();
    return { label: THAI_DOW[dow], value, isToday: i === 6 };
  });

  // เมนูขายดี (รวมจำนวนจากบิลที่สำเร็จทั้งหมด)
  const allDone = await db
    .select()
    .from(orders)
    .where(revenueCondition())
    .all();
  const doneIds = new Set(allDone.map((o) => o.id));
  const allItems = await db.select().from(orderItems).all();
  const tally = new Map<string, { name: string; emoji: string; qty: number }>();
  for (const it of allItems) {
    if (!doneIds.has(it.orderId)) continue;
    const cur = tally.get(it.productName) ?? {
      name: it.productName,
      emoji: it.emoji,
      qty: 0,
    };
    cur.qty += it.quantity;
    tally.set(it.productName, cur);
  }
  const bestSellers = Array.from(tally.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // ยอดขายแยกตามพนักงาน (เฉพาะบิลสำเร็จของวันนี้)
  const staffList = await db.select().from(staff).all();
  const emojiByName = new Map(staffList.map((s) => [s.name, s.emoji]));
  const colorByName = new Map(staffList.map((s) => [s.name, s.color]));
  const staffTally = new Map<
    string,
    { name: string; emoji: string; color: string; sales: number; bills: number }
  >();
  for (const o of todayDone) {
    const name = o.staffName ?? "ไม่ระบุ";
    const cur = staffTally.get(name) ?? {
      name,
      emoji: emojiByName.get(name) ?? "🧑",
      color: colorByName.get(name) ?? "#6f4e37",
      sales: 0,
      bills: 0,
    };
    cur.sales += o.finalTotal;
    cur.bills += 1;
    staffTally.set(name, cur);
  }
  const staffSales = Array.from(staffTally.values()).sort(
    (a, b) => b.sales - a.sales,
  );

  // รายจ่าย + กำไรวันนี้
  const todayExpenses = await getTodayExpenses();
  const profit = todaySales - todayExpenses;

  return {
    todaySales,
    orderCount,
    avg,
    dailyBars,
    bestSellers,
    staffSales,
    todayExpenses,
    profit,
  };
}
