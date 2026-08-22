/**
 * session cookie แบบ stateless เซ็นด้วย HMAC-SHA256
 * รูปแบบ: "<staffId>.<role>.<exp>.<sig>"  โดย sig = HMAC(secret, "<staffId>.<role>.<exp>")
 * exp = เวลาหมดอายุ (ms epoch) เซ็นรวมในลายเซ็น + ตรวจฝั่ง server → cookie ที่ copy ไปใช้ตลอดไม่ได้
 * ใช้ Web Crypto (crypto.subtle) → ทำงานได้ทั้ง Edge middleware และ Node server
 */
export const SESSION_COOKIE = "pos_session";
export type SessionRole = "admin" | "staff";
export type Session = { staffId: number; role: SessionRole };

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 ชม.

// C1: ห้ามมี fallback secret ที่ "ใช้งานได้จริง" — ไม่งั้นทุก install ที่ไม่ตั้ง token
// ใช้ secret เดียวกัน → คำนวณ admin cookie ปลอมได้. prod ต้องตั้ง POS_AUTH_TOKEN เอง (delivery/first-boot)
const DEV_ONLY_SECRET = "dev-insecure-pos-token-do-not-use-in-prod";
// secret ที่ "หลุดแล้ว" (เคย hardcode/publish ใน git history) → ห้ามใช้ใน prod เด็ดขาด
const KNOWN_WEAK_SECRETS = new Set([
  DEV_ONLY_SECRET,
  "local-restaurant-pos-token", // fallback เก่า อยู่ใน git history
]);

function sessionSecret(): string {
  const token = process.env.POS_AUTH_TOKEN;
  if (token && !KNOWN_WEAK_SECRETS.has(token)) return token;
  // prod แล้วไม่ตั้ง (หรือตั้งเป็นค่าที่หลุดแล้ว) = refuse to operate — session ทั้งหมด fail จนกว่าจะตั้งใหม่
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "POS_AUTH_TOKEN ไม่ได้ตั้ง หรือใช้ค่าที่หลุดแล้ว — ต้องตั้ง secret สุ่มต่อ install ก่อนรัน production",
    );
  }
  // dev เท่านั้น: ใช้ค่า dev ชั่วคราวเพื่อความสะดวก (ปลอมได้ แต่ dev ไม่แคร์)
  return DEV_ONLY_SECRET;
}

const encoder = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toHex(sig);
}

/** เทียบสตริงแบบ constant-time */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionCookie(staffId: number, role: SessionRole): Promise<string> {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = `${staffId}.${role}.${exp}`;
  return `${payload}.${await sign(payload)}`;
}

export async function verifySessionCookie(value: string | undefined): Promise<Session | null> {
  if (!value) return null;
  const idx = value.lastIndexOf(".");
  if (idx < 0) return null;
  const payload = value.slice(0, idx);
  const sig = value.slice(idx + 1);
  const expected = await sign(payload);
  if (!safeEqual(sig, expected)) return null;
  const [idStr, role, expStr] = payload.split(".");
  const staffId = Number(idStr);
  const exp = Number(expStr);
  if (!Number.isInteger(staffId) || (role !== "admin" && role !== "staff")) return null;
  // exp ต้องมี + ยังไม่หมดอายุ (cookie เก่า format ไม่มี exp → ตกไป = ต้อง login ใหม่)
  if (!Number.isFinite(exp) || exp < Date.now()) return null;
  return { staffId, role };
}
