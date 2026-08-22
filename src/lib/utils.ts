import generatePayload from "promptpay-qr";

/** จัดรูปแบบจำนวนเงินบาท เช่น 1100 -> ฿1,100 */
export function baht(n: number): string {
  return "฿" + Math.round(n).toLocaleString("en-US");
}

/** หมวดหมู่เมนู (พร้อม emoji) ที่ใช้ทั้งระบบ */
export const CATEGORIES = [
  { key: "ทั้งหมด", emoji: "🍽️" },
  { key: "ก๋วยเตี๋ยว", emoji: "🍜" },
  { key: "เกาเหลา", emoji: "🥣" },
  { key: "ข้าว", emoji: "🍛" },
  { key: "ของกินเล่น", emoji: "🥟" },
  { key: "เครื่องดื่ม", emoji: "🥤" },
  { key: "คาเฟ่", emoji: "☕" },
] as const;

/** หมวดหมู่สำหรับฟอร์มเพิ่ม/แก้ไขเมนู (ไม่รวม "ทั้งหมด") — ใช้เป็น "ตัวช่วยแนะนำ" เท่านั้น */
export const FORM_CATEGORIES = [
  "ก๋วยเตี๋ยว",
  "เกาเหลา",
  "ข้าว",
  "ของกินเล่น",
  "เครื่องดื่ม",
  "คาเฟ่",
];

// white-label หมวดเมนู: ร้านตั้งหมวดเองได้ (พิมพ์อิสระในฟอร์มเมนู) — chip กรองสร้างจากหมวดที่มีสินค้าจริง
const CATEGORY_EMOJI: Record<string, string> = {
  ก๋วยเตี๋ยว: "🍜",
  เกาเหลา: "🥣",
  ข้าว: "🍛",
  ของกินเล่น: "🥟",
  เครื่องดื่ม: "🥤",
  คาเฟ่: "☕",
};
export const DEFAULT_CATEGORY_EMOJI = "🍽️";
export function categoryEmoji(key: string): string {
  return CATEGORY_EMOJI[key] ?? DEFAULT_CATEGORY_EMOJI;
}

/** สร้างรายการหมวด (พร้อม emoji) จากสินค้าที่มีจริง — หมวดแนะนำมาก่อน แล้วตามด้วยหมวดที่ร้านสร้างเอง */
export function categoriesFromProducts(
  products: { category: string }[],
): { key: string; emoji: string }[] {
  const present = new Set(products.map((p) => p.category).filter(Boolean));
  const seen = new Set<string>();
  const out: { key: string; emoji: string }[] = [];
  for (const k of FORM_CATEGORIES) {
    if (present.has(k)) {
      out.push({ key: k, emoji: categoryEmoji(k) });
      seen.add(k);
    }
  }
  for (const p of products) {
    if (p.category && !seen.has(p.category)) {
      out.push({ key: p.category, emoji: categoryEmoji(p.category) });
      seen.add(p.category);
    }
  }
  return out;
}

/** ตัวเลือก emoji สำหรับเมนู */
export const EMOJI_CHOICES = [
  "🍜", "🥣", "🍛", "🥟", "🍚", "🦐", "🐟", "🐷", "🐔", "🥤", "💧", "☕", "🍵", "🍋", "🥛",
];

/** ช่องทางชำระเงิน */
export const PAYMENT_METHODS = [
  { key: "เงินสด", emoji: "💵" },
  { key: "โอน", emoji: "📱" },
  { key: "บัตร", emoji: "💳" },
];

/** เวลา HH:MM จาก Date */
export function timeLabel(d: Date): string {
  return d.toTimeString().slice(0, 5);
}

// สถานะที่ "เห็นจริง" มีแค่ 2 ขั้น: รับออเดอร์ → ทำเสร็จแล้ว (paid = จ่ายแล้ว แต่โชว์เป็น "ทำเสร็จแล้ว")
export const RESTAURANT_ORDER_STATUS = {
  new: "รับออเดอร์",
  ready: "ทำเสร็จแล้ว",
  paid: "ทำเสร็จแล้ว",
  cancelled: "ยกเลิก",
} as const;

/** payload PromptPay (EMVCo) — เอาไปวาดเป็น QR เองในเครื่อง (ไม่พึ่งเว็บนอก) */
export function promptPayPayload(promptPayId: string, amount: number): string {
  const cleanId = promptPayId.replace(/[^0-9]/g, "");
  const amt = Math.max(0, Math.round(amount * 100) / 100);
  return generatePayload(cleanId, amt > 0 ? { amount: amt } : {});
}

/** ลิงก์สั่งอาหารของโต๊ะ (ลูกค้าสแกนเปิด /table/<token>) — เอาไปวาดเป็น QR เอง */
export function tableOrderLink(origin: string, token: string): string {
  return `${origin}/table/${token}`;
}
