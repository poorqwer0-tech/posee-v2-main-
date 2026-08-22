import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";
import { publicOrigin } from "@/lib/request-origin";

export async function POST(request: NextRequest) {
  // origin จาก header (ไม่ใช่ request.url = 0.0.0.0 บน standalone) → ถูกทั้ง funnel/LAN/localhost
  const response = NextResponse.redirect(new URL("/login", publicOrigin(request)), 303);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
