import { NextResponse, type NextRequest } from "next/server";
import { updateRestaurantOrderStatusFromApi } from "@/lib/restaurant-order-service";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await updateRestaurantOrderStatusFromApi(
    Number(body.orderId),
    String(body.status ?? ""),
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
