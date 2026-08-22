import { db } from "./index";
import {
  expenses,
  ingredients,
  orderItems,
  orders,
  restaurantTables,
  products,
  recipeItems,
  settings,
  staff,
} from "./schema";
import { count, eq } from "drizzle-orm";
import { hashPassword } from "@/lib/password";
import { bootstrapAdminPassword } from "@/lib/auth-config";
import { ensureOrderCounter } from "@/lib/order-ops";

/** สร้างบัญชี admin ตั้งต้น (username "admin") ถ้ายังไม่มี — กันล็อกตัวเองออก */
/**
 * สร้างบัญชี admin ตั้งต้น — เฉพาะ fast-path แบบ non-interactive (cloud/CI)
 * ถ้าตั้ง POS_ADMIN_PASSWORD เท่านั้น. ถ้าไม่ตั้ง → ไม่สร้าง (ปล่อยให้ /setup wizard สร้างเอง
 * ด้วยรหัสที่เจ้าของตั้ง) เพื่อเลี่ยง admin รหัสอ่อน default
 */
export async function ensureAdminAccount() {
  const admin = await db.select().from(staff).where(eq(staff.username, "admin")).get();
  if (admin) return;
  const pw = bootstrapAdminPassword();
  if (!pw) return; // ไม่มี env = ให้ตั้งผ่าน /setup wizard
  const passwordHash = await hashPassword(pw);
  await db
    .insert(staff)
    .values({
      name: "แอดมิน",
      emoji: "👑",
      color: "#D93A2B",
      isActive: true,
      username: "admin",
      passwordHash,
      role: "admin",
    })
    .run();
  // env fast-path = ถือว่าตั้งค่าร้านแล้ว (ไม่ต้องเจอ wizard)
  await db.update(settings).set({ configured: true }).where(eq(settings.id, 1)).run();
}

/** เมนูตั้งต้นจากร้านก๋วยเตี๋ยวต้มยำมหาชัย */
export const SEED_PRODUCTS = [
  { name: "ก๋วยเตี๋ยวน้ำใส", category: "ก๋วยเตี๋ยว", price: 75, image: "🍜", photo: "/menu/restaurant/kuayteow-namsai.jpg", isActive: true },
  { name: "ก๋วยเตี๋ยวต้มยำ", category: "ก๋วยเตี๋ยว", price: 75, image: "🍜", photo: "/menu/restaurant/kuayteow-tomyum.jpg", isActive: true },
  { name: "ก๋วยเตี๋ยวเย็นตาโฟ", category: "ก๋วยเตี๋ยว", price: 75, image: "🍜", photo: "/menu/restaurant/kuayteow-yentafo.jpg", isActive: true },
  { name: "ก๋วยเตี๋ยวทะเล", category: "ก๋วยเตี๋ยว", price: 160, image: "🦐", photo: "/menu/restaurant/kuayteow-seafood.jpg", isActive: true },
  { name: "ก๋วยเตี๋ยวคั่วไก่-หมู-ทะเล", category: "ก๋วยเตี๋ยว", price: 95, image: "🍜", photo: "/menu/restaurant/kuayteow-kua.jpg", isActive: true },
  { name: "เกาเหลาลูกชิ้นปลาเยาวราช-ลูกชิ้นหมูนครปฐม", category: "เกาเหลา", price: 90, image: "🥣", photo: null, isActive: true },
  { name: "เกาเหลาทะเล", category: "เกาเหลา", price: 150, image: "🦐", photo: null, isActive: true },
  { name: "ข้าวกระเพรา หมู-ไก่", category: "ข้าว", price: 75, image: "🍛", photo: "/menu/restaurant/krapao-pork-chicken.jpg", isActive: true },
  { name: "ข้าวกระเพราทะเล", category: "ข้าว", price: 140, image: "🦐", photo: "/menu/restaurant/krapao-seafood.jpg", isActive: true },
  { name: "ข้าวผัด หมู-ไก่", category: "ข้าว", price: 75, image: "🍚", photo: null, isActive: true },
  { name: "ข้าวผัดทะเล", category: "ข้าว", price: 120, image: "🦐", photo: null, isActive: true },
  { name: "ข้าวสวยเปล่า", category: "ข้าว", price: 20, image: "🍚", photo: null, isActive: true },
  { name: "ลูกชิ้นลวกจิ้มลูกชิ้นปลาเยาวราช-ลูกชิ้นหมูหมูเด้งนครปฐม", category: "ของกินเล่น", price: 100, image: "🐟", photo: "/menu/restaurant/lookchin-luakjim.jpg", isActive: true },
  { name: "เกี๊ยวเปล่าทอด", category: "ของกินเล่น", price: 50, image: "🥟", photo: "/menu/restaurant/fried-wonton.jpg", isActive: true },
  { name: "น้ำเปล่าสิงห์", category: "เครื่องดื่ม", price: 10, image: "💧", photo: "/menu/restaurant/singha-water.jpg", isActive: true },
  { name: "น้ำแป๊ปซี่เล็ก", category: "เครื่องดื่ม", price: 20, image: "🥤", photo: "/menu/restaurant/pepsi-small.jpg", isActive: true },
  { name: "แป๊ปซี่ใหญ่", category: "เครื่องดื่ม", price: 40, image: "🥤", photo: null, isActive: true },
  { name: "อเมริกาโน่", category: "คาเฟ่", price: 60, image: "☕", photo: null, isActive: true },
  { name: "เอสเพรสโซ่ espresso", category: "คาเฟ่", price: 60, image: "☕", photo: null, isActive: true },
  { name: "คาปูชิโน่ cappuccino", category: "คาเฟ่", price: 60, image: "☕", photo: null, isActive: true },
  { name: "ลาเต้ latte", category: "คาเฟ่", price: 60, image: "☕", photo: null, isActive: true },
  { name: "มอคค่า mocha", category: "คาเฟ่", price: 60, image: "☕", photo: null, isActive: true },
  { name: "แบล็คคอฟฟี่ฮันนี่เลม่อน blackcoffeehoneylemon", category: "คาเฟ่", price: 60, image: "☕", photo: null, isActive: true },
  { name: "ชาไทย นมสด", category: "คาเฟ่", price: 60, image: "🍵", photo: null, isActive: true },
  { name: "โกโก้ นมสด", category: "คาเฟ่", price: 60, image: "🥛", photo: null, isActive: true },
  { name: "ช็อคโกแล็ต นมสด", category: "คาเฟ่", price: 60, image: "🥛", photo: null, isActive: true },
  { name: "นมชมพู", category: "คาเฟ่", price: 60, image: "🥛", photo: null, isActive: true },
  { name: "ชามะนาว", category: "คาเฟ่", price: 60, image: "🍋", photo: null, isActive: true },
  { name: "น้ำผึ้งมะนาว", category: "คาเฟ่", price: 60, image: "🍋", photo: null, isActive: true },
  { name: "ชาเขียวมะนาว", category: "คาเฟ่", price: 60, image: "🍵", photo: null, isActive: true },
  { name: "น้ำบ๊วย", category: "คาเฟ่", price: 50, image: "🥤", photo: null, isActive: true },
];

/** คลังวัตถุดิบตั้งต้น (ตัวที่ stock ต่ำไว้โชว์การเตือน) */
export const SEED_INGREDIENTS = [
  { name: "เมล็ดกาแฟ", unit: "กรัม", emoji: "🫘", stock: 5000, lowThreshold: 800 },
  { name: "นมสด", unit: "มล.", emoji: "🥛", stock: 9000, lowThreshold: 2000 },
  { name: "ผงมัทฉะ", unit: "กรัม", emoji: "🍵", stock: 120, lowThreshold: 150 },
  { name: "ผงชาไทย", unit: "กรัม", emoji: "🧡", stock: 1000, lowThreshold: 250 },
  { name: "ไซรัปคาราเมล", unit: "มล.", emoji: "🍮", stock: 1500, lowThreshold: 300 },
  { name: "ผงโกโก้", unit: "กรัม", emoji: "🍫", stock: 1200, lowThreshold: 250 },
  { name: "ไข่มุก", unit: "กรัม", emoji: "🧋", stock: 2500, lowThreshold: 500 },
  { name: "มะนาว", unit: "ลูก", emoji: "🍋", stock: 40, lowThreshold: 12 },
  { name: "วิปครีม", unit: "มล.", emoji: "🍦", stock: 900, lowThreshold: 250 },
  { name: "แก้ว", unit: "ใบ", emoji: "🥤", stock: 600, lowThreshold: 150 },
  { name: "ครัวซองต์ (พร้อมขาย)", unit: "ชิ้น", emoji: "🥐", stock: 12, lowThreshold: 6 },
  { name: "บราวนี่ (พร้อมขาย)", unit: "ชิ้น", emoji: "🍫", stock: 6, lowThreshold: 6 },
  { name: "ชีสเค้ก (พร้อมขาย)", unit: "ชิ้น", emoji: "🍰", stock: 0, lowThreshold: 5 },
  { name: "คุกกี้ (พร้อมขาย)", unit: "ชิ้น", emoji: "🍪", stock: 24, lowThreshold: 10 },
  { name: "น้ำเปล่า (ขวด)", unit: "ขวด", emoji: "💧", stock: 100, lowThreshold: 24 },
  { name: "โซดาเลมอน (ขวด)", unit: "ขวด", emoji: "🥤", stock: 20, lowThreshold: 12 },
];

/** สูตรของแต่ละเมนู: ใช้วัตถุดิบอะไร อย่างละเท่าไหร่ ต่อ 1 หน่วยขาย */
export const SEED_RECIPES: Record<string, { ing: string; qty: number }[]> = {
};

/** รายจ่ายตัวอย่าง (วันนี้) */
export const SEED_EXPENSES = [
  { title: "เมล็ดกาแฟ 2 กก.", category: "วัตถุดิบ", amount: 700, note: "" },
  { title: "นมสด 12 กล่อง", category: "วัตถุดิบ", amount: 480, note: "" },
  { title: "ค่าน้ำแข็ง", category: "วัตถุดิบ", amount: 120, note: "" },
];

export const SEED_SETTINGS = {
  shopName: "ร้านของฉัน",
  logoEmoji: "🍽️",
  primaryColor: "",
  phone: "",
  address: "",
  receiptFooter: "ขอบคุณที่ใช้บริการ",
  promptPayId: "",
  serviceChargePct: 0,
  vatPct: 0,
  staffAccess: "lan-only",
  tableAutoOpen: false,
  configured: false,
};

/** พนักงานขายตั้งต้น */
export const SEED_STAFF = [
  { name: "มะปราง", emoji: "🌸", color: "#c0734e", isActive: true },
  { name: "โอ๊ต", emoji: "🧋", color: "#7c9b5e", isActive: true },
  { name: "ปอนด์", emoji: "☕", color: "#6f4e37", isActive: true },
];

/** โต๊ะตัวอย่างสำหรับ QR ordering */
export const SEED_TABLES = Array.from({ length: 12 }, (_, i) => ({
  name: `โต๊ะ ${i + 1}`,
  qrToken: `table-${i + 1}`,
  status: "available",
  isActive: true,
}));

/** วันนี้ เวลา h:m (สำหรับข้อมูลตัวอย่าง) */
function todayAt(h: number, m: number): Date {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

/** บิลตัวอย่าง 5 รายการ */
export const SEED_ORDERS = [
  {
    orderNo: "A1042",
    method: "เงินสด",
    status: "ready",
    staff: "มะปราง",
    at: todayAt(9, 12),
    items: [
      { name: "ลาเต้", emoji: "☕", price: 55, qty: 1 },
      { name: "ครัวซองต์", emoji: "🥐", price: 55, qty: 1 },
    ],
  },
  {
    orderNo: "A1041",
    method: "โอน",
    status: "ready",
    staff: "โอ๊ต",
    at: todayAt(8, 55),
    items: [{ name: "อเมริกาโน่", emoji: "☕", price: 50, qty: 2 }],
  },
  {
    orderNo: "A1040",
    method: "เงินสด",
    status: "ready",
    staff: "ปอนด์",
    at: todayAt(8, 30),
    items: [
      { name: "ชาไทยเย็น", emoji: "🧡", price: 50, qty: 1 },
      { name: "คุกกี้ช็อกชิป", emoji: "🍪", price: 35, qty: 1 },
      { name: "มัทฉะ ลาเต้", emoji: "🍵", price: 60, qty: 1 },
    ],
  },
  {
    orderNo: "A1039",
    method: "บัตร",
    status: "ready",
    staff: "มะปราง",
    at: todayAt(8, 5),
    items: [
      { name: "มอคค่า", emoji: "🍫", price: 60, qty: 1 },
      { name: "ชีสเค้ก", emoji: "🍰", price: 75, qty: 1 },
    ],
  },
  {
    orderNo: "A1038",
    method: "เงินสด",
    status: "ยกเลิก",
    staff: "โอ๊ต",
    at: todayAt(7, 50),
    items: [{ name: "เอสเพรสโซ่", emoji: "☕", price: 45, qty: 1 }],
  },
];

/** ใส่ข้อมูลตั้งต้นทั้งหมด (เรียกตอน DB ว่าง) */
export async function seedDatabase() {
  const insertedProducts = await db
    .insert(products)
    .values(SEED_PRODUCTS)
    .returning({ id: products.id, name: products.name })
    .all();
  const productByName = new Map(insertedProducts.map((p) => [p.name, p.id]));

  const insertedIngredients = await db
    .insert(ingredients)
    .values(SEED_INGREDIENTS)
    .returning({ id: ingredients.id, name: ingredients.name })
    .all();
  const ingByName = new Map(insertedIngredients.map((i) => [i.name, i.id]));

  // สร้างสูตรของแต่ละเมนู
  const recipeRows: { productId: number; ingredientId: number; qty: number }[] = [];
  for (const [productName, items] of Object.entries(SEED_RECIPES)) {
    const pid = productByName.get(productName);
    if (!pid) continue;
    for (const it of items) {
      const iid = ingByName.get(it.ing);
      if (iid) recipeRows.push({ productId: pid, ingredientId: iid, qty: it.qty });
    }
  }
  if (recipeRows.length) await db.insert(recipeItems).values(recipeRows).run();

  await db.insert(settings).values({ ...SEED_SETTINGS }).run();
  await db.insert(expenses).values(SEED_EXPENSES).run();
  await db.insert(restaurantTables).values(SEED_TABLES).run();

  const insertedStaff = await db
    .insert(staff)
    .values(SEED_STAFF)
    .returning({ id: staff.id, name: staff.name })
    .all();
  const staffByName = new Map(insertedStaff.map((s) => [s.name, s.id]));

  for (const o of SEED_ORDERS) {
    const sub = o.items.reduce((s, it) => s + it.price * it.qty, 0);
    const inserted = await db
      .insert(orders)
      .values({
        orderNo: o.orderNo,
        total: sub,
        discount: 0,
        finalTotal: sub,
        paymentMethod: o.method,
        status: o.status,
        staffId: staffByName.get(o.staff) ?? null,
        staffName: o.staff,
        createdAt: o.at,
      })
      .returning({ id: orders.id })
      .get();

    await db.insert(orderItems)
      .values(
        o.items.map((it) => ({
          orderId: inserted.id,
          productName: it.name,
          emoji: it.emoji,
          price: it.price,
          quantity: it.qty,
          subtotal: it.price * it.qty,
        })),
      )
      .run();
  }
}

/** ใส่ข้อมูลตั้งต้นเฉพาะตอน DB ยังว่าง (idempotent) */
/**
 * boot: ให้แอปพร้อมทำงานบน DB ที่ migrate แล้ว — **ไม่ใส่ข้อมูลร้าน** (deliverable = ไม่มีข้อมูล)
 * - สร้าง settings row เดียว (configured=0) ถ้ายังไม่มี → แอปบูตได้ + /setup wizard พาตั้งค่า
 * - admin: สร้างเฉพาะ fast-path (มี POS_ADMIN_PASSWORD) ไม่งั้นให้ wizard สร้าง
 * เมนู/พนักงาน/โต๊ะตัวอย่าง (ต้มยำ) ย้ายไป `npm run db:seed` (seedDatabase) สำหรับ demo/course เท่านั้น
 */
export async function ensureSeeded() {
  try {
    const settingCount = await db.select({ c: count() }).from(settings).get();
    if (!settingCount || settingCount.c === 0) {
      await db.insert(settings).values({ ...SEED_SETTINGS }).run();
    }
    await ensureOrderCounter(); // #3: ตัวนับเลขบิล atomic
    await ensureAdminAccount();
  } catch {
    // ตารางอาจยังไม่ถูกสร้าง (ยังไม่ได้ migrate) — ข้ามไปก่อน
  }
}
