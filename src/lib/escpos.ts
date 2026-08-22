/**
 * สร้างคำสั่ง ESC/POS สำหรับบิลครัว (kitchen ticket) เครื่องพิมพ์ความร้อน 58/80mm
 *
 * ⚠️ ภาษาไทยบนเครื่องพิมพ์ความร้อนต้องใช้ codepage TIS-620 (single-byte)
 * โค้ดนี้แปลง Unicode ไทย (U+0E01..U+0E5B) → ไบต์ 0xA1..0xFB
 * และเลือก code table ด้วย `ESC t THAI_CODE_TABLE`
 *
 * THAI_CODE_TABLE ต่างกันตามรุ่นเครื่องพิมพ์ (Epson มักเป็น 20/0x14, บางรุ่น 255)
 * ถ้าไทยออกมาเป็นตัวขยะ ให้ลองเปลี่ยนค่านี้
 */
export const THAI_CODE_TABLE = 20; // ปรับตามรุ่นเครื่องพิมพ์ถ้าไทยเพี้ยน (โหมด tis620)

/**
 * โหมดเข้ารหัสข้อความ:
 *   "tis620" = เครื่องพิมพ์ Epson/ESC-POS ทั่วไป (single-byte + ESC t code table)
 *   "utf8"   = เครื่องพิมพ์ในตัว Sunmi (รับ UTF-8 โดยตรง ไม่ใช้ code table) ← แก้ไทยเพี้ยนบน Sunmi
 */
export type PrinterEncoding = "tis620" | "utf8";

// คำสั่งบอก Sunmi ให้ตีความข้อความเป็น UTF-8 (FS & + FS C 0xFF)
const SUNMI_UTF8_ON = [0x1c, 0x26, 0x1c, 0x43, 0xff];

export type TicketItem = { name: string; quantity: number; note?: string };
export type KitchenTicket = {
  tableName: string;
  orderNo: string;
  time: string;
  items: TicketItem[];
  note?: string;
};

/** แปลงข้อความ 1 บรรทัด → ไบต์ ตามโหมดเข้ารหัส */
function encodeLine(text: string, encoding: PrinterEncoding): number[] {
  if (encoding === "utf8") {
    return Array.from(new TextEncoder().encode(text)); // ไทยเป็น UTF-8 multi-byte
  }
  const out: number[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 32;
    if (cp >= 0x0e01 && cp <= 0x0e5b) {
      out.push(cp - 0x0e00 + 0xa0); // Thai → TIS-620
    } else if (cp < 0x80) {
      out.push(cp); // ASCII
    } else {
      out.push(0x3f); // "?" สำหรับตัวที่แปลงไม่ได้
    }
  }
  return out;
}

// คำสั่ง ESC/POS พื้นฐาน
const ESC = 0x1b;
const GS = 0x1d;

/** สร้าง byte buffer ของบิลครัว 1 ใบ พร้อมส่งเข้าเครื่องพิมพ์ */
export function buildKitchenTicket(t: KitchenTicket, encoding: PrinterEncoding = "tis620"): Uint8Array {
  const bytes: number[] = [];
  const raw = (...b: number[]) => bytes.push(...b);
  const line = (s = "") => {
    raw(...encodeLine(s, encoding));
    raw(0x0a);
  };

  raw(ESC, 0x40); // init
  if (encoding === "utf8") raw(...SUNMI_UTF8_ON); // Sunmi: โหมด UTF-8
  else raw(ESC, 0x74, THAI_CODE_TABLE); // Epson: code table ไทย
  raw(ESC, 0x61, 0x01); // จัดกึ่งกลาง

  // หัว: ชื่อโต๊ะ ตัวใหญ่ 2 เท่า + หนา
  raw(ESC, 0x21, 0x30); // double width+height
  raw(GS, 0x21, 0x11);
  line(t.tableName);
  raw(ESC, 0x21, 0x00); // reset ขนาด
  raw(GS, 0x21, 0x00);

  line(`บิลครัว  ${t.orderNo}`);
  line(t.time);

  raw(ESC, 0x61, 0x00); // ชิดซ้าย
  line("--------------------------------");

  // รายการ — ชื่อ + จำนวนตัวใหญ่, โน้ตขึ้นบรรทัดใหม่
  raw(ESC, 0x21, 0x08); // emphasized
  for (const it of t.items) {
    line(`x${it.quantity}  ${it.name}`);
    if (it.note && it.note.trim()) {
      raw(ESC, 0x21, 0x00);
      for (const nl of it.note.split("\n")) line(`     - ${nl}`);
      raw(ESC, 0x21, 0x08);
    }
  }
  raw(ESC, 0x21, 0x00);

  if (t.note && t.note.trim()) {
    line("--------------------------------");
    line(`หมายเหตุ: ${t.note}`);
  }

  raw(0x0a, 0x0a, 0x0a); // เว้นท้าย
  raw(GS, 0x56, 0x00); // ตัดกระดาษ

  return Uint8Array.from(bytes);
}

/* ─────────── ใบเสร็จลูกค้า (customer receipt) ─────────── */

// กว้างกระดาษ 58mm ≈ 32 ตัวอักษร (font A). ถ้าใช้ 80mm เปลี่ยนเป็น 48
export const RECEIPT_WIDTH = 32;

// ใช้ field เดียวกับใบเสร็จบนจอ (import แบบ type-only → ไม่ดึง client component เข้ามา)
import type { ReceiptData } from "@/components/Receipt";

/** จำนวนเงิน → ข้อความ (ปัดเป็นจำนวนเต็ม + คั่นหลักพัน ไม่มีสัญลักษณ์) */
function money(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/** นับความยาวแบบ code point (ไทย 1 ตัว = 1 ไบต์ใน TIS-620) */
function len(s: string): number {
  return [...s].length;
}

/** จัด 2 คอลัมน์: ซ้ายชิดซ้าย ขวาชิดขวา เต็มความกว้างกระดาษ */
function twoCol(left: string, right: string, w = RECEIPT_WIDTH): string {
  const r = len(right);
  let l = [...left];
  if (l.length + r + 1 > w) l = l.slice(0, Math.max(0, w - r - 1)); // ตัดซ้ายถ้ายาวเกิน
  const gap = Math.max(1, w - l.length - r);
  return l.join("") + " ".repeat(gap) + right;
}

/** สร้าง byte buffer ของใบเสร็จ 1 ใบ (58mm) */
export function buildReceipt(d: ReceiptData, encoding: PrinterEncoding = "tis620"): Uint8Array {
  const bytes: number[] = [];
  const raw = (...b: number[]) => bytes.push(...b);
  const line = (s = "") => {
    raw(...encodeLine(s, encoding));
    raw(0x0a);
  };
  const rule = () => line("-".repeat(RECEIPT_WIDTH));

  raw(ESC, 0x40); // init
  if (encoding === "utf8") raw(...SUNMI_UTF8_ON); // Sunmi: โหมด UTF-8
  else raw(ESC, 0x74, THAI_CODE_TABLE); // Epson: code table ไทย

  // หัวบิล — ชื่อร้านตัวใหญ่ + ข้อมูลร้าน จัดกึ่งกลาง
  raw(ESC, 0x61, 0x01); // center
  raw(ESC, 0x21, 0x30); // double width+height
  raw(GS, 0x21, 0x11);
  line(d.shopName);
  raw(ESC, 0x21, 0x00);
  raw(GS, 0x21, 0x00);
  if (d.address) line(d.address);
  if (d.phone) line(`โทร. ${d.phone}`);

  raw(ESC, 0x61, 0x00); // left
  rule();

  // ข้อมูลบิล
  line(twoCol("เลขที่บิล", d.orderNo));
  line(twoCol("วันที่/เวลา", d.dateTime));
  line(twoCol("ชำระโดย", d.method));
  if (d.staffName) line(twoCol("พนักงาน", d.staffName));
  rule();

  // รายการสินค้า — ชื่อ+ยอดรวมบรรทัดเดียว, จำนวน×ราคาบรรทัดถัดไป
  for (const it of d.items) {
    line(twoCol(it.name, money(it.subtotal)));
    line(`  ${it.qty} x ${money(it.price)}`);
  }
  rule();

  // สรุปยอด
  line(twoCol("ยอดรวม", money(d.subtotal)));
  if (d.adjustment)
    line(twoCol("ปรับยอด", `${d.adjustment > 0 ? "+" : "-"}${money(Math.abs(d.adjustment))}`));
  if (d.discountPct > 0) line(twoCol(`ส่วนลด ${d.discountPct}%`, `-${money(d.discountAmt)}`));
  if (d.serviceChargePct && d.serviceChargePct > 0)
    line(twoCol(`ค่าบริการ ${d.serviceChargePct}%`, money(d.serviceAmt ?? 0)));
  if (d.vatPct && d.vatPct > 0) line(twoCol(`VAT ${d.vatPct}%`, money(d.vatAmt ?? 0)));

  // ยอดสุทธิ ตัวใหญ่ (double width+height → กว้างครึ่งเดียว = 16 ตัว)
  raw(ESC, 0x21, 0x30);
  line(twoCol("รวมสุทธิ", money(d.finalTotal), RECEIPT_WIDTH / 2));
  raw(ESC, 0x21, 0x00);
  rule();

  // ท้ายบิล
  if (d.footer) {
    raw(ESC, 0x61, 0x01); // center
    for (const fl of d.footer.split("\n")) line(fl);
    raw(ESC, 0x61, 0x00);
  }

  raw(0x0a, 0x0a, 0x0a);
  raw(GS, 0x56, 0x00); // ตัดกระดาษ

  return Uint8Array.from(bytes);
}
