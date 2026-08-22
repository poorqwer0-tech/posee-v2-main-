import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { staff } from "@/db/schema";
import { SESSION_COOKIE, verifySessionCookie, type SessionRole } from "./session";

export type { SessionRole };

async function readSession() {
  const jar = await cookies();
  return verifySessionCookie(jar.get(SESSION_COOKIE)?.value);
}

export async function getCurrentRole(): Promise<SessionRole | null> {
  const s = await readSession();
  return s?.role ?? null;
}

/** โหลดผู้ใช้ปัจจุบันจาก session (ตรวจว่ายัง active) */
export async function getCurrentUser() {
  const s = await readSession();
  if (!s) return null;
  const u = await db.select().from(staff).where(eq(staff.id, s.staffId)).get();
  if (!u || !u.isActive) return null;
  return { id: u.id, name: u.name, emoji: u.emoji, role: s.role };
}
