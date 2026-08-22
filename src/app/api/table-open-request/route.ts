import { NextResponse, type NextRequest } from "next/server";
import { requestOpenTableFromApi } from "@/lib/restaurant-order-service";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await requestOpenTableFromApi(String(body.tableToken ?? ""));
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
