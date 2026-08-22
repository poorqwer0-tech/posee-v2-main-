import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { staff } from "@/db/schema";
import { verifyPassword } from "@/lib/password";
import { createSessionCookie, SESSION_COOKIE } from "@/lib/session";
import { publicOrigin, requestIsHttps, safeNextPath } from "@/lib/request-origin";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";

// H2: กันเดารหัส — ต่อ IP และต่อ username, หน้าต่าง 5 นาที
const LOGIN_LIMIT = 8;
const LOGIN_WINDOW_MS = 5 * 60_000;

function clientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() || "unknown";
}

function isAdminOnlyPath(pathname: string) {
  return ["/products", "/reports", "/settings", "/expenses", "/ingredients"].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  // H3: sanitize next กัน open-redirect (//evil.com, scheme://) → รับเฉพาะ path ในเว็บ
  const next = safeNextPath(formData.get("next") as string | null);
  const origin = publicOrigin(request);

  // H2: rate-limit ก่อนแตะ DB — เกินโควตา (ต่อ IP หรือ username) → 429 (เก็บสถานะใน DB = ใช้ได้บน serverless)
  const ip = clientIp(request);
  const ipHit = await checkRateLimit(`login:ip:${ip}`, LOGIN_LIMIT, LOGIN_WINDOW_MS);
  const userHit = username
    ? await checkRateLimit(`login:user:${username.toLowerCase()}`, LOGIN_LIMIT, LOGIN_WINDOW_MS)
    : { ok: true, retryAfterSec: 0 };
  if (!ipHit.ok || !userHit.ok) {
    const retry = Math.max(ipHit.retryAfterSec, userHit.retryAfterSec);
    const url = new URL("/login", origin);
    url.searchParams.set("error", "toomany");
    url.searchParams.set("next", next);
    const res = NextResponse.redirect(url, 303);
    res.headers.set("Retry-After", String(retry));
    return res;
  }

  const user = username
    ? await db.select().from(staff).where(eq(staff.username, username)).get()
    : undefined;
  const ok =
    !!user &&
    user.isActive &&
    !!user.passwordHash &&
    (await verifyPassword(password, user.passwordHash));

  if (!user || !ok) {
    const url = new URL("/login", origin);
    url.searchParams.set("error", "1");
    url.searchParams.set("next", next);
    return NextResponse.redirect(url, 303);
  }

  // login สำเร็จ → รีเซ็ตตัวนับของ ip + user (กันบล็อกคนที่พิมพ์ผิดแล้วเข้าถูก)
  await resetRateLimit(`login:ip:${ip}`);
  await resetRateLimit(`login:user:${username.toLowerCase()}`);

  const role = user.role === "admin" ? "admin" : "staff";
  // next ผ่าน safeNextPath แล้ว (ขึ้นด้วย "/" เสมอ); staff เข้า admin-only path → เด้ง /staff
  const target = role === "staff" && isAdminOnlyPath(next) ? "/staff" : next;
  const response = NextResponse.redirect(new URL(target, origin), 303);

  response.cookies.set(SESSION_COOKIE, await createSessionCookie(user.id, role), {
    httpOnly: true,
    sameSite: "lax",
    // C3: Secure ตาม scheme จริง ไม่ใช่ NODE_ENV — https(funnel)=on, http(LAN)=off
    // (Secure บน http → browser ทิ้ง cookie → staff login ผ่าน LAN ไม่ได้)
    secure: requestIsHttps(request),
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
