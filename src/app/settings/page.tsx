import { headers } from "next/headers";
import { SettingsClient } from "@/components/SettingsClient";
import { getAllStaff, getAllTables, getSettings } from "@/lib/queries";
import { lanIpv4 } from "@/lib/network";
import { effectiveStaffAccess } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const s = await getSettings();
  const staff = await getAllStaff();
  const tables = await getAllTables();
  // ลิงก์ LAN สำหรับให้ staff สแกนเข้าใช้งานผ่าน Wi-Fi ร้าน (IP เครื่อง + port จาก host ที่เปิดอยู่)
  const host = (await headers()).get("host") ?? "";
  const port = host.includes(":") ? `:${host.split(":").pop()}` : "";
  const lanIp = lanIpv4();
  const lanUrl = lanIp ? `http://${lanIp}${port}` : null;
  // โหมดที่ใช้จริง (cloud บังคับ public, env override) — ถ้าต่างจากที่ตั้งใน DB = toggle ถูก override
  const dbMode = s.staffAccess === "public" ? "public" : "lan-only";
  const effectiveMode = effectiveStaffAccess(s.staffAccess);
  return (
    <SettingsClient
      staffAccess={dbMode}
      accessOverridden={effectiveMode !== dbMode || (effectiveMode === "public" && !!process.env.VERCEL)}
      tableAutoOpen={s.tableAutoOpen}
      lanUrl={lanUrl}
      initial={{
        shopName: s.shopName,
        logoEmoji: s.logoEmoji,
        primaryColor: s.primaryColor,
        phone: s.phone,
        address: s.address,
        receiptFooter: s.receiptFooter,
        promptPayId: s.promptPayId,
        serviceChargePct: s.serviceChargePct,
        vatPct: s.vatPct,
      }}
      staff={staff.map((s) => ({
        id: s.id,
        name: s.name,
        emoji: s.emoji,
        color: s.color,
        isActive: s.isActive,
        username: s.username,
        role: s.role === "admin" ? "admin" : "staff",
        hasLogin: !!s.passwordHash,
      }))}
      tables={tables.map((t) => ({
        id: t.id,
        name: t.name,
        qrToken: t.qrToken,
        isActive: t.isActive,
      }))}
    />
  );
}
