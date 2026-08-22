export const dynamic = "force-static";

type Section = {
  emoji: string;
  title: string;
  steps: string[];
};

const QUICK_START = [
  "ตั้งค่าร้าน + เพิ่มพนักงานขาย ที่หน้า “ตั้งค่า”",
  "เช็ก “วัตถุดิบ” ให้พอ แล้วตั้ง “สูตร” ของแต่ละเมนูที่หน้า “เมนู”",
  "เริ่มขายได้เลยที่หน้า “ขายของ” 🎉",
];

const SECTIONS: Section[] = [
  {
    emoji: "🛒",
    title: "ขายของ (หน้าขายหลัก)",
    steps: [
      "เลือกหมวดหมู่ด้านบน (ตามหมวดที่ตั้งไว้ในหน้าเมนู) แล้วแตะการ์ดเมนูเพื่อเพิ่มลงตะกร้า",
      "เลือก “พนักงานที่ขาย” ในแถบตะกร้าทางขวา เพื่อบันทึกว่าใครเป็นคนขาย",
      "ปรับจำนวนด้วยปุ่ม + / − และเลือกส่วนลด (ไม่ลด / 5% / 10% / 20%)",
      "กด “ชำระเงิน” → เลือกช่องทาง (เงินสด / โอน / บัตร) → “ยืนยันรับเงิน”",
      "หลังชำระจะเห็นใบเสร็จเต็มใน modal — กด “ปริ้นใบเสร็จ” ได้ทันที",
      "เมนูที่วัตถุดิบไม่พอจะขึ้นป้าย “หมด” และกดสั่งไม่ได้",
    ],
  },
  {
    emoji: "🍽️",
    title: "เมนู (จัดการเมนู + สูตร)",
    steps: [
      "กด “เพิ่มเมนูใหม่” กรอกชื่อ ราคา หมวดหมู่ และเลือกไอคอน",
      "ตั้ง “สูตร” โดยใส่จำนวนวัตถุดิบที่ใช้ต่อ 1 จาน/แก้ว/ชิ้น (เช่น 1 เมนู = วัตถุดิบหลัก 100g + เครื่องปรุง 10g)",
      "สลับสวิตช์เพื่อเปิด/ปิดการขายแต่ละเมนู (เมนูที่ปิดจะไม่ขึ้นหน้าขายของ)",
      "ป้าย “ทำได้อีก N” คำนวณอัตโนมัติจากวัตถุดิบที่เหลือ",
    ],
  },
  {
    emoji: "📦",
    title: "วัตถุดิบ (คลังของร้าน)",
    steps: [
      "เพิ่มวัตถุดิบ พร้อมหน่วย (กรัม/มล./ชิ้น…) จำนวนเริ่มต้น และ “จุดเตือนใกล้หมด”",
      "เติม/ตัดสต๊อกด้วยปุ่ม −10 / −1 / +1 / +10 หรือพิมพ์จำนวนแล้วกด “เติม”",
      "ระบบจะเตือนเมื่อวัตถุดิบต่ำกว่าจุดที่ตั้งไว้ (แถบด้านบน + ป้ายสีส้ม)",
      "เมื่อขายเมนู ระบบตัดวัตถุดิบให้อัตโนมัติตามสูตร",
    ],
  },
  {
    emoji: "🧾",
    title: "ออเดอร์ (ประวัติการขาย)",
    steps: [
      "ดูบิลย้อนหลังทั้งหมด พร้อมเวลา ยอดเงิน และพนักงานที่ขาย",
      "กด “ดู” เพื่อเปิดรายละเอียดบิล และกด “ปริ้น” เพื่อพิมพ์ใบเสร็จซ้ำ",
      "กด “ยกเลิกบิล” ได้ — ยอดที่ยกเลิกจะถูกหักออกจากรายงานยอดขาย",
    ],
  },
  {
    emoji: "📊",
    title: "รายงาน (สรุปร้าน)",
    steps: [
      "ดูยอดขาย / รายจ่าย / กำไรสุทธิ ของวันนี้แบบสรุป",
      "กราฟยอดขาย 7 วันล่าสุด และอันดับเมนูขายดี",
      "ยอดขายแยกตามพนักงาน — รู้ว่าใครขายได้เท่าไหร่",
    ],
  },
  {
    emoji: "💸",
    title: "รายจ่าย",
    steps: [
      "บันทึกค่าใช้จ่ายของร้าน แยกหมวด (วัตถุดิบ / ค่าเช่า / เงินเดือน / อุปกรณ์ / อื่นๆ)",
      "ยอดรายจ่ายจะนำไปคำนวณ “กำไรสุทธิ” ในหน้ารายงานให้อัตโนมัติ",
    ],
  },
  {
    emoji: "⚙️",
    title: "ตั้งค่า",
    steps: [
      "แก้ชื่อร้าน เบอร์โทร และข้อความท้ายใบเสร็จ (มีตัวอย่างใบเสร็จให้ดูสด ๆ)",
      "จัดการพนักงานขาย — เพิ่ม / เปิด-ปิด / ลบ (พนักงานที่เปิดอยู่จะเลือกได้ในหน้าขายของ)",
    ],
  },
  {
    emoji: "💾",
    title: "ข้อมูล & การสำรอง",
    steps: [
      "ข้อมูลทั้งหมด (เมนู/บิล/วัตถุดิบ/ตั้งค่า) อยู่ในไฟล์ sqlite.db บนเครื่องของคุณเอง",
      "สำรองข้อมูล = คัดลอกไฟล์ sqlite.db เก็บไว้",
      "ย้ายเครื่อง = คัดลอกไฟล์ sqlite.db ไปด้วย แล้วเปิดโปรแกรมตามปกติ",
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="flex-1 animate-fadeUp overflow-auto px-[26px] pb-[40px] pt-5">
      <div className="mx-auto max-w-[860px]">
        {/* Hero */}
        <div className="mb-4 flex items-center gap-4 rounded-[22px] bg-gradient-to-br from-brand-primary to-brand-sidebar px-7 py-6 text-[color:var(--c-on-primary)] shadow-[0_10px_28px_rgba(var(--c-sh),.2)]">
          <div className="text-[48px]">📖</div>
          <div>
            <div className="font-itim text-[26px] leading-tight">คู่มือการใช้งานระบบ POS</div>
            <div className="mt-1 text-[14px] text-[color:var(--c-on-primary-soft)]">
              ระบบขายหน้าร้าน — ใช้ง่าย ครบทั้งขาย สต๊อกวัตถุดิบ รายงาน และพนักงาน
            </div>
          </div>
        </div>

        {/* เริ่มใช้งานใน 3 ขั้น */}
        <div className="mb-4 rounded-[20px] bg-[var(--c-surface)] p-[22px] shadow-[0_6px_18px_rgba(var(--c-sh),.06)]">
          <div className="mb-4 font-itim text-[20px] text-brand-ink">เริ่มใช้งานใน 3 ขั้น 🚀</div>
          <div className="grid grid-cols-3 gap-3.5">
            {QUICK_START.map((s, i) => (
              <div
                key={i}
                className="rounded-[16px] border border-brand-border2 bg-brand-cream p-4"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary font-itim text-[16px] text-[color:var(--c-on-primary)]">
                  {i + 1}
                </div>
                <div className="mt-2.5 text-[14px] leading-snug text-brand-ink2">{s}</div>
              </div>
            ))}
          </div>
        </div>

        {/* รายละเอียดแต่ละหน้า */}
        <div className="grid grid-cols-2 gap-3.5">
          {SECTIONS.map((sec) => (
            <div
              key={sec.title}
              className="rounded-[20px] bg-[var(--c-surface)] p-[22px] shadow-[0_6px_18px_rgba(var(--c-sh),.06)]"
            >
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] bg-[var(--c-placeholder)] text-[24px]">
                  {sec.emoji}
                </div>
                <div className="font-itim text-[18px] text-brand-ink">{sec.title}</div>
              </div>
              <ul className="flex flex-col gap-2">
                {sec.steps.map((st, i) => (
                  <li key={i} className="flex gap-2 text-[13px] leading-snug text-brand-muted">
                    <span className="mt-0.5 flex-none text-accent-green">✓</span>
                    <span>{st}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-5 text-center text-[12px] text-brand-muted3">
          มีคำถามเพิ่มเติม? ติดต่อผู้ดูแลระบบของร้านได้เลย · posee v1.0
        </div>
      </div>
    </div>
  );
}
