import { NextResponse, type NextRequest } from "next/server";
import { requestTablePaymentFromApi } from "@/lib/restaurant-order-service";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await requestTablePaymentFromApi(String(body.orderToken ?? ""));
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
