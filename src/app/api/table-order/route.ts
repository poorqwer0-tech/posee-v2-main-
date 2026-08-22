import { NextResponse, type NextRequest } from "next/server";
import { createTableOrderFromApi } from "@/lib/restaurant-order-service";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await createTableOrderFromApi({
    cart: Array.isArray(body.cart) ? body.cart : [],
    orderToken: String(body.orderToken ?? ""),
    note: String(body.note ?? ""),
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
