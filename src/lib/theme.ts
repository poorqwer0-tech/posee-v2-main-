/**
 * white-label สีหลัก: แปลง hex ที่เจ้าของร้านเลือก → override CSS token
 * ใส่เป็น inline style บน <html> (ชนะ :root ใน stylesheet, ไม่มี flash, ทำงานทั้ง light/dark)
 * คืน null ถ้าค่าว่าง/ไม่ใช่ hex → ไม่ override = ใช้ธีมเริ่มต้นทุกอย่าง
 *
 * override เฉพาะตระกูล primary + gradient โลโก้ (สี neutral/พื้นหลังคงเดิม)
 */
export function primaryOverride(hex: string | null | undefined): Record<string, string> | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec((hex ?? "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;

  const dark = (c: number) => Math.round(c * 0.6); // เฉดเข้ม (ปุ่มกด/เงา)
  const light = (c: number) => Math.round(c + (255 - c) * 0.2); // เฉดอ่อน (ปลาย gradient)
  const hx = (x: number, y: number, z: number) =>
    "#" + [x, y, z].map((c) => c.toString(16).padStart(2, "0")).join("");

  const dr = dark(r), dg = dark(g), db = dark(b);
  const lr = light(r), lg = light(g), lb = light(b);

  return {
    "--brand-primary": `${r} ${g} ${b}`,
    "--brand-primaryDark": `${dr} ${dg} ${db}`,
    "--c-primary": hx(r, g, b),
    "--c-primary-dark": hx(dr, dg, db),
    "--c-logo-grad": `linear-gradient(145deg, ${hx(r, g, b)}, ${hx(lr, lg, lb)})`,
  };
}
