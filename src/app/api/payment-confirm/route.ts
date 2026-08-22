import { NextResponse, type NextRequest } from "next/server";
import { confirmTablePaymentFromApi } from "@/lib/restaurant-order-service";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await confirmTablePaymentFromApi(
    Number(body.sessionId),
    Number(body.adjustment) || 0,
    typeof body.method === "string" && body.method ? body.method : "โอน",
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
