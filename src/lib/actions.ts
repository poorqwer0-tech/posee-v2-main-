"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { getCurrentUser } from "@/lib/auth-session";
import { hashPassword } from "@/lib/password";
import { applyRecipeStock, nextOrderNo, validateStatusChange } from "@/lib/order-ops";
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

/** ให้ผ่านเฉพาะ admin (ป้องกัน action สำคัญถูกเรียกโดยพนักงาน) */
async function requireAdmin() {
  const u = await getCurrentUser();
  return u?.role === "admin";
}

export type CartLine = {
  lineId?: string;
  id: number;
  name: string;
  emoji: string;
  price: number;
  basePrice?: number;
  qty: number;
  note?: string;
};


export type OrderMeta = {
  adjustment: number; // ปรับยอด +/- (บาท) ก่อนคิดค่าบริการ/VAT — แทนส่วนลด %
  method: string;
  staffId: number | null;
  staffName: string;
};

/** บันทึกออเดอร์ใหม่จากตะกร้า */
export async function createOrder(cart: CartLine[], meta: OrderMeta) {
  if (!cart.length) {
    return { ok: false as const, error: "ตะกร้าว่าง" };
  }

  const sub = cart.reduce((s, c) => s + c.price * c.qty, 0);
  // ปรับยอด(+/-) → ค่าบริการ → VAT (คิดตามลำดับ) ดึง % จากตั้งค่าร้าน (สูตรเดียวกับโต๊ะ)
  const cfg = await db.select().from(settings).where(eq(settings.id, 1)).get();
  const svcPct = cfg?.serviceChargePct ?? 0;
  const vatPct = cfg?.vatPct ?? 0;
  const adjustment = Number(meta.adjustment) || 0;
  const adjustedSub = Math.max(0, sub + adjustment);
  const serviceAmt = Math.round((adjustedSub * svcPct) / 100);
  const vatAmt = Math.round(((adjustedSub + serviceAmt) * vatPct) / 100);
  const finalTotal = adjustedSub + serviceAmt + vatAmt;
  const orderNo = await nextOrderNo();

  const created = await db
    .insert(orders)
    .values({
      orderNo,
      total: sub,
      discount: 0,
      finalTotal,
      paymentMethod: meta.method,
      // ขายหน้าร้าน = จ่ายเงินแล้วที่เคาน์เตอร์ แต่ยังต้องเข้าครัวทำ → เริ่มที่ "new" (รับออเดอร์)
      status: "new",
      staffId: meta.staffId,
      staffName: meta.staffName || null,
      createdAt: new Date(),
    })
    .returning({ id: orders.id })
    .get();

  await db.insert(orderItems)
    .values(
      cart.map((c) => ({
        orderId: created.id,
        productId: c.id,
        productName: c.name,
        emoji: c.emoji,
        price: c.price,
        quantity: c.qty,
        subtotal: c.price * c.qty,
        note: c.note ?? "",
      })),
    )
    .run();

  // ตัดวัตถุดิบตามสูตรของแต่ละเมนู (ไม่ให้ติดลบ)
  await applyRecipeStock(cart.map((c) => ({ productId: c.id, qty: c.qty })), -1);

  revalidatePath("/", "layout"); // อัปเดตยอดขายวันนี้บน topbar
  revalidatePath("/products");
  revalidatePath("/ingredients");
  revalidatePath("/");
  revalidatePath("/kitchen"); // ออเดอร์หน้าร้านเข้าครัวด้วย
  revalidatePath("/orders");
  revalidatePath("/reports");

  return {
    ok: true as const,
    orderNo,
    finalTotal,
    method: meta.method,
    subtotal: sub,
    adjustment,
    serviceChargePct: svcPct,
    serviceAmt,
    vatPct,
    vatAmt,
  };
}

async function activeSessionForTable(tableId: number) {
  let session = await db
    .select()
    .from(tableSessions)
    .where(and(eq(tableSessions.tableId, tableId), eq(tableSessions.status, "active")))
    .get();

  if (!session) {
    const created = await db
      .insert(tableSessions)
      .values({
        tableId,
        status: "active",
        paymentStatus: "unpaid",
        orderToken: crypto.randomUUID(),
        openedAt: new Date(),
      })
      .returning()
      .get();
    await db.update(restaurantTables)
      .set({ status: "occupied", updatedAt: new Date() })
      .where(eq(restaurantTables.id, tableId))
      .run();
    session = created;
  }

  return session;
}

/** พนักงานเปิดโต๊ะ (โหมดเข้ม) — สร้างรอบใหม่ + order_token ให้ลูกค้าสแกนสั่งได้
 *  ถ้ามีรอบ active อยู่แล้ว คืนอันเดิม (กันเปิดซ้ำ) */
export async function openTable(tableToken: string) {
  const table = await db
    .select()
    .from(restaurantTables)
    .where(eq(restaurantTables.qrToken, tableToken))
    .get();
  if (!table || !table.isActive) {
    return { ok: false as const, error: "ไม่พบโต๊ะนี้" };
  }
  const session = await activeSessionForTable(table.id);
  revalidatePath("/staff");
  revalidatePath("/kitchen");
  revalidatePath(`/table/${tableToken}`);
  return { ok: true as const, orderToken: session.orderToken };
}

async function recalculateTableSession(sessionId: number) {
  const sessionOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.tableSessionId, sessionId))
    .all();
  const total = sessionOrders
    .filter((o) => o.status !== "cancelled" && o.status !== "ยกเลิก")
    .reduce((sum, o) => sum + o.finalTotal, 0);
  await db.update(tableSessions)
    .set({ total })
    .where(eq(tableSessions.id, sessionId))
    .run();
  return total;
}

export type TableOrderMeta = {
  tableToken: string;
  note?: string;
};

/** ลูกค้าสั่งจาก QR โต๊ะ */
export async function createTableOrder(cart: CartLine[], meta: TableOrderMeta) {
  if (!cart.length) {
    return { ok: false as const, error: "ตะกร้าว่าง" };
  }

  const table = await db
    .select()
    .from(restaurantTables)
    .where(eq(restaurantTables.qrToken, meta.tableToken))
    .get();
  if (!table || !table.isActive) {
    return { ok: false as const, error: "ไม่พบโต๊ะนี้" };
  }

  const sub = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const orderNo = await nextOrderNo();
  const session = await activeSessionForTable(table.id);

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
      note: meta.note?.trim() ?? "",
      createdAt: new Date(),
    })
    .returning({ id: orders.id })
    .get();

  await db.insert(orderItems)
    .values(
      cart.map((c) => ({
        orderId: created.id,
        productId: c.id,
        productName: c.name,
        emoji: c.emoji,
        price: c.price,
        quantity: c.qty,
        subtotal: c.price * c.qty,
        status: "new",
        note: c.note ?? "",
      })),
    )
    .run();

  // #2: หักสต็อกวัตถุดิบเหมือนขายหน้าร้าน (ออเดอร์โต๊ะเดิมไม่หัก = ขายเกิน)
  await applyRecipeStock(cart.map((c) => ({ productId: c.id, qty: c.qty })), -1);

  await recalculateTableSession(session.id);
  revalidatePath("/kitchen");
  revalidatePath("/staff");
  revalidatePath(`/table/${meta.tableToken}`);
  return { ok: true as const, orderNo };
}

export async function updateRestaurantOrderStatus(orderId: number, status: string) {
  const order = await db.select().from(orders).where(eq(orders.id, orderId)).get();
  if (!order) return { ok: false as const, error: "ไม่พบออเดอร์" };

  // #4: กันสถานะมั่ว + กันแก้ออเดอร์ที่ปิดแล้ว (paid/cancelled)
  const check = validateStatusChange(order.status, status);
  if (!check.ok) return check;

  // #2: ยกเลิกออเดอร์ที่ยังไม่ปิด → คืนสต็อกวัตถุดิบ
  if (status === "cancelled" && order.status !== "cancelled") {
    const its = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).all();
    await applyRecipeStock(its.map((i) => ({ productId: i.productId, qty: i.quantity })), 1);
  }

  await db.update(orders).set({ status }).where(eq(orders.id, orderId)).run();
  await db.update(orderItems).set({ status }).where(eq(orderItems.orderId, orderId)).run();

  if (order.tableSessionId) await recalculateTableSession(order.tableSessionId);
  revalidatePath("/kitchen");
  revalidatePath("/staff");
  if (order.tableId) {
    const table = await db.select().from(restaurantTables).where(eq(restaurantTables.id, order.tableId)).get();
    if (table) revalidatePath(`/table/${table.qrToken}`);
  }
  return { ok: true as const };
}

export async function requestTablePayment(tableToken: string) {
  const table = await db
    .select()
    .from(restaurantTables)
    .where(eq(restaurantTables.qrToken, tableToken))
    .get();
  if (!table) return { ok: false as const, error: "ไม่พบโต๊ะนี้" };

  const session = await db
    .select()
    .from(tableSessions)
    .where(and(eq(tableSessions.tableId, table.id), eq(tableSessions.status, "active")))
    .get();
  if (!session) return { ok: false as const, error: "ยังไม่มีออเดอร์ในโต๊ะนี้" };

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
    await db.insert(paymentRequests)
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

  await db.update(tableSessions)
    .set({ paymentStatus: "requested" })
    .where(eq(tableSessions.id, session.id))
    .run();
  await db.update(restaurantTables)
    .set({ status: "payment_requested", updatedAt: new Date() })
    .where(eq(restaurantTables.id, table.id))
    .run();

  revalidatePath("/staff");
  revalidatePath(`/table/${tableToken}`);
  return { ok: true as const, amount };
}

export async function confirmTablePayment(sessionId: number, staffId: number | null = null) {
  const session = await db.select().from(tableSessions).where(eq(tableSessions.id, sessionId)).get();
  if (!session) return { ok: false as const, error: "ไม่พบรอบโต๊ะ" };

  const table = await db
    .select()
    .from(restaurantTables)
    .where(eq(restaurantTables.id, session.tableId))
    .get();
  const total = await recalculateTableSession(sessionId);

  await db.update(paymentRequests)
    .set({ status: "paid", paidAt: new Date(), confirmedByStaffId: staffId })
    .where(eq(paymentRequests.tableSessionId, sessionId))
    .run();
  await db.update(orders)
    .set({ status: "paid", paymentMethod: "PromptPay" })
    .where(eq(orders.tableSessionId, sessionId))
    .run();
  await db.update(tableSessions)
    .set({
      status: "closed",
      paymentStatus: "paid",
      total,
      closedAt: new Date(),
    })
    .where(eq(tableSessions.id, sessionId))
    .run();
  await db.update(restaurantTables)
    .set({ status: "available", updatedAt: new Date() })
    .where(eq(restaurantTables.id, session.tableId))
    .run();

  revalidatePath("/", "layout");
  revalidatePath("/staff");
  revalidatePath("/kitchen");
  revalidatePath("/orders");
  revalidatePath("/reports");
  if (table) revalidatePath(`/table/${table.qrToken}`);
  return { ok: true as const, total };
}

/** ยกเลิกบิล */
export async function cancelOrder(id: number) {
  await db.update(orders).set({ status: "ยกเลิก" }).where(eq(orders.id, id)).run();
  revalidatePath("/", "layout"); // อัปเดตยอดขายวันนี้บน topbar
  revalidatePath("/orders");
  revalidatePath("/reports");
  return { ok: true as const };
}

export type ProductInput = {
  name: string;
  category: string;
  price: number;
  image: string;
  photo?: string | null; // data URI หรือ path รูป (null = เอารูปออก, undefined = ไม่แตะ)
};

export type RecipeInput = { ingredientId: number; qty: number }[];

export type OptionInput = {
  title: string;
  min: number;
  max: number;
  options: { label: string; price: number }[];
};

/** เตรียม JSON ตัวเลือกเมนูสำหรับเก็บลง DB (ตัดกลุ่ม/ตัวเลือกที่ว่างทิ้ง) */
function serializeOptions(groups: OptionInput[] | undefined): string | null {
  if (!groups) return null;
  const clean = groups
    .map((g) => ({
      title: g.title.trim(),
      min: Math.max(0, Math.floor(g.min) || 0),
      max: Math.max(1, Math.floor(g.max) || 1),
      options: g.options
        .map((o) => ({ label: o.label.trim(), price: Math.max(0, o.price) || 0 }))
        .filter((o) => o.label !== ""),
    }))
    .filter((g) => g.options.length > 0);
  return JSON.stringify(clean);
}

/** บันทึกสูตร (ลบของเดิมแล้วใส่ใหม่ เฉพาะ qty > 0) */
async function saveRecipeRows(productId: number, recipe: RecipeInput) {
  await db.delete(recipeItems).where(eq(recipeItems.productId, productId)).run();
  const rows = recipe
    .filter((r) => r.qty > 0)
    .map((r) => ({ productId, ingredientId: r.ingredientId, qty: r.qty }));
  if (rows.length) await db.insert(recipeItems).values(rows).run();
}

/** เพิ่มเมนูใหม่ (พร้อมสูตร + ตัวเลือก) */
export async function createProduct(
  input: ProductInput,
  recipe: RecipeInput = [],
  options?: OptionInput[],
) {
  if (!input.name.trim() || !(input.price > 0)) {
    return { ok: false as const, error: "ใส่ชื่อเมนูและราคาก่อนนะ" };
  }
  const created = await db
    .insert(products)
    .values({
      name: input.name.trim(),
      category: input.category,
      price: input.price,
      image: input.image,
      photo: input.photo || null,
      isActive: true,
      options: options ? serializeOptions(options) : null,
    })
    .returning({ id: products.id })
    .get();
  await saveRecipeRows(created.id, recipe);
  revalidatePath("/products");
  revalidatePath("/");
  return { ok: true as const };
}

/** แก้ไขเมนู (พร้อมสูตร + ตัวเลือก) */
export async function updateProduct(
  id: number,
  input: ProductInput,
  recipe: RecipeInput = [],
  options?: OptionInput[],
) {
  if (!input.name.trim() || !(input.price > 0)) {
    return { ok: false as const, error: "ใส่ชื่อเมนูและราคาก่อนนะ" };
  }
  await db.update(products)
    .set({
      name: input.name.trim(),
      category: input.category,
      price: input.price,
      image: input.image,
      // photo: undefined = ไม่แตะ, null = เอารูปออก, string = รูปใหม่
      ...(input.photo !== undefined ? { photo: input.photo } : {}),
      // options: undefined = ไม่แตะ, มีค่า = เขียนทับ (รวมถึง "[]" = ไม่มีตัวเลือก)
      ...(options !== undefined ? { options: serializeOptions(options) } : {}),
    })
    .where(eq(products.id, id))
    .run();
  await saveRecipeRows(id, recipe);
  revalidatePath("/products");
  revalidatePath("/");
  return { ok: true as const };
}

/** เปิด/ปิดการขายเมนู */
export async function toggleProduct(id: number, isActive: boolean) {
  await db.update(products).set({ isActive }).where(eq(products.id, id)).run();
  revalidatePath("/products");
  revalidatePath("/");
  return { ok: true as const };
}

export type SettingsInput = {
  shopName: string;
  logoEmoji: string;
  primaryColor: string;
  phone: string;
  address: string;
  receiptFooter: string;
  promptPayId: string;
  serviceChargePct: number;
  vatPct: number;
};

/** บันทึกการตั้งค่าร้าน */
export async function updateSettings(input: SettingsInput) {
  const clamp = (n: number) => Math.min(100, Math.max(0, Number(n) || 0));
  // logo = อีโมจิตัวเดียว (เอาตัวแรกพอ กันใส่ยาว) fallback 🍜
  const logoEmoji = [...input.logoEmoji.trim()][0] ?? "🍜";
  // สีหลัก = hex 6 หลัก หรือว่าง (ว่าง = ใช้ธีมเดิม); อื่นๆ ปัดเป็นว่าง
  const pc = input.primaryColor.trim();
  const primaryColor = /^#?[0-9a-fA-F]{6}$/.test(pc)
    ? (pc.startsWith("#") ? pc : `#${pc}`).toLowerCase()
    : "";
  const values = {
    shopName: input.shopName,
    logoEmoji,
    primaryColor,
    phone: input.phone,
    address: input.address,
    receiptFooter: input.receiptFooter,
    promptPayId: input.promptPayId.trim(),
    serviceChargePct: clamp(input.serviceChargePct),
    vatPct: clamp(input.vatPct),
  };
  const existing = await db.select().from(settings).where(eq(settings.id, 1)).get();
  if (existing) {
    await db.update(settings).set(values).where(eq(settings.id, 1)).run();
  } else {
    await db.insert(settings).values(values).run();
  }
  revalidatePath("/", "layout");
  revalidatePath("/settings");
  revalidatePath("/staff");
  return { ok: true as const };
}

/** โหมดเข้าถึงหน้า staff: "lan-only" (เฉพาะ Wi-Fi ร้าน) | "public" (เข้าจากเน็ตได้) — เฉพาะแอดมิน */
export async function setStaffAccess(mode: "lan-only" | "public") {
  if (!(await requireAdmin())) return { ok: false as const, error: "เฉพาะแอดมิน" };
  const value = mode === "public" ? "public" : "lan-only";
  await db.update(settings).set({ staffAccess: value }).where(eq(settings.id, 1)).run();
  revalidatePath("/", "layout");
  revalidatePath("/settings");
  return { ok: true as const };
}

/** โหมดเปิดโต๊ะ: true = ลูกค้าสแกน QR แล้วสั่งได้เลย | false = ต้อง "ขอเปิดโต๊ะ" ให้ staff อนุมัติก่อน — เฉพาะแอดมิน */
export async function setTableAutoOpen(auto: boolean) {
  if (!(await requireAdmin())) return { ok: false as const, error: "เฉพาะแอดมิน" };
  await db.update(settings).set({ tableAutoOpen: !!auto }).where(eq(settings.id, 1)).run();
  revalidatePath("/settings");
  return { ok: true as const };
}

// ---------- พนักงานขาย ----------

/** สีป้ายพนักงาน วนไปตามลำดับที่เพิ่ม */
const STAFF_COLORS = ["#c0734e", "#7c9b5e", "#6f4e37", "#8a6f5a", "#5e7a4f", "#a0673d"];

export async function createStaff(name: string, emoji: string) {
  if (!name.trim()) {
    return { ok: false as const, error: "ใส่ชื่อพนักงานก่อนนะ" };
  }
  const everCount = (await db.select().from(staff).all()).length;
  await db.insert(staff)
    .values({
      name: name.trim(),
      emoji: emoji || "🧑",
      color: STAFF_COLORS[everCount % STAFF_COLORS.length],
      isActive: true,
    })
    .run();
  revalidatePath("/settings");
  revalidatePath("/");
  revalidatePath("/reports");
  return { ok: true as const };
}

export async function toggleStaff(id: number, isActive: boolean) {
  await db.update(staff).set({ isActive }).where(eq(staff.id, id)).run();
  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true as const };
}

export async function deleteStaff(id: number) {
  if (!(await requireAdmin())) return { ok: false as const, error: "เฉพาะแอดมิน" };
  // กันลบ admin คนสุดท้าย (ล็อกตัวเองออก)
  const target = await db.select().from(staff).where(eq(staff.id, id)).get();
  if (target?.role === "admin") {
    const otherAdmins = await db
      .select({ c: sql<number>`count(*)` })
      .from(staff)
      .where(and(eq(staff.role, "admin"), ne(staff.id, id)))
      .get();
    if (!otherAdmins || otherAdmins.c === 0) {
      return { ok: false as const, error: "ลบแอดมินคนสุดท้ายไม่ได้" };
    }
  }
  // ลบเฉพาะระเบียนพนักงาน — บิลเก่ายังเก็บชื่อผู้ขายไว้ (denormalized)
  await db.delete(staff).where(eq(staff.id, id)).run();
  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true as const };
}

// ---------- บัญชีล็อกอินของพนักงาน (admin ตั้งค่า) ----------

export type StaffLoginInput = {
  username: string;
  password: string; // ว่าง = ไม่เปลี่ยนรหัสเดิม
  role: "admin" | "staff";
};

/** ตั้ง/แก้ บัญชีล็อกอินของพนักงาน (username + รหัส + สิทธิ์) */
export async function setStaffLogin(staffId: number, input: StaffLoginInput) {
  if (!(await requireAdmin())) return { ok: false as const, error: "เฉพาะแอดมิน" };

  const username = input.username.trim().toLowerCase();
  if (!username) return { ok: false as const, error: "ใส่ชื่อผู้ใช้ก่อนนะ" };
  if (!/^[a-z0-9._-]{3,20}$/.test(username)) {
    return { ok: false as const, error: "ชื่อผู้ใช้ 3-20 ตัว (a-z 0-9 . _ -)" };
  }

  const target = await db.select().from(staff).where(eq(staff.id, staffId)).get();
  if (!target) return { ok: false as const, error: "ไม่พบพนักงาน" };

  // ชื่อผู้ใช้ต้องไม่ซ้ำคนอื่น
  const dupe = await db
    .select({ id: staff.id })
    .from(staff)
    .where(and(eq(staff.username, username), ne(staff.id, staffId)))
    .get();
  if (dupe) return { ok: false as const, error: "ชื่อผู้ใช้นี้มีคนใช้แล้ว" };

  // ต้องมีรหัส ถ้าพนักงานคนนี้ยังไม่มีรหัสเดิม
  if (!input.password && !target.passwordHash) {
    return { ok: false as const, error: "ตั้งรหัสผ่านครั้งแรกก่อนนะ" };
  }
  if (input.password && input.password.length < 8) {
    return { ok: false as const, error: "รหัสอย่างน้อย 8 ตัว" };
  }

  // กันลดสิทธิ์ admin คนสุดท้าย
  if (target.role === "admin" && input.role !== "admin") {
    const otherAdmins = await db
      .select({ c: sql<number>`count(*)` })
      .from(staff)
      .where(and(eq(staff.role, "admin"), ne(staff.id, staffId)))
      .get();
    if (!otherAdmins || otherAdmins.c === 0) {
      return { ok: false as const, error: "ต้องมีแอดมินอย่างน้อย 1 คน" };
    }
  }

  const values: Record<string, unknown> = { username, role: input.role };
  if (input.password) values.passwordHash = await hashPassword(input.password);

  await db.update(staff).set(values).where(eq(staff.id, staffId)).run();
  revalidatePath("/settings");
  return { ok: true as const };
}

/** ยกเลิกบัญชีล็อกอิน (เหลือเป็นแค่ชื่อผู้ขาย) */
export async function removeStaffLogin(staffId: number) {
  if (!(await requireAdmin())) return { ok: false as const, error: "เฉพาะแอดมิน" };
  const target = await db.select().from(staff).where(eq(staff.id, staffId)).get();
  if (target?.role === "admin") {
    const otherAdmins = await db
      .select({ c: sql<number>`count(*)` })
      .from(staff)
      .where(and(eq(staff.role, "admin"), ne(staff.id, staffId)))
      .get();
    if (!otherAdmins || otherAdmins.c === 0) {
      return { ok: false as const, error: "ต้องมีแอดมินอย่างน้อย 1 คน" };
    }
  }
  await db
    .update(staff)
    .set({ username: null, passwordHash: null, role: "staff" })
    .where(eq(staff.id, staffId))
    .run();
  revalidatePath("/settings");
  return { ok: true as const };
}

// ---------- รายจ่าย ----------

export type ExpenseInput = {
  title: string;
  category: string;
  amount: number;
  note: string;
};

export async function createExpense(input: ExpenseInput) {
  if (!input.title.trim() || !(input.amount > 0)) {
    return { ok: false as const, error: "ใส่รายการและจำนวนเงินก่อนนะ" };
  }
  await db.insert(expenses)
    .values({
      title: input.title.trim(),
      category: input.category,
      amount: input.amount,
      note: input.note.trim(),
      createdAt: new Date(),
    })
    .run();
  revalidatePath("/expenses");
  revalidatePath("/reports");
  return { ok: true as const };
}

export async function deleteExpense(id: number) {
  await db.delete(expenses).where(eq(expenses.id, id)).run();
  revalidatePath("/expenses");
  revalidatePath("/reports");
  return { ok: true as const };
}

// ---------- วัตถุดิบ (คลัง) ----------

export type IngredientInput = {
  name: string;
  unit: string;
  emoji: string;
  stock: number;
  lowThreshold: number;
};

function revalidateStockPages() {
  revalidatePath("/ingredients");
  revalidatePath("/products");
  revalidatePath("/");
}

export async function createIngredient(input: IngredientInput) {
  if (!input.name.trim()) {
    return { ok: false as const, error: "ใส่ชื่อวัตถุดิบก่อนนะ" };
  }
  await db.insert(ingredients)
    .values({
      name: input.name.trim(),
      unit: input.unit.trim() || "หน่วย",
      emoji: input.emoji || "📦",
      stock: Math.max(0, input.stock) || 0,
      lowThreshold: Math.max(0, input.lowThreshold) || 0,
    })
    .run();
  revalidateStockPages();
  return { ok: true as const };
}

export async function updateIngredient(id: number, input: IngredientInput) {
  if (!input.name.trim()) {
    return { ok: false as const, error: "ใส่ชื่อวัตถุดิบก่อนนะ" };
  }
  await db.update(ingredients)
    .set({
      name: input.name.trim(),
      unit: input.unit.trim() || "หน่วย",
      emoji: input.emoji || "📦",
      lowThreshold: Math.max(0, input.lowThreshold) || 0,
    })
    .where(eq(ingredients.id, id))
    .run();
  revalidateStockPages();
  return { ok: true as const };
}

/** เติม/ตัดวัตถุดิบ (ไม่ให้ติดลบ) */
export async function adjustIngredientStock(id: number, delta: number) {
  await db.update(ingredients)
    .set({ stock: sql`MAX(0, ${ingredients.stock} + ${delta})` })
    .where(eq(ingredients.id, id))
    .run();
  revalidateStockPages();
  return { ok: true as const };
}

export async function deleteIngredient(id: number) {
  await db.delete(ingredients).where(eq(ingredients.id, id)).run();
  revalidateStockPages();
  return { ok: true as const };
}

// ---------- โต๊ะ (QR ordering) ----------

function revalidateTablePages() {
  revalidatePath("/settings");
  revalidatePath("/staff");
  revalidatePath("/kitchen");
}

/** สร้าง qr_token ที่ไม่ซ้ำ */
async function uniqueTableToken(): Promise<string> {
  const existing = new Set(
    (await db.select({ t: restaurantTables.qrToken }).from(restaurantTables).all()).map((r) => r.t),
  );
  let n = 1;
  while (existing.has(`table-${n}`)) n++;
  return `table-${n}`;
}

export async function createTable(name: string) {
  if (!name.trim()) return { ok: false as const, error: "ใส่ชื่อโต๊ะก่อนนะ" };
  await db.insert(restaurantTables)
    .values({
      name: name.trim(),
      qrToken: await uniqueTableToken(),
      status: "available",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .run();
  revalidateTablePages();
  return { ok: true as const };
}

export async function renameTable(id: number, name: string) {
  if (!name.trim()) return { ok: false as const, error: "ใส่ชื่อโต๊ะก่อนนะ" };
  await db.update(restaurantTables)
    .set({ name: name.trim(), updatedAt: new Date() })
    .where(eq(restaurantTables.id, id))
    .run();
  revalidateTablePages();
  return { ok: true as const };
}

export async function toggleTable(id: number, isActive: boolean) {
  await db.update(restaurantTables)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(restaurantTables.id, id))
    .run();
  revalidateTablePages();
  return { ok: true as const };
}

export async function deleteTable(id: number) {
  // กันลบโต๊ะที่กำลังมีรอบใช้งานอยู่
  const active = await db
    .select()
    .from(tableSessions)
    .where(and(eq(tableSessions.tableId, id), eq(tableSessions.status, "active")))
    .get();
  if (active) {
    return { ok: false as const, error: "โต๊ะนี้กำลังมีออเดอร์อยู่ ปิดบิลก่อนนะ" };
  }
  await db.delete(restaurantTables).where(eq(restaurantTables.id, id)).run();
  revalidateTablePages();
  return { ok: true as const };
}
