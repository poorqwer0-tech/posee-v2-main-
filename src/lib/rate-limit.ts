/**
 * rate limiter เก็บสถานะใน DB (fixed window) — กันเดารหัส login (H2)
 * ใช้ DB แทน in-memory เพราะ Vercel serverless มีหลาย instance ที่ไม่แชร์ memory
 * (in-memory เดิมทำงานเฉพาะ single/local). ทำ atomic ด้วย UPSERT ... RETURNING
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";

export type RateResult = { ok: boolean; retryAfterSec: number };

/**
 * @param key    คีย์แยกกลุ่ม (เช่น "login:ip:1.2.3.4")
 * @param limit  จำนวนครั้งสูงสุดในหน้าต่างเวลา
 * @param windowMs ความยาวหน้าต่าง (ms)
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateResult> {
  const now = Date.now();
  try {
    const row = await db
      .insert(rateLimits)
      .values({ key, count: 1, resetAt: now + windowMs })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          // หมดหน้าต่างแล้ว → เริ่มนับใหม่, ไม่งั้น +1 (atomic ในสเตตเมนต์เดียว)
          count: sql`CASE WHEN ${rateLimits.resetAt} < ${now} THEN 1 ELSE ${rateLimits.count} + 1 END`,
          resetAt: sql`CASE WHEN ${rateLimits.resetAt} < ${now} THEN ${now + windowMs} ELSE ${rateLimits.resetAt} END`,
        },
      })
      .returning({ count: rateLimits.count, resetAt: rateLimits.resetAt })
      .get();
    if (!row) return { ok: true, retryAfterSec: 0 };
    if (row.count > limit) {
      return { ok: false, retryAfterSec: Math.max(1, Math.ceil((row.resetAt - now) / 1000)) };
    }
    return { ok: true, retryAfterSec: 0 };
  } catch {
    // DB มีปัญหา → ไม่บล็อก (login route มี guard อื่น) — fail-open เฉพาะ rate-limit
    return { ok: true, retryAfterSec: 0 };
  }
}

/** ล้างตัวนับของ key (เรียกตอน login สำเร็จ) */
export async function resetRateLimit(key: string): Promise<void> {
  try {
    await db.delete(rateLimits).where(sql`${rateLimits.key} = ${key}`).run();
  } catch {
    /* ไม่เป็นไร */
  }
}
