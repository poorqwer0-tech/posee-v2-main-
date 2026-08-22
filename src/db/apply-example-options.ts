/**
 * ใส่ตัวอย่างตัวเลือกเมนู (ตามที่เจ้าของร้านให้มา) ลงเมนูที่ตรง
 * รันครั้งเดียว: `npx tsx src/db/apply-example-options.ts`
 * (เมนูอื่นตั้งค่าเองได้ที่หน้า "เมนู" → แก้ไข → ตัวเลือกเมนู)
 */
import { eq } from "drizzle-orm";
import { db } from "./index";
import { products } from "./schema";

type Group = {
  title: string;
  min: number;
  max: number;
  options: { label: string; price: number }[];
};

const TAKEAWAY: Group = {
  title: "กลับบ้าน",
  min: 0,
  max: 1,
  options: [{ label: "กลับบ้าน", price: 0 }],
};

// ข้าวกระเพราทะเล
const KRAPAO_SEAFOOD: Group[] = [
  { title: "เพิ่มเติม", min: 0, max: 1, options: [{ label: "ไข่ดาว", price: 15 }] },
  {
    title: "ประเภทของกระเพราทะเล",
    min: 1,
    max: 1,
    options: [
      { label: "น้องหมึกที่รัก", price: 0 },
      { label: "พี่กุ้ง", price: 0 },
      { label: "พี่กุ้งกับน้องหมึก", price: 0 },
      { label: "รวมเพื่อนหมู พี่กุ้ง กับน้องหมึก", price: 0 },
    ],
  },
  {
    title: "ขนาดข้าวกระเพราทะเล",
    min: 1,
    max: 1,
    options: [
      { label: "ธรรมดา", price: 0 },
      { label: "พิเศษ", price: 60 },
      { label: "จัมโบ้", price: 100 },
    ],
  },
  TAKEAWAY,
];

// ลูกชิ้นลวกจิ้ม / เกาเหลา
const LUAK_JIM: Group[] = [
  {
    title: "ประเภทของลวกจิ้ม",
    min: 1,
    max: 1,
    options: [
      { label: "ลูกชิ้นปลาเยาวราช", price: 0 },
      { label: "ลูกชิ้นหมูกะหมูเด้งๆนครปฐม", price: 0 },
      { label: "เราสองลูกรวมกันทั้งปลาทั้งหมู", price: 0 },
    ],
  },
  {
    title: "ขนาดลวกจิ้มลูกชิ้นปลาเยาวราช-ลูกชิ้นหมูกะหมูเด้ง นครปฐม",
    min: 1,
    max: 1,
    options: [
      { label: "ธรรมดา", price: 0 },
      { label: "พิเศษ", price: 50 },
      { label: "จัมโบ้", price: 100 },
    ],
  },
];

// จับคู่ตามชื่อ (contains) → ตัวเลือก
const RULES: { match: string; groups: Group[] }[] = [
  { match: "ข้าวกระเพราทะเล", groups: KRAPAO_SEAFOOD },
  { match: "เกาเหลาลูกชิ้นปลา", groups: LUAK_JIM },
  { match: "ลูกชิ้นลวกจิ้ม", groups: LUAK_JIM },
  { match: "เกี๊ยวเปล่าทอด", groups: [TAKEAWAY] },
];

const all = await db.select().from(products).all();
let n = 0;
for (const rule of RULES) {
  const target = all.find((p) => p.name.includes(rule.match));
  if (!target) {
    console.log(`⚠️  ไม่พบเมนูที่ตรงกับ "${rule.match}"`);
    continue;
  }
  await db.update(products)
    .set({ options: JSON.stringify(rule.groups) })
    .where(eq(products.id, target.id))
    .run();
  console.log(`✅ ตั้งตัวเลือกให้ "${target.name}" (${rule.groups.length} กลุ่ม)`);
  n++;
}
console.log(`\n🎉 เสร็จ ${n} เมนู`);
process.exit(0);
