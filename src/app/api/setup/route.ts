import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings, staff } from "@/db/schema";
import { hashPassword } from "@/lib/password";
import { createSessionCookie, SESSION_COOKIE } from "@/lib/session";
import { publicOrigin, requestIsHttps } from "@/lib/request-origin";
import { ensureSeeded } from "@/db/seed-data";

// ตั้งค่าร้านครั้งแรก — สร้าง admin + เขียน settings + configured=1 แล้ว log in ให้เลย
// เรียกได้เฉพาะตอนยังไม่ configured (middleware กันไว้แล้ว + กันซ้ำที่นี่)
export async function POST(request: NextRequest) {
  const origin = publicOrigin(request);
  const back = (err: string) => {
    const url = new URL("/setup", origin);
    url.searchParams.set("error", err);
    return NextResponse.redirect(url, 303);
  };

  await ensureSeeded(); // ให้แน่ใจว่ามี settings row
  const current = await db.select().from(settings).where(eq(settings.id, 1)).get();
  if (current?.configured) {
    // ตั้งค่าแล้ว — ห้ามตั้งซ้ำ (กันยึดบัญชี)
    return NextResponse.redirect(new URL("/", origin), 303);
  }

  const form = await request.formData();
  const shopName = String(form.get("shopName") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const promptPayId = String(form.get("promptPayId") ?? "").trim();
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  if (!shopName) return back("shopName");
  if (!/^[a-z0-9_.-]{3,32}$/.test(username)) return back("username");
  if (password.length < 8) return back("password");
  if (password !== confirm) return back("confirm");

  const passwordHash = await hashPassword(password);

  // อัปเดต settings ของร้าน + mark configured
  await db
    .update(settings)
    .set({ shopName, phone, promptPayId, configured: true })
    .where(eq(settings.id, 1))
    .run();

  // สร้างบัญชี admin (ถ้ามี admin อยู่แล้ว = ตั้ง login/รหัสให้แถวนั้น)
  const existingAdmin = await db.select().from(staff).where(eq(staff.username, username)).get();
  let adminId: number;
  if (existingAdmin) {
    await db.update(staff).set({ passwordHash, role: "admin", isActive: true }).where(eq(staff.id, existingAdmin.id)).run();
    adminId = existingAdmin.id;
  } else {
    const created = await db
      .insert(staff)
      .values({
        name: "แอดมิน",
        emoji: "👑",
        color: "#D93A2B",
        isActive: true,
        username,
        passwordHash,
        role: "admin",
      })
      .returning({ id: staff.id })
      .get();
    adminId = created.id;
  }

  // log in ให้เลย
  const response = NextResponse.redirect(new URL("/", origin), 303);
  response.cookies.set(SESSION_COOKIE, await createSessionCookie(adminId, "admin"), {
    httpOnly: true,
    sameSite: "lax",
    secure: requestIsHttps(request),
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
