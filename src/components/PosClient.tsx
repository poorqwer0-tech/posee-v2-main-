"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import type { Staff } from "@/db/schema";
import type { PosProduct } from "@/lib/queries";
import { createOrder, createTableOrder, type CartLine } from "@/lib/actions";
import { PAYMENT_METHODS, baht, categoriesFromProducts, DEFAULT_CATEGORY_EMOJI, promptPayPayload } from "@/lib/utils";
import {
  defaultSelections,
  getMenuOptionGroups,
  selectedOptionNote,
  selectedOptionTotal,
} from "@/lib/menu-options";
import { QrImage } from "@/components/QrImage";
import { Receipt, type ReceiptData } from "./Receipt";
import { buildReceipt } from "@/lib/escpos";
import { escposEncoding, printBytes } from "@/lib/thermal";
import { useToast } from "./Toast";

/** เรนเดอร์ลูกไปที่ document.body — หลุด stacking context ของ page → modal อยู่เหนือ bottom nav แน่นอน */
function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

export type ShopInfo = {
  shopName: string;
  logoEmoji: string;
  phone: string;
  address: string;
  footer: string;
  promptPayId: string;
  serviceChargePct: number;
  vatPct: number;
};
export type PosTable = { id: number; name: string; qrToken: string };

export function PosClient({
  products,
  staff,
  tables,
  shop,
}: {
  products: PosProduct[];
  staff: Staff[];
  tables: PosTable[];
  shop: ShopInfo;
}) {
  const flash = useToast();
  const [cat, setCat] = useState("ทั้งหมด");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [adjustment, setAdjustment] = useState(0); // ปรับยอด +/- (บาท) ตอนชำระ — แทนส่วนลด %
  const [method, setMethod] = useState("เงินสด");
  const [staffId, setStaffId] = useState<number | null>(staff[0]?.id ?? null);
  // เป้าหมายออเดอร์: "counter" = ขายหน้าร้านจ่ายเลย, number = ส่งเข้าโต๊ะ (เข้าครัว)
  const [target, setTarget] = useState<"counter" | number>("counter");
  // modal เลือกรายละเอียดเมนู (ตัวเลือก + หมายเหตุ) เหมือนหน้า QR โต๊ะ
  const [selectedProduct, setSelectedProduct] = useState<PosProduct | null>(null);
  const [optionSelections, setOptionSelections] = useState<Record<string, string[]>>({});
  const [itemNote, setItemNote] = useState("");
  const [modalError, setModalError] = useState("");
  const [showPayment, setShowPayment] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(null);
  const [cartOpen, setCartOpen] = useState(false); // ตะกร้าเป็น bottom sheet บนมือถือ
  const [isPending, startTransition] = useTransition();

  const currentStaff = staff.find((s) => s.id === staffId) ?? null;
  const isTable = typeof target === "number";
  const selectedTable = isTable
    ? tables.find((t) => t.id === target) ?? null
    : null;

  const grid = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        (cat === "ทั้งหมด" || p.category === cat) &&
        (!q || p.name.toLowerCase().includes(q)),
    );
  }, [products, cat, query]);

  // หมวดกรอง: "ทั้งหมด" + หมวดที่มีสินค้าจริง (white-label — ร้านตั้งหมวดเองได้)
  const categories = useMemo(
    () => [{ key: "ทั้งหมด", emoji: DEFAULT_CATEGORY_EMOJI }, ...categoriesFromProducts(products)],
    [products],
  );

  const sub = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const adjustedSub = Math.max(0, sub + adjustment); // ยอดหลังปรับ (+/-)
  const serviceAmt = Math.round((adjustedSub * (shop.serviceChargePct || 0)) / 100);
  const vatAmt = Math.round(((adjustedSub + serviceAmt) * (shop.vatPct || 0)) / 100);
  const total = adjustedSub + serviceAmt + vatAmt; // ยอดสุทธิรวมค่าบริการ+VAT
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);

  const selectedGroups = selectedProduct ? getMenuOptionGroups(selectedProduct) : [];
  const selectedExtra = selectedOptionTotal(selectedGroups, optionSelections);
  const selectedUnitPrice = (selectedProduct?.price ?? 0) + selectedExtra;

  /** จำนวนของเมนูนี้ที่อยู่ในตะกร้ารวมทุกบรรทัด (ใช้เช็ควัตถุดิบ) */
  function productQtyInCart(productId: number) {
    return cart.filter((c) => c.id === productId).reduce((s, c) => s + c.qty, 0);
  }

  /** แตะเมนู → เปิด modal ให้เลือกตัวเลือก + ใส่หมายเหตุ (เหมือนหน้า QR โต๊ะ) */
  function addToCart(p: PosProduct) {
    if (p.makeable !== null && p.makeable <= 0) {
      flash(`${p.name} วัตถุดิบหมด ทำไม่ได้ 😢`);
      return;
    }
    if (p.makeable !== null && productQtyInCart(p.id) >= p.makeable) {
      flash(`${p.name} วัตถุดิบทำได้อีก ${p.makeable} เท่านั้น`);
      return;
    }
    const groups = getMenuOptionGroups(p);
    setSelectedProduct(p);
    setOptionSelections(defaultSelections(groups));
    setItemNote("");
    setModalError("");
  }

  function toggleOption(groupKey: string, label: string, max: number) {
    setOptionSelections((prev) => {
      const current = prev[groupKey] ?? [];
      if (current.includes(label)) {
        return { ...prev, [groupKey]: current.filter((item) => item !== label) };
      }
      if (max === 1) return { ...prev, [groupKey]: [label] };
      return { ...prev, [groupKey]: [...current, label].slice(0, max) };
    });
  }

  function optionError() {
    for (const group of selectedGroups) {
      const count = optionSelections[group.key]?.length ?? 0;
      if (count < group.min) return `กรุณาเลือก ${group.title}`;
      if (count > group.max) return `${group.title} เลือกได้มากสุด ${group.max} รายการ`;
    }
    return "";
  }

  /** ยืนยันเพิ่มเมนูจาก modal ลงตะกร้า */
  function addConfiguredItem() {
    if (!selectedProduct) return;
    const p = selectedProduct;
    if (p.makeable !== null && productQtyInCart(p.id) >= p.makeable) {
      flash(`${p.name} วัตถุดิบทำได้อีก ${p.makeable} เท่านั้น`);
      return;
    }
    const error = optionError();
    if (error) {
      setModalError(error);
      return;
    }
    const lineNote = selectedOptionNote(selectedGroups, optionSelections, itemNote);
    const lineId = `${p.id}:${lineNote}`;
    setCart((prev) => {
      const existing = prev.find((c) => c.lineId === lineId);
      if (existing) {
        return prev.map((c) =>
          c.lineId === lineId ? { ...c, qty: c.qty + 1 } : c,
        );
      }
      return [
        ...prev,
        {
          lineId,
          id: p.id,
          name: p.name,
          emoji: p.image,
          price: selectedUnitPrice,
          basePrice: p.price,
          qty: 1,
          note: lineNote,
        },
      ];
    });
    setSelectedProduct(null);
    setModalError("");
  }

  function changeQty(lineId: string | undefined, d: number) {
    if (d > 0) {
      const line = cart.find((c) => c.lineId === lineId);
      const p = line ? products.find((x) => x.id === line.id) : null;
      if (p && p.makeable !== null && productQtyInCart(p.id) >= p.makeable) {
        flash(`${p.name} วัตถุดิบทำได้อีก ${p.makeable} เท่านั้น`);
        return;
      }
    }
    setCart((prev) =>
      prev
        .map((c) => (c.lineId === lineId ? { ...c, qty: c.qty + d } : c))
        .filter((c) => c.qty > 0),
    );
  }

  function clearCart() {
    setCart([]);
    setAdjustment(0);
  }

  function openPayment() {
    if (!cart.length) {
      flash("ยังไม่มีรายการในตะกร้านะ~");
      return;
    }
    setAdjustment(0); // เริ่มปรับยอดใหม่ทุกครั้งที่เปิดจ่ายเงิน
    setShowPayment(true);
  }

  /** ส่งออเดอร์เข้าโต๊ะ (เข้าครัว เปิดบิลโต๊ะ เก็บเงินทีหลัง) */
  function submitTableOrder() {
    if (!selectedTable) return;
    if (!cart.length) {
      flash("ยังไม่มีรายการในตะกร้านะ~");
      return;
    }
    startTransition(async () => {
      const res = await createTableOrder(cart, {
        tableToken: selectedTable.qrToken,
      });
      if (!res.ok) {
        flash(res.error ?? "ส่งเข้าครัวไม่สำเร็จ");
        return;
      }
      flash(`ส่งเข้าครัว ${selectedTable.name} แล้ว · ${res.orderNo} 🍳`);
      setCart([]);
      setAdjustment(0);
      setCartOpen(false);
    });
  }

  function confirmPayment() {
    const snapshotItems = cart.map((c) => ({
      name: c.name,
      qty: c.qty,
      price: c.price,
      subtotal: c.price * c.qty,
    }));
    const snapSub = sub;
    const snapAdjust = adjustment;
    startTransition(async () => {
      const res = await createOrder(cart, {
        adjustment,
        method,
        staffId: currentStaff?.id ?? null,
        staffName: currentStaff?.name ?? "",
      });
      if (!res.ok) {
        flash(res.error ?? "เกิดข้อผิดพลาด");
        return;
      }
      setLastReceipt({
        shopName: shop.shopName,
        logoEmoji: shop.logoEmoji,
        phone: shop.phone,
        address: shop.address,
        footer: shop.footer,
        orderNo: res.orderNo,
        dateTime: new Date().toLocaleString("th-TH", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        method: res.method,
        staffName: currentStaff?.name ?? "",
        items: snapshotItems,
        subtotal: snapSub,
        adjustment: snapAdjust,
        discountPct: 0,
        discountAmt: 0,
        serviceChargePct: res.serviceChargePct,
        serviceAmt: res.serviceAmt,
        vatPct: res.vatPct,
        vatAmt: res.vatAmt,
        finalTotal: res.finalTotal,
      });
      setCart([]);
      setAdjustment(0);
      setShowPayment(false);
      setShowSuccess(true);
      setCartOpen(false);
    });
  }

  return (
    <div className="flex min-h-0 flex-1 animate-fadeUp">
      {/* ===== ฝั่งเมนู ===== */}
      <div className="flex min-w-0 flex-1 flex-col px-3 pt-3.5 sm:px-[22px] sm:pt-[18px]">
        <div className="relative mb-3">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-brand-muted3">
            🔍
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาเมนู…"
            className="w-full rounded-2xl border border-brand-border bg-brand-card py-2.5 pl-11 pr-10 text-[15px] text-brand-ink2 outline-none focus:border-brand-primary"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xl text-brand-muted3 hover:text-brand-primary"
              aria-label="ล้างคำค้นหา"
            >
              ×
            </button>
          )}
        </div>
        <div className="mb-4 flex flex-wrap gap-2.5">
          {categories.map((c) => {
            const active = cat === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setCat(c.key)}
                className={[
                  "flex items-center gap-[7px] rounded-2xl px-4 py-[9px] text-sm font-semibold transition-all",
                  active
                    ? "bg-brand-primary text-[color:var(--c-on-primary)] shadow-[0_4px_12px_rgba(var(--c-sh),.25)]"
                    : "bg-brand-card text-[color:var(--c-muted)] shadow-[0_1px_0_var(--c-border)]",
                ].join(" ")}
              >
                <span className="text-base">{c.emoji}</span>
                {c.key}
              </button>
            );
          })}
        </div>

        {/* แถบเลือกปลายทาง (มือถือ) — เห็นตลอด เลือกโต๊ะ/หน้าร้านได้ก่อนใส่ของ; เดสก์ท็อปใช้แผงในตะกร้า */}
        <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1 lg:hidden">
          <span className="shrink-0 text-[12px] font-semibold text-brand-muted2">🧾 ส่งไปที่</span>
          <button
            onClick={() => setTarget("counter")}
            className={[
              "shrink-0 rounded-xl border-2 px-3 py-1.5 text-[13px] font-bold transition-all",
              !isTable
                ? "border-brand-primary bg-brand-primary text-white"
                : "border-[color:var(--c-border-strong)] bg-brand-card text-brand-muted",
            ].join(" ")}
          >
            🏠 หน้าร้าน
          </button>
          {tables.map((t) => {
            const active = target === t.id;
            const num = t.name.replace(/[^0-9]/g, "") || t.name;
            return (
              <button
                key={t.id}
                onClick={() => setTarget(t.id)}
                className={[
                  "shrink-0 rounded-xl border-2 px-3 py-1.5 text-[13px] font-bold transition-all",
                  active
                    ? "border-accent-green bg-accent-green text-white"
                    : "border-[color:var(--c-border-strong)] bg-brand-card text-brand-muted",
                ].join(" ")}
              >
                โต๊ะ {num}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-auto px-1.5 pb-[22px] pr-0.5 pt-0.5">
          {grid.length === 0 && (
            <div className="mt-20 text-center text-[17px] text-brand-muted3">
              ไม่พบเมนู “{query}” 🔍
            </div>
          )}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3.5 md:grid-cols-4 xl:grid-cols-5">
            {grid.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className="relative flex flex-col overflow-hidden rounded-[18px] bg-[var(--c-surface)] text-left shadow-[0_2px_0_var(--c-border),0_8px_18px_rgba(var(--c-sh),.07)] transition-all hover:-translate-y-[3px] hover:shadow-[0_4px_0_var(--c-divider),0_14px_26px_rgba(var(--c-sh),.14)] active:translate-y-0 active:scale-[.97] disabled:cursor-not-allowed"
                style={{ opacity: p.makeable !== null && p.makeable <= 0 ? 0.5 : 1 }}
              >
                <div className="relative flex aspect-[3/2] w-full items-center justify-center overflow-hidden bg-gradient-to-br from-[var(--c-placeholder)] to-[var(--c-placeholder)] text-[46px]">
                  {p.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.photo}
                      alt={p.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    p.image
                  )}
                  {p.makeable !== null && p.makeable <= 0 ? (
                    <span className="absolute right-2 top-2 rounded-full bg-accent-orange px-2.5 py-1 text-[12px] font-semibold text-white shadow">
                      หมด
                    </span>
                  ) : p.makeable !== null && p.makeable <= 10 ? (
                    <span className="absolute right-2 top-2 rounded-full bg-[var(--c-warn-soft)]/95 px-2.5 py-1 text-[12px] font-semibold text-[color:var(--c-warn-ink)] shadow">
                      ทำได้ {p.makeable}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1 px-3 pb-2.5 pt-2">
                  <div className="min-h-[34px] text-[15px] font-semibold leading-tight text-brand-ink2">
                    {p.name}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-itim text-[19px] text-brand-primary">
                      {baht(p.price)}
                    </span>
                    <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-brand-primary pb-0.5 text-xl leading-none text-white">
                      +
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ===== ตะกร้า (มือถือ = bottom sheet) ===== */}
      <div
        className={[
          "flex min-h-0 flex-col bg-[var(--c-surface)]",
          // ทั้ง sheet/คอลัมน์เลื่อนได้ทุกขนาดจอ — กันปุ่มชำระเงินถูกตัด/ล้นเมื่อเนื้อหายาว (โต๊ะเยอะ/พนักงานเยอะ)
          "overflow-y-auto",
          // เดสก์ท็อป: คอลัมน์ขวาคงที่
          "lg:static lg:w-[466px] lg:flex-none lg:translate-y-0 lg:border-l lg:border-[color:var(--c-border)] lg:shadow-[-8px_0_24px_rgba(var(--c-sh),.05)]",
          // มือถือ: sheet เลื่อนขึ้นจากล่าง
          "fixed inset-x-0 bottom-0 top-14 z-50 rounded-t-[24px] shadow-[0_-14px_44px_rgba(var(--c-scrim),.3)] transition-transform duration-300",
          cartOpen ? "translate-y-0" : "translate-y-full lg:translate-y-0",
        ].join(" ")}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-dashed border-brand-border bg-[var(--c-surface)] px-4 pb-4 pt-4 sm:px-[26px] sm:pt-[22px] lg:static">
          <div className="flex items-center gap-2.5">
            <span className="font-itim text-[22px] text-brand-ink sm:text-[25px]">ออเดอร์ปัจจุบัน</span>
            <span className="rounded-[14px] bg-brand-chip px-3 py-[3px] text-[15px] font-semibold text-[color:var(--c-muted)]">
              {cartCount} แก้ว
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={clearCart}
              className="cursor-pointer bg-transparent text-[15px] text-[color:var(--c-muted-2)] underline"
            >
              ล้าง
            </button>
            <button
              onClick={() => setCartOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-chip text-xl leading-none text-brand-muted lg:hidden"
              aria-label="ปิดตะกร้า"
            >
              ×
            </button>
          </div>
        </div>

        {/* ===== ส่งออเดอร์ไปที่ (หน้าร้าน / โต๊ะ) ===== */}
        <div className="flex-none border-b border-brand-border bg-[var(--c-surface-2)] px-[22px] py-3.5">
          <div className="mb-2.5 text-[13px] font-semibold text-brand-muted2">
            🧾 ส่งออเดอร์ไปที่
          </div>
          <button
            onClick={() => setTarget("counter")}
            className={[
              "mb-2.5 flex w-full items-center justify-center gap-2 rounded-2xl border-2 py-3 text-base font-bold transition-all",
              !isTable
                ? "border-brand-primary bg-brand-primary text-white shadow-[0_3px_0_var(--c-primary-dark)]"
                : "border-[color:var(--c-border-strong)] bg-brand-card text-brand-muted",
            ].join(" ")}
          >
            🏠 ขายหน้าร้าน
          </button>
          <div className="mb-1 text-[11px] font-semibold text-brand-muted3">
            หรือส่งเข้าโต๊ะ
          </div>
          <div className="grid grid-cols-4 gap-2">
            {tables.map((t) => {
              const active = target === t.id;
              const num = t.name.replace(/[^0-9]/g, "") || t.name;
              return (
                <button
                  key={t.id}
                  onClick={() => setTarget(t.id)}
                  className={[
                    "flex flex-col items-center justify-center gap-0.5 rounded-xl border-2 py-2.5 font-bold transition-all",
                    active
                      ? "border-accent-green bg-accent-green text-white shadow-[0_3px_0_var(--c-lime-ink)]"
                      : "border-[color:var(--c-border-strong)] bg-brand-card text-brand-muted hover:border-accent-green",
                  ].join(" ")}
                >
                  <span className="text-[10px] font-semibold opacity-80">โต๊ะ</span>
                  <span className="text-lg leading-none">{num}</span>
                </button>
              );
            })}
          </div>
          {isTable && (
            <div className="mt-2.5 rounded-xl bg-accent-greenBg px-3 py-2 text-[12px] font-semibold text-accent-greenText">
              🍳 ส่งเข้าครัว เปิดบิล {selectedTable?.name} · เก็บเงินทีหลังที่หน้า “โต๊ะ”
            </div>
          )}
        </div>

        {/* ===== ตัวเลือกพนักงานที่ขาย (เฉพาะขายหน้าร้าน) ===== */}
        {!isTable && (
        <div className="flex-none border-b border-brand-border bg-[var(--c-surface-2)] px-[22px] py-3">
          <div className="mb-2 flex items-center gap-1.5 text-[13px] text-brand-muted2">
            <span>👤 พนักงานที่ขาย</span>
          </div>
          {staff.length === 0 ? (
            <div className="text-[13px] text-brand-muted3">
              ยังไม่มีพนักงาน — เพิ่มได้ที่หน้า “ตั้งค่า”
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {staff.map((s) => {
                const active = staffId === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setStaffId(s.id)}
                    className={[
                      "flex items-center gap-1.5 rounded-full border-2 px-3 py-[5px] text-[13px] font-semibold transition-all",
                      active
                        ? "text-white"
                        : "border-[color:var(--c-border)] bg-brand-card text-brand-muted",
                    ].join(" ")}
                    style={
                      active
                        ? { background: s.color, borderColor: s.color }
                        : undefined
                    }
                  >
                    <span>{s.emoji}</span>
                    {s.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        )}

        {cart.length === 0 ? (
          <div className="flex min-h-[220px] flex-1 flex-col items-center justify-center gap-4 p-[30px] text-center">
            <div className="animate-floaty text-[64px]">🧺</div>
            <div className="text-[17px] text-[color:var(--c-muted-2)]">
              ยังไม่มีรายการเลย
              <br />
              แตะเมนูทางซ้ายเพื่อเริ่มได้เลย~
            </div>
          </div>
        ) : (
          <>
            <div className="px-[22px] py-4">
              {cart.map((it) => (
                <div
                  key={it.lineId ?? it.id}
                  className="flex items-start gap-3.5 border-b border-[color:var(--c-divider-soft)] py-[15px]"
                >
                  <div className="flex h-[54px] w-[54px] flex-none items-center justify-center rounded-[14px] bg-[var(--c-placeholder)] text-[30px]">
                    {it.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[17px] font-semibold leading-tight text-brand-ink2">
                      {it.name}
                    </div>
                    <div className="text-[13px] text-brand-muted3">
                      {baht(it.price)} /แก้ว
                    </div>
                    {it.note && (
                      <div className="mt-1 whitespace-pre-line text-[12px] leading-relaxed text-accent-orange">
                        {it.note}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => changeQty(it.lineId, -1)}
                      className="h-10 w-10 cursor-pointer rounded-xl border-[1.5px] border-[color:var(--c-border-strong)] bg-brand-card text-2xl leading-none text-brand-primary"
                    >
                      −
                    </button>
                    <span className="min-w-[26px] text-center text-[19px] font-bold">
                      {it.qty}
                    </span>
                    <button
                      onClick={() => changeQty(it.lineId, 1)}
                      className="h-10 w-10 cursor-pointer rounded-xl bg-brand-primary text-2xl leading-none text-white"
                    >
                      +
                    </button>
                  </div>
                  <div className="w-[70px] pt-1 text-right text-[17px] font-bold text-brand-primary">
                    {baht(it.price * it.qty)}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex-none border-t border-dashed border-brand-border bg-brand-cream px-6 pb-[22px] pt-[18px]">
              <div className="mb-[7px] flex justify-between text-[17px] text-brand-muted">
                <span>ยอดรวม</span>
                <span>{baht(sub)}</span>
              </div>
              {!isTable && serviceAmt > 0 && (
                <div className="mb-1.5 flex justify-between text-[15px] text-brand-muted">
                  <span>ค่าบริการ {shop.serviceChargePct}%</span>
                  <span>{baht(serviceAmt)}</span>
                </div>
              )}
              {!isTable && vatAmt > 0 && (
                <div className="mb-1.5 flex justify-between text-[15px] text-brand-muted">
                  <span>VAT {shop.vatPct}%</span>
                  <span>{baht(vatAmt)}</span>
                </div>
              )}
              <div className="mb-[18px] flex items-end justify-between border-t border-[color:var(--c-border)] pt-3.5">
                <span className="text-[19px] font-semibold text-brand-ink2">
                  {isTable ? "ยอดออเดอร์นี้" : "ยอดสุทธิ"}
                </span>
                <span className="font-itim text-[44px] leading-none text-brand-primary">
                  {baht(isTable ? sub : total)}
                </span>
              </div>
              {isTable ? (
                <button
                  onClick={submitTableOrder}
                  disabled={isPending}
                  className="w-full cursor-pointer rounded-[18px] bg-accent-green p-5 font-itim text-[28px] text-white shadow-[0_6px_0_var(--c-lime-ink)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_var(--c-lime-ink)] disabled:opacity-60"
                >
                  {isPending ? "กำลังส่ง…" : "ส่งเข้าครัว 🍳"}
                </button>
              ) : (
                <button
                  onClick={openPayment}
                  className="w-full cursor-pointer rounded-[18px] bg-brand-primary p-5 font-itim text-[28px] text-[color:var(--c-on-primary)] shadow-[0_6px_0_var(--c-primary-dark)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_var(--c-primary-dark)]"
                >
                  ชำระเงิน 💰
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ===== MODAL เลือกตัวเลือก + หมายเหตุ ===== */}
      {selectedProduct && (
        <Portal>
        <div className="fixed inset-0 z-[55] flex items-end bg-[rgba(var(--c-scrim),.44)] p-0 sm:items-center sm:justify-center sm:p-5">
          <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[26px] bg-[var(--c-surface)] shadow-[0_-18px_50px_rgba(var(--c-scrim),.28)] sm:max-w-[520px] sm:rounded-[24px]">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-brand-border bg-[var(--c-header)] px-5 py-4">
              <div className="min-w-0">
                <div className="text-xs font-bold text-brand-muted2">รายละเอียดเมนู</div>
                <div className="font-itim text-3xl leading-tight text-brand-primary">
                  {selectedProduct.name}
                </div>
                <div className="text-sm font-semibold text-brand-muted">
                  ราคาเริ่มต้น {baht(selectedProduct.price)}
                </div>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-card text-xl font-bold text-brand-primary"
                aria-label="ปิด"
              >
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
              <div className="space-y-5">
                {selectedGroups.map((group) => (
                  <section key={group.key}>
                    <div className="mb-2 flex items-end justify-between gap-3">
                      <div>
                        <div className="text-base font-bold text-brand-ink2">{group.title}</div>
                        <div className="text-xs font-semibold text-brand-muted2">
                          {group.helper}
                        </div>
                      </div>
                      {group.min > 0 && (
                        <span className="rounded-full bg-accent-orangeBg px-2.5 py-1 text-[11px] font-bold text-accent-orange">
                          จำเป็น
                        </span>
                      )}
                    </div>
                    <div className="space-y-2">
                      {group.options.map((option) => {
                        const selected =
                          optionSelections[group.key]?.includes(option.label) ?? false;
                        return (
                          <button
                            key={option.label}
                            onClick={() => toggleOption(group.key, option.label, group.max)}
                            className={[
                              "flex w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left transition",
                              selected
                                ? "border-brand-primary bg-[var(--c-selected)]"
                                : "border-brand-border bg-brand-card",
                            ].join(" ")}
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <span
                                className={[
                                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                                  selected
                                    ? "border-brand-primary bg-brand-primary"
                                    : "border-[color:var(--c-divider)] bg-brand-card",
                                ].join(" ")}
                              >
                                {selected && <span className="h-2 w-2 rounded-full bg-brand-card" />}
                              </span>
                              <span className="text-sm font-bold text-brand-ink2">
                                {option.label}
                              </span>
                            </span>
                            {option.price > 0 && (
                              <span className="shrink-0 text-sm font-bold text-accent-orange">
                                + {baht(option.price)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}

                <section>
                  <div className="mb-2 text-base font-bold text-brand-ink2">หมายเหตุ</div>
                  <textarea
                    value={itemNote}
                    onChange={(e) => setItemNote(e.target.value)}
                    placeholder="เช่น ไม่ใส่ผัก ไม่เผ็ด ขอถ้วยเพิ่ม"
                    className="min-h-[76px] w-full resize-none rounded-2xl border border-brand-border bg-brand-card px-4 py-3 text-sm outline-none focus:border-brand-primary"
                  />
                </section>
              </div>
            </div>

            <div className="shrink-0 border-t border-brand-border bg-brand-card px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
              {modalError && (
                <div className="mb-3 rounded-2xl bg-accent-orangeBg px-4 py-3 text-sm font-bold text-accent-orange">
                  {modalError}
                </div>
              )}
              <div className="mb-3 flex items-end justify-between">
                <div className="text-sm font-bold text-brand-muted">ราคาต่อรายการ</div>
                <div className="font-itim text-3xl text-brand-primary">
                  {baht(selectedUnitPrice)}
                </div>
              </div>
              <button
                onClick={addConfiguredItem}
                className="w-full rounded-2xl bg-brand-primary py-4 text-base font-bold text-white shadow-[0_8px_18px_rgba(var(--c-sh),.22)]"
              >
                เพิ่มลงตะกร้า
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* ===== MODAL ชำระเงิน ===== */}
      {showPayment && (
        <Portal>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(var(--c-scrim),.42)] p-5">
          <div className="max-h-[92vh] w-full max-w-[420px] animate-pop overflow-auto rounded-[26px] bg-[var(--c-surface)] p-7 shadow-[0_24px_60px_rgba(var(--c-scrim),.3)]">
            <div className="mb-5 text-center">
              <div className="text-[13px] text-brand-muted2">ยอดที่ต้องชำระ</div>
              <div className="font-itim text-[48px] leading-tight text-brand-primary">
                {baht(total)}
              </div>
              {currentStaff && (
                <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-brand-chip px-3 py-1 text-[13px] text-brand-muted">
                  <span>👤 ขายโดย</span>
                  <span className="font-semibold text-brand-ink2">
                    {currentStaff.emoji} {currentStaff.name}
                  </span>
                </div>
              )}
            </div>
            <div className="mb-2.5 text-[13px] text-brand-muted2">ช่องทางชำระเงิน</div>
            <div className="mb-[22px] grid grid-cols-3 gap-2.5">
              {PAYMENT_METHODS.map((m) => {
                const active = method === m.key;
                return (
                  <button
                    key={m.key}
                    onClick={() => setMethod(m.key)}
                    className={[
                      "flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border-2 px-1.5 py-3.5 text-sm font-semibold text-brand-primary transition-all",
                      active
                        ? "border-brand-primary bg-[var(--c-selected)]"
                        : "border-[color:var(--c-border)] bg-brand-card",
                    ].join(" ")}
                  >
                    <span className="text-[26px]">{m.emoji}</span>
                    {m.key}
                  </button>
                );
              })}
            </div>

            {/* สรุปยอด + ปรับยอด (+/-) เหมือนหน้าเก็บเงินโต๊ะ */}
            <div className="mb-[22px] space-y-1.5 rounded-2xl bg-brand-card p-4 text-sm">
              <div className="flex justify-between text-brand-muted">
                <span>ยอดรายการ</span>
                <span>{baht(sub)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-brand-muted">ปรับยอด (+/−)</span>
                <input
                  type="number"
                  value={adjustment === 0 ? "" : adjustment}
                  onChange={(e) => setAdjustment(Number(e.target.value) || 0)}
                  placeholder="0"
                  className="w-28 rounded-xl border-2 border-brand-border bg-[var(--c-surface)] px-3 py-1.5 text-right text-base outline-none focus:border-brand-primary"
                />
              </div>
              {serviceAmt > 0 && (
                <div className="flex justify-between text-brand-muted">
                  <span>ค่าบริการ {shop.serviceChargePct}%</span>
                  <span>{baht(serviceAmt)}</span>
                </div>
              )}
              {vatAmt > 0 && (
                <div className="flex justify-between text-brand-muted">
                  <span>VAT {shop.vatPct}%</span>
                  <span>{baht(vatAmt)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-dashed border-brand-border pt-1.5 text-base font-bold text-brand-ink">
                <span>ยอดสุทธิ</span>
                <span className="text-brand-primary">{baht(total)}</span>
              </div>
            </div>

            {/* โอน = โชว์ PromptPay QR ตามยอดสุทธิ */}
            {method === "โอน" && shop.promptPayId && (
              <div className="mb-[22px] rounded-2xl bg-brand-card p-4 text-center">
                <QrImage
                  text={promptPayPayload(shop.promptPayId, total)}
                  size={220}
                  alt="PromptPay QR"
                  className="mx-auto h-52 w-52"
                />
                <div className="mt-2 text-xs text-brand-muted2">PromptPay: {shop.promptPayId}</div>
              </div>
            )}
            {method === "โอน" && !shop.promptPayId && (
              <div className="mb-[22px] rounded-2xl bg-accent-orangeBg px-4 py-3 text-center text-[12px] font-semibold text-accent-orange">
                ยังไม่ได้ตั้งพร้อมเพย์ — ตั้งเลขที่หน้า “ตั้งค่า” เพื่อให้ QR ขึ้น
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowPayment(false)}
                className="flex-1 cursor-pointer rounded-[15px] border-[1.5px] border-[color:var(--c-border-strong)] bg-brand-card p-3.5 text-base text-[color:var(--c-muted)]"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmPayment}
                disabled={isPending}
                className="flex-[1.4] cursor-pointer rounded-[15px] bg-brand-primary p-3.5 font-itim text-[19px] text-[color:var(--c-on-primary)] shadow-[0_4px_0_var(--c-primary-dark)] transition-transform active:translate-y-0.5 active:shadow-[0_2px_0_var(--c-primary-dark)] disabled:opacity-60"
              >
                {isPending ? "กำลังบันทึก…" : "ยืนยันรับเงิน ✓"}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* ===== MODAL สำเร็จ + ใบเสร็จ ===== */}
      {showSuccess && lastReceipt && (
        <Portal>
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(var(--c-scrim),.42)] p-5">
          <div className="flex max-h-[90vh] w-full max-w-[380px] animate-pop flex-col rounded-[26px] bg-[var(--c-surface)] shadow-[0_24px_60px_rgba(var(--c-scrim),.3)]">
            {/* หัว */}
            <div className="flex-none pt-7 text-center">
              <div className="animate-floaty text-[54px]">🎉</div>
              <div className="mt-1 font-itim text-[24px] text-brand-ink">รับออเดอร์เรียบร้อย!</div>
            </div>

            {/* ใบเสร็จกระดาษ */}
            <div className="flex-1 overflow-auto px-6 py-4">
              <div className="mx-auto w-full max-w-[280px] rounded-md bg-[var(--c-surface)] px-5 py-[18px] font-mali shadow-[0_8px_22px_rgba(var(--c-sh),.14)]">
                <div className="text-center">
                  <div className="text-[26px]">{lastReceipt.logoEmoji ?? "🍜"}</div>
                  <div className="font-itim text-[19px] text-brand-ink">{lastReceipt.shopName}</div>
                  {lastReceipt.address ? (
                    <div className="text-[11px] text-brand-muted3">{lastReceipt.address}</div>
                  ) : null}
                  {lastReceipt.phone ? (
                    <div className="text-[11px] text-brand-muted3">โทร. {lastReceipt.phone}</div>
                  ) : null}
                </div>

                <div className="my-2.5 border-t border-dashed border-[color:var(--c-divider)]" />

                <div className="flex flex-col gap-0.5 text-[12px] text-brand-muted">
                  <div className="flex justify-between"><span>เลขที่บิล</span><span className="font-semibold text-brand-ink2">{lastReceipt.orderNo}</span></div>
                  <div className="flex justify-between"><span>วันที่/เวลา</span><span>{lastReceipt.dateTime}</span></div>
                  <div className="flex justify-between"><span>ชำระโดย</span><span>{lastReceipt.method}</span></div>
                  {lastReceipt.staffName ? (
                    <div className="flex justify-between"><span>พนักงาน</span><span>{lastReceipt.staffName}</span></div>
                  ) : null}
                </div>

                <div className="my-2.5 border-t border-dashed border-[color:var(--c-divider)]" />

                <div className="flex flex-col gap-1.5">
                  {lastReceipt.items.map((it, i) => (
                    <div key={i} className="text-[12px]">
                      <div className="flex justify-between text-brand-ink2">
                        <span>{it.name}</span>
                        <span className="font-semibold">{baht(it.subtotal)}</span>
                      </div>
                      <div className="text-[11px] text-brand-muted3">
                        {it.qty} x {baht(it.price)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="my-2.5 border-t border-dashed border-[color:var(--c-divider)]" />

                <div className="flex justify-between text-[12px] text-brand-muted">
                  <span>ยอดรวม</span>
                  <span>{baht(lastReceipt.subtotal)}</span>
                </div>
                {lastReceipt.adjustment ? (
                  <div className="flex justify-between text-[12px] text-accent-orange">
                    <span>ปรับยอด</span>
                    <span>
                      {lastReceipt.adjustment > 0 ? "+" : "−"}
                      {baht(Math.abs(lastReceipt.adjustment))}
                    </span>
                  </div>
                ) : null}
                {lastReceipt.serviceChargePct ? (
                  <div className="flex justify-between text-[12px] text-brand-muted">
                    <span>ค่าบริการ {lastReceipt.serviceChargePct}%</span>
                    <span>{baht(lastReceipt.serviceAmt ?? 0)}</span>
                  </div>
                ) : null}
                {lastReceipt.vatPct ? (
                  <div className="flex justify-between text-[12px] text-brand-muted">
                    <span>VAT {lastReceipt.vatPct}%</span>
                    <span>{baht(lastReceipt.vatAmt ?? 0)}</span>
                  </div>
                ) : null}
                <div className="mt-1 flex items-end justify-between">
                  <span className="text-[13px] font-semibold text-brand-ink2">ยอดสุทธิ</span>
                  <span className="font-itim text-[26px] leading-none text-brand-primary">
                    {baht(lastReceipt.finalTotal)}
                  </span>
                </div>

                <div className="my-2.5 border-t border-dashed border-[color:var(--c-divider)]" />

                <div className="text-center text-[11px] text-brand-muted2">
                  {lastReceipt.footer}
                </div>
              </div>
            </div>

            {/* ปุ่ม */}
            <div className="flex flex-none gap-3 px-6 pb-6 pt-1">
              <button
                onClick={async () => {
                  // ลองเครื่องพิมพ์ความร้อน (Sunmi/แอปตัวกลาง/USB) ก่อน ไม่ได้ค่อยพิมพ์ผ่านเบราว์เซอร์
                  if (await printBytes(buildReceipt(lastReceipt, escposEncoding()))) return;
                  window.print();
                }}
                className="flex flex-1 items-center justify-center gap-1.5 cursor-pointer rounded-[15px] border-[1.5px] border-brand-primary bg-brand-card p-3.5 text-[16px] font-semibold text-brand-primary"
              >
                🖨️ ปริ้นใบเสร็จ
              </button>
              <button
                onClick={() => setShowSuccess(false)}
                className="flex-[1.2] cursor-pointer rounded-[15px] bg-brand-primary p-3.5 font-itim text-[18px] text-[color:var(--c-on-primary)] shadow-[0_4px_0_var(--c-primary-dark)] transition-transform active:translate-y-0.5 active:shadow-[0_2px_0_var(--c-primary-dark)]"
              >
                รับออเดอร์ถัดไป
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* ใบเสร็จซ่อนไว้สำหรับปริ้น */}
      {lastReceipt && <Receipt data={lastReceipt} />}

      {/* แถบตะกร้าลอย (มือถือ) — เปิด sheet */}
      {!cartOpen && cartCount > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed inset-x-3 bottom-[80px] z-40 flex items-center justify-between gap-3 rounded-2xl bg-brand-primary px-5 py-3.5 text-[color:var(--c-on-primary)] shadow-[0_10px_30px_rgba(var(--c-sh),.3)] lg:hidden"
        >
          <span className="font-bold">🧺 {cartCount} แก้ว</span>
          <span className="font-itim text-2xl leading-none">{baht(isTable ? sub : total)}</span>
          <span className="text-sm font-bold">ดูตะกร้า →</span>
        </button>
      )}
    </div>
  );
}
