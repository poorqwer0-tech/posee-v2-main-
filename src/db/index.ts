import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * เชื่อมต่อฐานข้อมูลผ่าน libSQL (Turso บน cloud หรือไฟล์ SQLite local)
 * - local:  DATABASE_URL=file:sqlite.db  (dev/ทดสอบ)
 * - Turso:  DATABASE_URL=libsql://xxx.turso.io  + DATABASE_AUTH_TOKEN=...
 * schema ยังเป็น SQLite เดิมทุกอย่าง — เปลี่ยนแค่ driver เป็น async
 */
const raw = process.env.DATABASE_URL || "file:sqlite.db";
// เผื่อค่าเก่าเป็น path เปล่า (เช่น "sqlite.db") → เติม file: ให้
const url = raw.includes("://") || raw.startsWith("file:") ? raw : `file:${raw}`;
const authToken = process.env.DATABASE_AUTH_TOKEN;

const globalForDb = globalThis as unknown as { libsql?: Client };

const client = globalForDb.libsql ?? createClient({ url, authToken });
if (process.env.NODE_ENV !== "production") globalForDb.libsql = client;

export const db = drizzle(client, { schema });
export { schema };
