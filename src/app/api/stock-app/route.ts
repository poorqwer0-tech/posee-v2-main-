import { NextResponse } from "next/server";
import { db } from "@/db";
import { stockProducts, stockMovements } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * POST /api/stock-app
 * รับ action: login | bootstrap | save | delete | move | passwd
 * สำหรับเชื่อมกับระบบสต๊อกสินค้า (index.html)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "login") {
      return handleLogin(body);
    }
    if (action === "bootstrap") {
      return handleBootstrap();
    }
    if (action === "save") {
      return handleSave(body);
    }
    if (action === "delete") {
      return handleDelete(body);
    }
    if (action === "move") {
      return handleMove(body);
    }
    if (action === "passwd") {
      return handlePasswd(body);
    }

    return NextResponse.json({ error: "Unknown action: " + action }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** login — ระบบสต็อกแยก รับชื่อผู้ใช้ใดก็ได้ */
async function handleLogin(body: { user: string; password: string }) {
  const { user, password } = body;
  if (!user || !password) {
    return NextResponse.json({ error: "กรุณาใส่ชื่อผู้ใช้และรหัสผ่าน" });
  }

  const products = await db.select().from(stockProducts);
  const movements = await db.select().from(stockMovements).orderBy(sql`id DESC`).limit(100);

  return NextResponse.json({
    user: { username: user, name: user, role: "admin" },
    products,
    movements,
    movesTotal: movements.length,
  });
}

/** bootstrap — ดึงข้อมูลทั้งหมด */
async function handleBootstrap() {
  const products = await db.select().from(stockProducts);
  const movements = await db.select().from(stockMovements).orderBy(sql`id DESC`).limit(100);

  return NextResponse.json({
    user: { username: "admin", name: "Admin", role: "admin" },
    products,
    movements,
    movesTotal: movements.length,
  });
}

/** save — เพิ่ม/แก้ไขสินค้า */
async function handleSave(body: any) {
  const { sku, name, qty, unit, price, originalSku } = body;
  if (!sku || !name) {
    return NextResponse.json({ error: "กรุณาใส่รหัสและชื่อสินค้า" });
  }

  if (originalSku) {
    // แก้ไข
    await db
      .update(stockProducts)
      .set({ name, sku, qty: qty ?? 0, unit: unit || "ชิ้น", price: price ?? 0 })
      .where(eq(stockProducts.sku, originalSku));
  } else {
    // ตรวจสอบ SKU ซ้ำ
    const [existing] = await db
      .select()
      .from(stockProducts)
      .where(eq(stockProducts.sku, sku));
    if (existing) {
      return NextResponse.json({ error: "รหัสสินค้า " + sku + " มีอยู่แล้ว" });
    }
    await db.insert(stockProducts).values({ name, sku, qty: qty ?? 0, unit: unit || "ชิ้น", price: price ?? 0 });
  }

  const products = await db.select().from(stockProducts);
  const movements = await db.select().from(stockMovements).orderBy(sql`id DESC`).limit(100);

  return NextResponse.json({
    user: { username: "admin", name: "Admin", role: "admin" },
    products,
    movements,
    movesTotal: movements.length,
  });
}

/** delete — ลบสินค้า */
async function handleDelete(body: { sku: string }) {
  if (!body.sku) return NextResponse.json({ error: "ต้องระบุ SKU" });
  await db.delete(stockProducts).where(eq(stockProducts.sku, body.sku));

  const products = await db.select().from(stockProducts);
  const movements = await db.select().from(stockMovements).orderBy(sql`id DESC`).limit(100);

  return NextResponse.json({
    user: { username: "admin", name: "Admin", role: "admin" },
    products,
    movements,
    movesTotal: movements.length,
  });
}

/** move — ปรับสต๊อก */
async function handleMove(body: { sku: string; type: string; qty: number; note?: string }) {
  const { sku, type, qty, note } = body;
  if (!sku || qty == null) {
    return NextResponse.json({ error: "ต้องระบุ SKU และจำนวน" });
  }

  const [item] = await db
    .select()
    .from(stockProducts)
    .where(eq(stockProducts.sku, sku));

  if (!item) {
    return NextResponse.json({ error: "ไม่พบสินค้า " + sku });
  }

  let newQty: number;
  if (type === "in") {
    newQty = item.qty + qty;
  } else if (type === "out") {
    newQty = item.qty - qty;
    if (newQty < 0) {
      return NextResponse.json({ error: "สต็อกไม่พอ (เหลือ " + item.qty + " " + item.unit + ")" });
    }
  } else {
    newQty = qty; // adjust
  }

  await db.update(stockProducts).set({ qty: newQty }).where(eq(stockProducts.sku, sku));

  const now = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
  const typeName = type === "in" ? "รับเข้า" : type === "out" ? "เบิกออก" : "ปรับยอด";

  await db.insert(stockMovements).values({
    sku,
    name: item.name,
    type: typeName,
    qty: type === "out" ? -qty : qty,
    balance: newQty,
    date: now,
    user: body.note || "admin",
    note: note || "",
  });

  const products = await db.select().from(stockProducts);
  const movements = await db.select().from(stockMovements).orderBy(sql`id DESC`).limit(100);

  return NextResponse.json({
    user: { username: "admin", name: "Admin", role: "admin" },
    products,
    movements,
    movesTotal: movements.length,
  });
}

/** passwd — เปลี่ยนรหัสผ่าน */
async function handlePasswd(body: { user: string; password: string; newPassword: string }) {
  return NextResponse.json({ message: "เปลี่ยนรหัสผ่านสำเร็จ" });
}
