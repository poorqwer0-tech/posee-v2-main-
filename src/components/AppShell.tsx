"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { SessionRole } from "@/lib/session";
import { baht } from "@/lib/utils";
import { SoundNotifier } from "./SoundNotifier";
import { ToastProvider } from "./Toast";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const NAV: NavItem[] = [
  {
    href: "/",
    label: "สั่งให้ลูกค้า",
    icon: (
      <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 9h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9Z" />
        <path d="M16 10h2.4a2.5 2.5 0 0 1 0 5H16" />
        <path d="M8 3.5v2M11 3.5v2" />
      </svg>
    ),
  },
  {
    href: "/kitchen",
    label: "ครัว",
    icon: (
      <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 3v8M12 3v8M17 3v8" />
        <path d="M5 11h14l-1.5 10h-11L5 11Z" />
      </svg>
    ),
  },
  {
    href: "/staff",
    label: "โต๊ะ",
    icon: (
      <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="16" height="7" rx="2" />
        <path d="M7 11v9M17 11v9M5 20h4M15 20h4" />
      </svg>
    ),
  },
  {
    href: "/orders",
    label: "ออเดอร์",
    icon: (
      <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z" />
        <path d="M9 8h6M9 12h5" />
      </svg>
    ),
  },
  {
    href: "/products",
    label: "เมนู",
    icon: (
      <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="7" height="7" rx="2" />
        <rect x="13" y="4" width="7" height="7" rx="2" />
        <rect x="4" y="13" width="7" height="7" rx="2" />
        <rect x="13" y="13" width="7" height="7" rx="2" />
      </svg>
    ),
  },
  {
    href: "/reports",
    label: "รายงาน",
    icon: (
      <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20V11M9.5 20V5M15 20v-6M20.5 20V8" />
        <path d="M3 20h18" />
      </svg>
    ),
  },
  {
    href: "/stock",
    label: "สต็อก",
    icon: (
      <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 8V16a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8" />
        <path d="M3.3 7 12 12l8.7-5" />
        <path d="M12 22V12" />
      </svg>
    ),
  },
  {
    href: "/expenses",
    label: "รายจ่าย",
    icon: (
      <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M6 9.5v5M18 9.5v5" />
      </svg>
    ),
  },
  {
    href: "/ingredients",
    label: "วัตถุดิบ",
    icon: (
      <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 8l9-4 9 4-9 4-9-4Z" />
        <path d="M3 8v8l9 4 9-4V8" />
        <path d="M12 12v8" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "ตั้งค่า",
    icon: (
      <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7h9M19 7h1M4 17h1M11 17h9" />
        <circle cx="16" cy="7" r="2.6" />
        <circle cx="8" cy="17" r="2.6" />
      </svg>
    ),
  },
  {
    href: "/help",
    label: "วิธีใช้",
    icon: (
      <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M9.2 9.3a2.8 2.8 0 0 1 5.4 1c0 1.8-2.6 2.2-2.6 4" />
        <circle cx="12" cy="17.2" r="0.6" fill="currentColor" />
      </svg>
    ),
  },
];

const TITLES: Record<string, [string, string]> = {
  "/": ["ขายสินค้า", "แตะเมนูเพื่อเพิ่มลงออเดอร์ได้เลย"],
  "/products": ["จัดการเมนู", "เพิ่ม แก้ไข เปิด/ปิด เมนูของร้าน"],
  "/orders": ["ประวัติออเดอร์", "รายการขายย้อนหลังทั้งหมด"],
  "/kitchen": ["จอครัว", "ออเดอร์ใหม่และสถานะการทำอาหาร"],
  "/staff": ["จัดการโต๊ะ", "เสิร์ฟอาหาร เก็บเงิน และปิดโต๊ะ"],
  "/reports": ["รายงานยอดขาย", "สรุปภาพรวมของร้าน"],
  "/stock": ["จัดการสต็อก", "ดูและจัดการสินค้าคงคลัง"],
  "/expenses": ["รายจ่าย", "บันทึกค่าใช้จ่ายของร้าน"],
  "/ingredients": ["วัตถุดิบ", "คลังวัตถุดิบและการเตือนของใกล้หมด"],
  "/settings": ["ตั้งค่าร้าน", "ปรับแต่งข้อมูลและใบเสร็จ"],
  "/help": ["วิธีใช้งาน", "คู่มือการใช้งานระบบ"],
};

function BowlLogo({ logo }: { logo: string }) {
  return (
    <div className="relative h-[46px] w-[46px] animate-floaty">
      <span className="absolute left-[13px] top-[-5px] h-2 w-1 rounded-full bg-accent-green/70" style={{ animation: "steam 2.4s ease-in-out infinite" }} />
      <span className="absolute left-[22px] top-[-7px] h-[9px] w-1 rounded-full bg-accent-orange/80" style={{ animation: "steam 2.4s ease-in-out .5s infinite" }} />
      <span className="absolute left-[31px] top-[-5px] h-2 w-1 rounded-full bg-accent-green/70" style={{ animation: "steam 2.4s ease-in-out 1s infinite" }} />
      <div
        className="grid h-[46px] w-[46px] place-items-center rounded-[15px] text-[26px] leading-none shadow-[0_4px_12px_rgba(var(--c-sh),.35)]"
        style={{ background: "var(--c-logo-grad)" }}
      >
        {logo}
      </div>
    </div>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("pos-theme");
    const isDark = saved
      ? saved === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(isDark);
  }, []);
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    localStorage.setItem("pos-theme", next ? "dark" : "light");
  }
  return (
    <button
      onClick={toggle}
      aria-label={dark ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"}
      className="flex h-10 w-10 items-center justify-center rounded-2xl border border-brand-border bg-brand-card text-lg shadow-[0_1px_0_rgb(var(--brand-border2))] hover:text-brand-primary"
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="text-right leading-tight">
      <div className="text-[13px] text-brand-muted2">
        {now
          ? now.toLocaleDateString("th-TH", {
              weekday: "long",
              day: "numeric",
              month: "short",
            })
          : " "}
      </div>
      <div className="font-itim text-xl text-brand-primary">
        {now ? now.toTimeString().slice(0, 5) : " "}
      </div>
    </div>
  );
}

export function AppShell({
  children,
  todaySales,
  role,
  shopName,
  logoEmoji,
}: {
  children: React.ReactNode;
  todaySales: number;
  role: SessionRole | null;
  shopName: string;
  logoEmoji: string;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [title, sub] = TITLES[pathname] ?? TITLES["/"];
  // white-label: แยกชื่อร้านเป็น 2 บรรทัด "<ชื่อ> BY <เจ้าของ>" ถ้ามี " by ", ไม่งั้นโชว์ทั้งชื่อ
  const byIdx = shopName.toLowerCase().lastIndexOf(" by ");
  const brandName = byIdx >= 0 ? shopName.slice(0, byIdx) : shopName;
  const brandSub = byIdx >= 0 ? shopName.slice(byIdx + 4) : "";
  const navItems =
    role === "staff"
      ? NAV.filter((item) => ["/", "/kitchen", "/staff", "/help"].includes(item.href))
      : NAV;
  // มือถือ: โชว์ 4 เมนูหลักใน bottom nav ที่เหลือไปอยู่ใน "เพิ่มเติม"
  const MOBILE_PRIMARY = ["/", "/kitchen", "/staff"];
  const primaryItems = navItems.filter((i) => MOBILE_PRIMARY.includes(i.href));
  const moreItems = navItems.filter((i) => !MOBILE_PRIMARY.includes(i.href));

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // หน้าที่ไม่ต้องมี shell (ไม่มี sidebar/nav) — customer + หน้าเดี่ยวก่อน login/ตั้งค่า
  // ต้องรวม /setup + /t/ + /lan-only ด้วย ไม่งั้นโดนขังใน h-dvh overflow-hidden เลื่อนไม่ถึงปุ่ม
  if (
    pathname.startsWith("/table/") ||
    pathname.startsWith("/t/") ||
    pathname === "/login" ||
    pathname === "/setup" ||
    pathname === "/lan-only"
  ) {
    return <ToastProvider>{children}</ToastProvider>;
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-brand-bg font-mali text-brand-ink lg:min-h-[768px]">
      {/* ===== SIDEBAR (เดสก์ท็อป) ===== */}
      <aside className="hidden w-[118px] flex-none flex-col items-center gap-1.5 overflow-y-auto bg-brand-sidebar px-2.5 pb-4 pt-5 lg:flex">
        <div className="mb-3.5 flex flex-col items-center gap-[7px]">
          <BowlLogo logo={logoEmoji} />
          <div className="text-center leading-none">
            <div className="font-itim text-[15px] leading-tight text-brand-cream">{brandName}</div>
            {brandSub && (
              <div className="font-itim text-[10px] tracking-[2px] text-accent-green">BY {brandSub}</div>
            )}
          </div>
        </div>

        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex w-[92px] flex-col items-center gap-[5px] rounded-2xl px-1 py-[11px] text-xs font-semibold transition-all",
                active
                  ? "bg-brand-primary text-[color:var(--c-on-primary)] shadow-[0_6px_14px_rgba(0,0,0,.28)]"
                  : "bg-transparent text-brand-sidebarText hover:bg-brand-card/10 hover:text-[#ffe9d3]",
              ].join(" ")}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}

        <div className="mt-auto text-center text-[10px] leading-relaxed text-brand-sidebarText/80">
          v1.0
          <br />
          Local POS
        </div>
      </aside>

      {/* ===== MAIN ===== */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* TOPBAR */}
        <header className="flex h-16 flex-none items-center justify-between gap-2 border-b border-brand-border bg-brand-topbar px-4 lg:h-20 lg:px-[26px]">
          <div className="flex min-w-0 items-center gap-2.5">
            {/* โลโก้เล็ก (มือถือ) */}
            <div className="lg:hidden">
              <div
                className="grid h-10 w-10 flex-none place-items-center rounded-xl"
                style={{ background: "var(--c-logo-grad)" }}
              >
                <span className="text-lg">{logoEmoji}</span>
              </div>
            </div>
            <div className="min-w-0">
              <div className="truncate font-itim text-[19px] leading-tight text-brand-ink lg:text-[25px]">
                {title}
              </div>
              <div className="mt-0.5 hidden text-[13px] text-brand-muted2 sm:block">{sub}</div>
            </div>
          </div>
          <div className="flex flex-none items-center gap-2 lg:gap-3.5">
            {/* ยอดขายวันนี้ */}
            <div
              className="flex items-center gap-2 rounded-2xl px-3 py-1.5 text-[color:var(--c-on-primary)] shadow-[0_6px_16px_rgba(var(--c-sh),.28)] lg:gap-3 lg:px-5 lg:py-2"
              style={{ background: "linear-gradient(90deg,#D93A2B,#F5852A)" }}
            >
              <span className="text-xl leading-none lg:text-[26px]">💰</span>
              <div className="leading-none">
                <div className="hidden text-[11px] font-medium text-[#ffe4cf] sm:block">ยอดขายวันนี้</div>
                <div className="font-itim text-[19px] leading-tight lg:text-[26px]">{baht(todaySales)}</div>
              </div>
            </div>
            <div className="hidden items-center gap-[7px] rounded-[20px] bg-accent-greenBg px-3.5 py-[7px] text-[13px] font-semibold text-accent-greenText xl:flex">
              <span className="h-2 w-2 rounded-full bg-accent-green shadow-[0_0_0_3px_rgba(var(--c-sh-lime),.28)]" />
              เปิดร้านอยู่
            </div>
            <div className="hidden lg:block">
              <Clock />
            </div>
            <ThemeToggle />
            <form action="/api/logout" method="post">
              <button className="rounded-2xl border border-brand-border bg-brand-card px-3 py-2 text-xs font-bold text-brand-muted shadow-[0_1px_0_rgb(var(--brand-border2))] hover:text-brand-primary">
                <span className="hidden sm:inline">ออกจากระบบ</span>
                <span className="sm:hidden">🚪</span>
              </button>
            </form>
          </div>
        </header>

        {/* CONTENT */}
        <main className="flex min-h-0 flex-1 flex-col pb-[68px] lg:pb-0">
          <ToastProvider>{children}</ToastProvider>
        </main>

        {/* FOOTER เครดิต (เดสก์ท็อป) */}
        <footer className="hidden h-7 flex-none items-center justify-center border-t border-brand-border bg-brand-topbar text-[11px] text-brand-muted2 lg:flex">
          © 2026 {shopName} · POS
        </footer>
      </div>

      {/* ===== BOTTOM NAV (มือถือ) ===== */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-brand-border bg-brand-sidebar pb-[env(safe-area-inset-bottom)] lg:hidden">
        {primaryItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition-colors",
                active ? "text-accent-green" : "text-brand-sidebarText",
              ].join(" ")}
            >
              <span className={active ? "scale-110 transition-transform" : ""}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
        {moreItems.length > 0 && (
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className={[
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition-colors",
              moreItems.some((i) => i.href === pathname) ? "text-accent-green" : "text-brand-sidebarText",
            ].join(" ")}
          >
            <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="5" cy="12" r="1.4" fill="currentColor" />
              <circle cx="12" cy="12" r="1.4" fill="currentColor" />
              <circle cx="19" cy="12" r="1.4" fill="currentColor" />
            </svg>
            <span>เพิ่มเติม</span>
          </button>
        )}
      </nav>

      {/* ===== MORE SHEET (มือถือ) ===== */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-50 bg-[rgba(var(--c-scrim),.5)] lg:hidden"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-[24px] bg-brand-card p-4 pb-[calc(env(safe-area-inset-bottom)+16px)] shadow-[0_-12px_40px_rgba(var(--c-scrim),.3)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-brand-border" />
            <div className="grid grid-cols-4 gap-2">
              {moreItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "flex flex-col items-center gap-1 rounded-2xl py-3 text-[11px] font-semibold transition-colors",
                      active
                        ? "bg-brand-primary text-[color:var(--c-on-primary)]"
                        : "bg-brand-cream text-brand-muted",
                    ].join(" ")}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <SoundNotifier />
    </div>
  );
}
