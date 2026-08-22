import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * โครงสร้างฐานข้อมูลตาม PRD
 * ทุกอย่างเก็บในไฟล์ SQLite เดียว (ข้อมูลร้านอยู่ในเครื่องผู้ใช้)
 */

// สินค้า/เมนู
export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  category: text("category").notNull(), // กาแฟ / ชา / ขนม / อื่นๆ
  price: real("price").notNull(),
  image: text("image").notNull().default("☕"), // emoji ใช้เป็นไอคอนเล็ก/สำรอง
  photo: text("photo"), // path รูปจริง เช่น /menu/latte.png (ว่างได้)
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  isSoldOut: integer("is_sold_out", { mode: "boolean" }).notNull().default(false),
  options: text("options"), // JSON: ตัวเลือกเมนู (ตั้งค่าต่อเมนู) — null = ใช้ค่าเริ่มต้นตามหมวด
});

// โต๊ะในร้าน สำหรับ QR ordering
export const restaurantTables = sqliteTable("restaurant_tables", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  qrToken: text("qr_token").notNull(),
  status: text("status").notNull().default("available"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// รอบการนั่งของลูกค้า 1 กลุ่มต่อ 1 โต๊ะ
export const tableSessions = sqliteTable("table_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tableId: integer("table_id")
    .notNull()
    .references(() => restaurantTables.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("active"),
  // โทเคนลับต่อรอบ — ลูกค้าต้องใช้ token นี้ (ไม่ใช่ qr_token ตายตัว) ในการสั่ง/เก็บตัง
  // ตายเมื่อปิดโต๊ะ (session ไม่ active) → ลิงก์เก่าใช้ไม่ได้
  orderToken: text("order_token"),
  total: real("total").notNull().default(0),
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  openedAt: integer("opened_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  closedAt: integer("closed_at", { mode: "timestamp" }),
});

// วัตถุดิบ/คลังของร้าน (เมล็ดกาแฟ, นม, แก้ว ...)
export const ingredients = sqliteTable("ingredients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  unit: text("unit").notNull().default("หน่วย"), // กรัม / มล. / ชิ้น / ใบ / ลูก ...
  emoji: text("emoji").notNull().default("📦"),
  stock: real("stock").notNull().default(0), // คงเหลือ (หน่วยเดียวกับ unit)
  lowThreshold: real("low_threshold").notNull().default(0), // จุดเตือนใกล้หมด
});

// สูตร: เมนูหนึ่งใช้วัตถุดิบอะไรบ้าง อย่างละเท่าไหร่ต่อ 1 แก้ว/ชิ้น
export const recipeItems = sqliteTable("recipe_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  ingredientId: integer("ingredient_id")
    .notNull()
    .references(() => ingredients.id, { onDelete: "cascade" }),
  qty: real("qty").notNull(), // ปริมาณวัตถุดิบต่อ 1 หน่วยขาย
});

// รายจ่ายของร้าน
export const expenses = sqliteTable("expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  category: text("category").notNull().default("อื่นๆ"), // วัตถุดิบ / ค่าเช่า / เงินเดือน / อื่นๆ
  amount: real("amount").notNull(),
  note: text("note").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// พนักงานขาย (เป็นทั้งชื่อผู้ขาย และบัญชีล็อกอินได้)
export const staff = sqliteTable("staff", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("🧑"), // avatar
  color: text("color").notNull().default("#6f4e37"), // สีป้าย
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  username: text("username"), // ชื่อผู้ใช้สำหรับล็อกอิน (null = ล็อกอินไม่ได้ เป็นแค่ชื่อผู้ขาย)
  passwordHash: text("password_hash"), // scrypt: salt:hash
  role: text("role").notNull().default("staff"), // admin | staff
});

// บิล/ออเดอร์
export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderNo: text("order_no").notNull(),
  total: real("total").notNull(), // ยอดก่อนหักส่วนลด
  discount: real("discount").notNull().default(0), // เปอร์เซ็นต์ส่วนลด
  finalTotal: real("final_total").notNull(), // ยอดสุทธิ
  paymentMethod: text("payment_method").notNull(), // เงินสด / โอน / บัตร
  status: text("status").notNull().default("new"), // new(รับออเดอร์) / ready(ทำเสร็จ) / paid / cancelled
  tableId: integer("table_id").references(() => restaurantTables.id),
  tableSessionId: integer("table_session_id").references(() => tableSessions.id),
  note: text("note").notNull().default(""),
  staffId: integer("staff_id"), // อ้างถึงพนักงานที่ขาย (อาจว่างได้)
  staffName: text("staff_name"), // เก็บชื่อพนักงานไว้กับบิล (denormalized)
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// รายการในแต่ละบิล
export const orderItems = sqliteTable("order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: integer("product_id"),
  productName: text("product_name").notNull(),
  emoji: text("emoji").notNull().default("☕"),
  price: real("price").notNull(),
  quantity: integer("quantity").notNull(),
  subtotal: real("subtotal").notNull(),
  status: text("status").notNull().default("new"),
  note: text("note").notNull().default(""),
  servedAt: integer("served_at", { mode: "timestamp" }),
});

// คำขอเก็บเงินจากลูกค้า
export const paymentRequests = sqliteTable("payment_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tableSessionId: integer("table_session_id")
    .notNull()
    .references(() => tableSessions.id, { onDelete: "cascade" }),
  tableId: integer("table_id")
    .notNull()
    .references(() => restaurantTables.id, { onDelete: "cascade" }),
  amount: real("amount").notNull(),
  status: text("status").notNull().default("requested"),
  promptpayPayload: text("promptpay_payload").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  paidAt: integer("paid_at", { mode: "timestamp" }),
  confirmedByStaffId: integer("confirmed_by_staff_id").references(() => staff.id),
});

// ตั้งค่าร้าน (มีแถวเดียว id = 1)
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shopName: text("shop_name").notNull().default("ร้านของฉัน"),
  logoEmoji: text("logo_emoji").notNull().default("🍽️"), // อีโมจิโลโก้ร้าน (white-label)
  primaryColor: text("primary_color").notNull().default(""), // สีหลัก hex (ว่าง = ใช้ธีมเริ่มต้น)
  phone: text("phone").notNull().default(""),
  address: text("address").notNull().default(""), // ที่อยู่ร้าน (โชว์บนใบเสร็จ)
  receiptFooter: text("receipt_footer").notNull().default(""),
  promptPayId: text("promptpay_id").notNull().default(""),
  serviceChargePct: real("service_charge_pct").notNull().default(0), // ค่าบริการ %
  vatPct: real("vat_pct").notNull().default(0), // ภาษีมูลค่าเพิ่ม %
  // โหมดเข้าถึงหน้า staff: "lan-only" = เฉพาะ WiFi ร้าน (ปลอดภัย default) | "public" = เข้าจากเน็ตได้ (หลัง login)
  staffAccess: text("staff_access").notNull().default("lan-only"),
  // ลูกค้าสแกน QR โต๊ะแล้วสั่งได้เลย (auto-open) — false = โหมดเข้ม ต้อง "ขอเปิดโต๊ะ" ให้ staff อนุมัติก่อน (default ปลอดภัย)
  tableAutoOpen: integer("table_auto_open", { mode: "boolean" }).notNull().default(false),
  // ตั้งค่าร้านครั้งแรกเสร็จหรือยัง (0 = ยังไม่ตั้ง → บังคับไปหน้า /setup)
  configured: integer("configured", { mode: "boolean" }).notNull().default(false),
});

// ตัวนับ atomic (เช่น เลขบิล) — UPDATE ... RETURNING = race-free กันเลขบิลชนกันหลายเครื่อง
export const counters = sqliteTable("counters", {
  name: text("name").primaryKey(),
  value: integer("value").notNull().default(0),
});

// rate limit (กันเดารหัส) — เก็บใน DB → แชร์ข้าม instance บน serverless (in-memory ใช้ไม่ได้บน cloud)
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  resetAt: integer("reset_at").notNull().default(0),
});

// ===== ระบบสต๊อกสินค้าแยก (stock management app) =====
export const stockProducts = sqliteTable("stock_products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  sku: text("sku").notNull().unique(),
  qty: real("qty").notNull().default(0),
  unit: text("unit").notNull().default("ชิ้น"),
  price: real("price").notNull().default(0),
});

export const stockMovements = sqliteTable("stock_movements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sku: text("sku").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // รับเข้า / เบิกออก / ปรับยอด
  qty: real("qty").notNull(),
  balance: real("balance").notNull(),
  date: text("date").notNull(),
  user: text("user").notNull().default(""),
  note: text("note").notNull().default(""),
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type Staff = typeof staff.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Ingredient = typeof ingredients.$inferSelect;
export type RecipeItem = typeof recipeItems.$inferSelect;
export type RestaurantTable = typeof restaurantTables.$inferSelect;
export type TableSession = typeof tableSessions.$inferSelect;
export type PaymentRequest = typeof paymentRequests.$inferSelect;
