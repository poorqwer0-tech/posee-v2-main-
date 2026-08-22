import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionCookie } from "./lib/session";
import { publicOrigin, isLanRequest, effectiveStaffAccess } from "./lib/request-origin";
import { getSettings } from "./lib/queries";

// middleware อ่าน DB (settings.staffAccess) → ต้องรันบน Node runtime ไม่ใช่ edge
export const runtime = "nodejs";

// เข้าถึงได้เสมอ ไม่ผ่าน lan-only gate — หน้าลูกค้า + static + หน้าแจ้ง lan-only เอง
const TRULY_PUBLIC = [
  "/lan-only",
  "/api/table-order",
  "/api/payment-request",
  "/api/order-cancel",
  "/api/table-open-request",
  "/table",
  "/t",
  "/_next",
  "/menu",
  "/favicon.ico",
  "/icon.svg",
];

// H1: ทางเข้าล็อกอิน — ไม่ต้องมี session แต่ **ต้องผ่าน lan-only gate** (ไม่งั้น login โผล่เน็ต)
const AUTH_ENTRY = ["/login", "/api/login", "/api/logout"];

function matchPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

const STAFF_ALLOWED_PREFIXES = [
  "/", // หน้าขายของ (สั่งหน้าร้าน + ส่งเข้าโต๊ะ)
  "/staff",
  "/kitchen",
  "/help",
  "/stock",
  "/api/order-status",
  "/api/payment-confirm",
  "/api/payment-request",
  "/api/table-order",
  "/api/notifications",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // 1) หน้าลูกค้า/static — ผ่านเสมอ (funnel public ต้องใช้)
  if (matchPrefix(pathname, TRULY_PUBLIC)) return NextResponse.next();

  const { staffAccess, configured } = await getSettings();

  // 2) first-run gate — ยังไม่ตั้งค่าร้าน → บังคับไป /setup (setup path + static ผ่านได้)
  //    ตั้งค่าแล้ว → ห้ามกลับเข้า /setup อีก (กันตั้ง admin ซ้ำ)
  const isSetupPath = pathname === "/setup" || pathname.startsWith("/api/setup");
  if (!configured) {
    if (isSetupPath) return NextResponse.next();
    return NextResponse.redirect(new URL("/setup", publicOrigin(request)));
  }
  if (isSetupPath) return NextResponse.redirect(new URL("/", publicOrigin(request)));

  // 3) lan-only gate — ครอบทั้งหน้า staff/admin **และทางเข้าล็อกอิน** (H1)
  // ใช้ effectiveStaffAccess: cloud(VERCEL) บังคับ public (ไม่มี LAN → กันล็อกตัวเอง),
  // env POS_STAFF_ACCESS = break-glass. lan-only จริงเฉพาะ local/single
  if (effectiveStaffAccess(staffAccess) === "lan-only" && !isLanRequest(request)) {
    return NextResponse.redirect(new URL("/lan-only", publicOrigin(request)));
  }

  // 3) ทางเข้าล็อกอิน (ผ่าน gate แล้ว) — ไม่ต้องมี session
  if (matchPrefix(pathname, AUTH_ENTRY)) return NextResponse.next();

  const session = await verifySessionCookie(request.cookies.get(SESSION_COOKIE)?.value);

  if (session?.role === "admin") return NextResponse.next();
  if (session?.role === "staff") {
    if (matchPrefix(pathname, STAFF_ALLOWED_PREFIXES)) return NextResponse.next();
    return NextResponse.redirect(new URL("/staff", publicOrigin(request)));
  }

  const loginUrl = new URL("/login", publicOrigin(request));
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!.*\\..*).*)", "/icon.svg"],
};
