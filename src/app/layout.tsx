import type { Metadata, Viewport } from "next";
import { Mali, Itim } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { ensureSeeded, SEED_SETTINGS } from "@/db/seed-data";
import { getCurrentRole } from "@/lib/auth-session";
import { getSettings, getTodaySales } from "@/lib/queries";
import { primaryOverride } from "@/lib/theme";

const mali = Mali({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mali",
  display: "swap",
});

const itim = Itim({
  subsets: ["thai", "latin"],
  weight: "400",
  variable: "--font-itim",
  display: "swap",
});

// ชื่อร้าน/คำอธิบายดึงจาก settings (white-label — เปลี่ยนได้ที่หน้า "ตั้งค่า")
export async function generateMetadata(): Promise<Metadata> {
  // DB อาจยังไม่พร้อมตอน build → fallback ชื่อ default (กัน prerender พัง)
  let shopName = SEED_SETTINGS.shopName;
  try {
    shopName = (await getSettings()).shopName;
  } catch {
    /* DB ยังไม่พร้อม — ใช้ default */
  }
  return {
    title: `${shopName} · POS`,
    description: `ระบบขายหน้าร้าน ${shopName}`,
  };
}

// viewportFit=cover → env(safe-area-inset-*) มีค่าใน WebView (Sunmi) → ปุ่มพ้นแถบระบบล่าง
export const viewport: Viewport = {
  viewportFit: "cover",
};

// ตั้งธีมที่จำไว้ก่อน paint (กันจอกระพริบตอนโหลด)
const THEME_INIT = `(function(){try{var t=localStorage.getItem('pos-theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // DB อาจยังไม่พร้อมตอน build (preview/self-host ก่อน migrate — ไม่มีตาราง) →
  // degrade ด้วยค่า default แทนที่จะพัง build (prerender /_not-found ผ่าน layout)
  let todaySales = 0;
  let shopName = SEED_SETTINGS.shopName;
  let logoEmoji = SEED_SETTINGS.logoEmoji;
  let themeVars: Record<string, string> | null = null;
  try {
    await ensureSeeded(); // ใส่ข้อมูลตั้งต้นถ้าฐานข้อมูลว่าง (ครั้งแรกที่เปิด)
    todaySales = await getTodaySales();
    const s = await getSettings();
    shopName = s.shopName;
    logoEmoji = s.logoEmoji;
    themeVars = primaryOverride(s.primaryColor); // null ถ้าไม่ตั้งสี = ธีมเดิม
  } catch {
    // DB ยังไม่พร้อม (build-time / ยังไม่ migrate) — ใช้ค่า default ไปก่อน
  }
  const role = await getCurrentRole();

  return (
    <html lang="th" suppressHydrationWarning style={themeVars ?? undefined}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className={`${mali.variable} ${itim.variable} font-mali`}>
        <AppShell todaySales={todaySales} role={role} shopName={shopName} logoEmoji={logoEmoji}>{children}</AppShell>
      </body>
    </html>
  );
}
