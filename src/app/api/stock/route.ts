import { NextResponse } from "next/server";
import { db } from "@/db";
import { ingredients } from "@/db/schema";
import { eq } from "drizzle-orm";

/** GET /api/stock — ดึงรายการสต็อกทั้งหมด */
export async function GET() {
  try {
    const items = await db.select().from(ingredients);
    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** POST /api/stock — เพิ่มวัตถุดิบใหม่ */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, unit, emoji, stock, lowThreshold } = body;
    if (!name) {
      return NextResponse.json({ error: "กรุณาใส่ชื่อวัตถุดิบ" }, { status: 400 });
    }
    const [item] = await db
      .insert(ingredients)
      .values({
        name,
        unit: unit || "หน่วย",
        emoji: emoji || "📦",
        stock: stock ?? 0,
        lowThreshold: lowThreshold ?? 0,
      })
      .returning();
    return NextResponse.json({ item });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** DELETE /api/stock?id=xx — ลบวัตถุดิบ */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));
    if (!id) {
      return NextResponse.json({ error: "ต้องระบุ id" }, { status: 400 });
    }
    await db.delete(ingredients).where(eq(ingredients.id, id));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
