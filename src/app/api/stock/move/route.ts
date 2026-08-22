import { NextResponse } from "next/server";
import { db } from "@/db";
import { ingredients } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/stock/move — ปรับสต็อก (รับเข้า / เบิกออก / ปรับยอด)
 * body: { id, type: "in"|"out"|"adjust", qty, note? }
 */
export async function POST(req: Request) {
  try {
    const { id, type, qty } = await req.json();
    if (!id || !type || qty == null) {
      return NextResponse.json(
        { error: "ต้องระบุ id, type, qty" },
        { status: 400 }
      );
    }

    // ดึงข้อมูลวัตถุดิบปัจจุบัน
    const [item] = await db
      .select()
      .from(ingredients)
      .where(eq(ingredients.id, id));
    if (!item) {
      return NextResponse.json(
        { error: "ไม่พบวัตถุดิบ" },
        { status: 404 }
      );
    }

    let newStock: number;
    if (type === "in") {
      newStock = item.stock + qty;
    } else if (type === "out") {
      newStock = item.stock - qty;
      if (newStock < 0) {
        return NextResponse.json(
          { error: "สต็อกไม่พอ (เหลือ " + item.stock + " " + item.unit + ")" },
          { status: 400 }
        );
      }
    } else {
      // adjust — ตั้งค่าใหม่โดยตรง
      newStock = qty;
    }

    await db
      .update(ingredients)
      .set({ stock: newStock })
      .where(eq(ingredients.id, id));

    return NextResponse.json({
      item: { ...item, stock: newStock },
      type,
      qty,
      before: item.stock,
      after: newStock,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
