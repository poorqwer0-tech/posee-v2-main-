import type { NextRequest } from "next/server";

/**
 * origin สาธารณะจริงจาก header — ห้ามใช้ `request.url` / `request.nextUrl.origin`
 * เพราะ Next standalone ตั้ง host = `HOSTNAME` env (เช่น 0.0.0.0) ไม่ใช่ Host header
 * → redirect (login/logout/middleware) จะเด้งไป `0.0.0.0:PORT` พังทั้ง funnel/LAN
 * ใช้ตัวนี้แทน → ถูกทั้ง funnel (`x.ts.net`) / LAN (`192.168.x`) / localhost
 */
/** scheme จริงของ request (funnel/https ส่ง x-forwarded-proto มา, LAN ตรง = http) */
export function requestProto(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-proto") ??
    request.nextUrl.protocol.replace(":", "")
  );
}

/** request เข้ามาแบบ https จริงไหม → ใช้ตั้ง cookie Secure (ห้ามตั้ง Secure บน http = browser ทิ้ง) */
export function requestIsHttps(request: NextRequest): boolean {
  return requestProto(request) === "https";
}

export function publicOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = requestProto(request);
  return host ? `${proto}://${host}` : request.nextUrl.origin;
}

/**
 * sanitize ค่า `next` (redirect หลัง login) กัน open-redirect
 * รับเฉพาะ path ภายในเว็บ: ขึ้นด้วย "/" ตัวเดียว, ไม่ใช่ "//host", ไม่มี scheme "://", ไม่มี backslash
 * ไม่ผ่าน → คืน fallback ("/")
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  const v = (next ?? "").trim();
  if (!v.startsWith("/")) return fallback; // ต้องเป็น absolute path ในเว็บ
  if (v.startsWith("//") || v.startsWith("/\\")) return fallback; // protocol-relative
  if (v.includes("://") || v.includes("\\")) return fallback; // scheme / backslash trick
  if (v.includes("\n") || v.includes("\r")) return fallback; // header injection
  return v;
}

/** IP อยู่ในวง private (RFC1918) หรือ loopback — = อยู่ LAN/เครื่องเดียวกัน */
function isPrivateIp(ip: string): boolean {
  const a = ip.trim();
  if (a === "::1" || a.startsWith("127.")) return true; // loopback
  if (a.startsWith("10.") || a.startsWith("192.168.")) return true;
  // 172.16.0.0 – 172.31.255.255
  const m = /^172\.(\d{1,3})\./.exec(a);
  if (m) {
    const b = Number(m[1]);
    if (b >= 16 && b <= 31) return true;
  }
  // IPv6 unique-local fc00::/7
  if (/^f[cd][0-9a-f]{2}:/i.test(a)) return true;
  return false;
}

/**
 * โหมดเข้าถึงหน้า staff ที่ "ใช้จริง" หลังพิจารณา platform + env override
 * - `POS_STAFF_ACCESS` env (public|lan-only) = break-glass override ทุก platform
 *   (ไว้กู้ตอน admin เผลอเปิด lan-only แล้วออกนอก LAN → ตั้ง env + restart)
 * - บน cloud (`VERCEL`) ไม่มี LAN → lan-only จะล็อกทุกคนออกโดยไม่มีประโยชน์ → บังคับ public
 * - อื่นๆ (local/single) = ใช้ค่าจาก DB (lan-only เป็น default ที่ถูกต้องของ single)
 */
export function effectiveStaffAccess(dbValue: string | undefined): "lan-only" | "public" {
  const override = process.env.POS_STAFF_ACCESS;
  if (override === "public" || override === "lan-only") return override;
  if (process.env.VERCEL) return "public"; // cloud = ไม่มี LAN
  return dbValue === "public" ? "public" : "lan-only";
}

/**
 * request มาจาก LAN จริงไหม (staff บน WiFi ร้าน) — ใช้คุมว่าหน้า staff เข้าจากเน็ตได้ไหม
 * **fail-closed**: ไม่ชัด = ถือว่า remote (ไม่ใช่ LAN) → บล็อก
 *
 * signal (พิสูจน์บน standalone + funnel 2026-07-07):
 * - funnel ใส่ header `tailscale-*` และ/หรือ x-forwarded-for = tailnet(100.64/10)/public IP
 * - LAN client ต่อตรง → x-forwarded-for = private IP, host = LAN IP, ไม่มี tailscale-*
 * คนนอกยิงผ่าน funnel ปลอม Host เป็น LAN IP ไม่ช่วย เพราะ x-forwarded-for (tailscaled ใส่) ยังเป็น public
 */
export function isLanRequest(request: NextRequest): boolean {
  // 1) มี tailscale header ใดๆ = มาทาง tailnet/funnel = ไม่ใช่ LAN ตรง
  for (const key of request.headers.keys()) {
    if (key.toLowerCase().startsWith("tailscale-")) return false;
  }
  // 2) host เป็นโดเมน funnel = public
  const host = (request.headers.get("host") ?? "").toLowerCase();
  if (host.endsWith(".ts.net")) return false;
  // 3) เชื่อ IP ขวาสุดของ x-forwarded-for (ตัวที่ proxy ที่เชื่อถือได้ใส่ให้)
  const xff = request.headers.get("x-forwarded-for");
  if (!xff) return false; // ไม่มีข้อมูล = fail-closed
  const ip = xff.split(",").pop()?.trim() ?? "";
  return isPrivateIp(ip);
}
