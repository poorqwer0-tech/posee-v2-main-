"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PosProduct } from "@/lib/queries";
import { baht, categoriesFromProducts, DEFAULT_CATEGORY_EMOJI, RESTAURANT_ORDER_STATUS } from "@/lib/utils";
import {
  defaultSelections,
  getMenuOptionGroups,
  selectedOptionNote,
  selectedOptionTotal,
} from "@/lib/menu-options";

type CartLine = {
  lineId?: string;
  id: number;
  name: string;
  emoji: string;
  price: number;
  basePrice?: number;
  qty: number;
  note?: string;
};

type CustomerOrder = {
  id: number;
  orderNo: string;
  status: string;
  finalTotal: number;
  items: { productName: string; quantity: number; subtotal: number; note: string }[];
};

export function CustomerOrderClient({
  token,
  orderToken,
  requested = false,
  tableName,
  products,
  orders,
  bestSellers = [],
  paymentStatus,
}: {
  token: string;
  orderToken?: string | null;
  requested?: boolean;
  tableName: string;
  products: PosProduct[];
  orders: CustomerOrder[];
  bestSellers?: { id: number; sold: number }[];
  paymentStatus?: string;
}) {
  // โต๊ะยังไม่เปิด (พนักงานยังไม่กดเปิด / รอบปิดแล้ว) → สั่งไม่ได้ จนกว่าจะมี order_token
  const tableOpen = !!orderToken;
  // ส่งคำขอเปิดโต๊ะแล้วหรือยัง (จาก DB หรือเพิ่งกดในเครื่องนี้)
  const [openRequested, setOpenRequested] = useState(requested);
  const router = useRouter();
  const [cat, setCat] = useState("ทั้งหมด");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [note, setNote] = useState("");
  const [itemNote, setItemNote] = useState("");
  const [message, setMessage] = useState("");
  const [modalError, setModalError] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<PosProduct | null>(null);
  const [optionSelections, setOptionSelections] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  // อัปเดตหน้าลูกค้าอัตโนมัติ (โต๊ะจะรีเซ็ตเองเมื่อพนักงานปิดบิล/จ่ายเงิน)
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [router]);

  const grid = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        (cat === "ทั้งหมด" || p.category === cat) &&
        (!q || p.name.toLowerCase().includes(q)),
    );
  }, [products, cat, query]);

  // เมนูมาแรง (ขายดี) — โชว์เฉพาะตอนไม่ได้ค้นหา/กรองหมวด
  const topProducts = useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    return bestSellers
      .map((b) => ({ product: byId.get(b.id), sold: b.sold }))
      .filter((x): x is { product: PosProduct; sold: number } => Boolean(x.product));
  }, [products, bestSellers]);
  const showTop = topProducts.length > 0 && cat === "ทั้งหมด" && !query.trim();

  // หมวด (white-label): "ทั้งหมด" + หมวดที่มีสินค้าจริง
  const categories = useMemo(
    () => [{ key: "ทั้งหมด", emoji: DEFAULT_CATEGORY_EMOJI }, ...categoriesFromProducts(products)],
    [products],
  );

  // จัดเมนูเป็นกลุ่มตามประเภทอาหาร (มีหัวข้อชื่อประเภท)
  const sections = useMemo(
    () =>
      categoriesFromProducts(products)
        .map((c) => ({ ...c, items: grid.filter((p) => p.category === c.key) }))
        .filter((s) => s.items.length > 0),
    [grid, products],
  );
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const orderTotal = orders.reduce((sum, order) => sum + order.finalTotal, 0);
  const selectedGroups = selectedProduct ? getMenuOptionGroups(selectedProduct) : [];
  const selectedExtra = selectedOptionTotal(selectedGroups, optionSelections);
  const selectedUnitPrice = (selectedProduct?.price ?? 0) + selectedExtra;

  function openMenuOptions(product: PosProduct) {
    const groups = getMenuOptionGroups(product);
    setSelectedProduct(product);
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

  function addConfiguredItem() {
    if (!selectedProduct) return;
    const error = optionError();
    if (error) {
      setModalError(error);
      return;
    }
    const lineNote = selectedOptionNote(selectedGroups, optionSelections, itemNote);
    const lineId = `${selectedProduct.id}:${lineNote}`;
    setCart((prev) => {
      const existing = prev.find((item) => item.lineId === lineId);
      if (existing) {
        return prev.map((item) =>
          item.lineId === lineId ? { ...item, qty: item.qty + 1 } : item,
        );
      }
      return [
        ...prev,
        {
          lineId,
          id: selectedProduct.id,
          name: selectedProduct.name,
          emoji: selectedProduct.image,
          price: selectedUnitPrice,
          basePrice: selectedProduct.price,
          qty: 1,
          note: lineNote,
        },
      ];
    });
    setSelectedProduct(null);
    setModalError("");
    setMessage("");
  }

  function addToCart(product: PosProduct) {
    if (!tableOpen) {
      setMessage(openRequested ? "รอพนักงานเปิดโต๊ะสักครู่…" : "กด “ขอเปิดโต๊ะ” ด้านบนก่อนสั่งอาหาร");
      return;
    }
    openMenuOptions(product);
  }

  function changeQty(lineId: string | undefined, delta: number) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.lineId === lineId ? { ...item, qty: item.qty + delta } : item,
        )
        .filter((item) => item.qty > 0),
    );
  }

  function requestOpen() {
    setMessage("");
    setOpenRequested(true);
    startTransition(async () => {
      const response = await fetch("/api/table-open-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableToken: token }),
      });
      const res = await response.json();
      if (!res.ok) {
        setOpenRequested(false);
        setMessage(res.error ?? "ขอเปิดโต๊ะไม่สำเร็จ");
        return;
      }
      setMessage(res.alreadyOpen ? "โต๊ะเปิดแล้ว เริ่มสั่งได้เลย" : "ส่งคำขอแล้ว รอพนักงานเปิดโต๊ะ…");
      router.refresh();
    });
  }

  function submitOrder() {
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/api/table-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cart, orderToken, note }),
      });
      const res = await response.json();
      if (!res.ok) {
        setMessage(res.error ?? "ส่งออเดอร์ไม่สำเร็จ");
        return;
      }
      setCart([]);
      setNote("");
      setMessage(`ส่งออเดอร์ ${res.orderNo} แล้ว`);
      router.refresh();
    });
  }

  function cancelOrder(orderId: number) {
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/api/order-cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, orderToken }),
      });
      const res = await response.json();
      if (!res.ok) {
        setMessage(res.error ?? "ยกเลิกไม่สำเร็จ");
        return;
      }
      setMessage("ยกเลิกออเดอร์แล้ว");
      router.refresh();
    });
  }

  function callBill() {
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/api/payment-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderToken }),
      });
      const res = await response.json();
      if (!res.ok) {
        setMessage(res.error ?? "เรียกเก็บเงินไม่สำเร็จ");
        return;
      }
      setMessage("เรียกพนักงานเก็บเงินแล้ว");
      router.refresh();
    });
  }

  return (
    <div className="min-h-screen bg-[var(--c-surface-2)] text-brand-ink">
      <header className="sticky top-0 z-20 border-b border-brand-border bg-[var(--c-surface)]/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-brand-muted2">สั่งอาหารที่</div>
            <h1 className="font-itim text-3xl leading-tight text-brand-primary">{tableName}</h1>
          </div>
          <div className="rounded-2xl bg-brand-sidebar px-4 py-2 text-right text-[color:var(--c-on-primary)]">
            <div className="text-[11px] text-[color:var(--c-divider)]">ยอดโต๊ะนี้</div>
            <div className="font-itim text-2xl">{baht(orderTotal)}</div>
          </div>
        </div>
      </header>

      {!tableOpen && (
        <div className="mx-auto max-w-5xl px-4 pt-4">
          <div className="rounded-2xl border border-brand-border bg-brand-card px-4 py-4 text-center">
            {openRequested ? (
              <>
                <div className="text-2xl">⏳</div>
                <div className="mt-1 font-itim text-xl text-brand-primary">ส่งคำขอเปิดโต๊ะแล้ว</div>
                <div className="mt-1 text-sm text-[color:var(--c-muted)]">
                  รอพนักงานยืนยัน… ระบบจะเปิดให้สั่งอัตโนมัติเมื่อพนักงานกดเปิดโต๊ะ (ดูเมนูรอได้เลย)
                </div>
              </>
            ) : (
              <>
                <div className="text-2xl">🔔</div>
                <div className="mt-1 font-itim text-xl text-brand-primary">โต๊ะนี้ยังไม่เปิด</div>
                <div className="mt-1 text-sm text-[color:var(--c-muted)]">
                  กดขอเปิดโต๊ะ แล้วพนักงานจะเปิดให้สั่งอาหาร (ดูเมนูก่อนได้)
                </div>
                <button
                  onClick={requestOpen}
                  disabled={isPending}
                  className="mt-3 rounded-2xl bg-brand-primary px-6 py-3 font-itim text-lg text-[color:var(--c-on-primary)] disabled:opacity-50"
                >
                  🔔 ขอเปิดโต๊ะเพื่อสั่งอาหาร
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <main className="mx-auto grid max-w-5xl gap-5 px-4 py-5 pb-28 lg:grid-cols-[1fr_360px] lg:pb-5">
        <section className="min-w-0">
          <div className="relative mb-3">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-brand-muted3">
              🔍
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาเมนู…"
              className="w-full rounded-2xl border border-brand-border bg-brand-card py-3 pl-11 pr-10 text-base text-brand-ink2 outline-none focus:border-brand-primary"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-2xl leading-none text-brand-muted3"
                aria-label="ล้างคำค้นหา"
              >
                ×
              </button>
            )}
          </div>

          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {categories.map((c) => (
              <button
                key={c.key}
                onClick={() => setCat(c.key)}
                className={[
                  "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold",
                  cat === c.key
                    ? "bg-brand-primary text-white"
                    : "bg-brand-card text-brand-muted shadow-[0_1px_0_var(--c-border)]",
                ].join(" ")}
              >
                <span>{c.emoji}</span>
                {c.key}
              </button>
            ))}
          </div>

          {/* มาแรง ขายดี — 2 บล็อกใหญ่ อยู่กึ่งกลาง */}
          {showTop && (
            <div className="mb-7">
              <div className="mb-3 flex items-center justify-center gap-2">
                <span className="text-2xl">🔥</span>
                <h2 className="font-itim text-2xl text-brand-primary">มาแรง ขายดี</h2>
              </div>
              <div className="mx-auto grid max-w-xl grid-cols-2 gap-4">
                {topProducts.slice(0, 2).map(({ product, sold }) => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="relative overflow-hidden rounded-[22px] bg-brand-card text-left shadow-[0_12px_30px_rgba(var(--c-sh),.13)] transition active:scale-[.98]"
                  >
                    <span className="absolute left-3 top-3 z-10 rounded-full bg-accent-orange px-3 py-1 text-xs font-bold text-white shadow">
                      🔥 ขายไปแล้ว {sold}
                    </span>
                    <div className="flex aspect-square items-center justify-center bg-[var(--c-placeholder)] text-7xl">
                      {product.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.photo}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        product.image
                      )}
                    </div>
                    <div className="p-4">
                      <div className="line-clamp-2 min-h-[46px] text-base font-bold leading-snug text-brand-ink2">
                        {product.name}
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="font-itim text-2xl text-brand-primary">
                          {baht(product.price)}
                        </span>
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-green text-xl font-bold text-white">
                          +
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* รายการอาหาร แยกตามประเภท (ชื่อประเภท + ลิสต์เมนู พร้อมรูป ราคา) */}
          {grid.length === 0 ? (
            <div className="rounded-2xl bg-brand-card px-4 py-16 text-center text-base text-brand-muted2 shadow-[0_1px_0_var(--c-border)]">
              ไม่พบเมนู “{query}” 🔍
            </div>
          ) : (
            <div className="space-y-7">
              {sections.map((section) => (
                <div key={section.key}>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-xl">{section.emoji}</span>
                    <h2 className="font-itim text-2xl text-brand-primary">{section.key}</h2>
                    <span className="rounded-full bg-brand-chip px-2.5 py-0.5 text-xs font-bold text-brand-muted">
                      {section.items.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {section.items.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => addToCart(p)}
                        className="overflow-hidden rounded-[18px] bg-brand-card text-left shadow-[0_8px_20px_rgba(var(--c-sh),.08)] transition active:scale-[.98]"
                      >
                        <div className="flex aspect-[4/3] items-center justify-center bg-[var(--c-placeholder)] text-5xl">
                          {p.photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.photo}
                              alt={p.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            p.image
                          )}
                        </div>
                        <div className="p-3">
                          <div className="min-h-[42px] text-sm font-bold leading-snug text-brand-ink2">
                            {p.name}
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="font-itim text-xl text-brand-primary">
                              {baht(p.price)}
                            </span>
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-green text-lg font-bold text-white">
                              +
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside
          id="cart"
          className="h-fit scroll-mt-24 rounded-[20px] bg-[var(--c-surface)] p-4 shadow-[0_10px_28px_rgba(var(--c-sh),.1)] lg:sticky lg:top-24"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-itim text-2xl text-brand-ink">ตะกร้า</h2>
            <span className="rounded-full bg-brand-chip px-3 py-1 text-xs font-bold text-brand-muted">
              {cart.reduce((s, c) => s + c.qty, 0)} รายการ
            </span>
          </div>

          {cart.length === 0 ? (
            <div className="rounded-2xl bg-[var(--c-surface-2)] px-4 py-10 text-center text-sm text-brand-muted2">
              เลือกเมนูเพื่อเริ่มสั่งอาหาร
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">{item.name}</div>
                    <div className="text-xs text-brand-muted2">{baht(item.price)}</div>
                    {item.note && (
                      <div className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-accent-orange">
                        {item.note}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => changeQty(item.lineId, -1)}
                      className="h-8 w-8 rounded-full bg-brand-chip font-bold text-brand-primary"
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-bold">{item.qty}</span>
                    <button
                      onClick={() => changeQty(item.lineId, 1)}
                      className="h-8 w-8 rounded-full bg-brand-primary font-bold text-white"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="หมายเหตุ เช่น ไม่เผ็ด ไม่ใส่ผัก"
                className="min-h-[76px] w-full resize-none rounded-2xl border border-brand-border bg-brand-card px-3 py-2 text-sm outline-none focus:border-brand-primary"
              />
              <div className="flex items-end justify-between border-t border-dashed border-brand-border pt-3">
                <span className="text-sm font-bold">รวม</span>
                <span className="font-itim text-3xl text-brand-primary">{baht(cartTotal)}</span>
              </div>
              <button
                onClick={submitOrder}
                disabled={isPending}
                className="w-full rounded-2xl bg-brand-primary py-3.5 text-base font-bold text-white shadow-[0_8px_18px_rgba(var(--c-sh),.22)] disabled:opacity-60"
              >
                ยืนยันออเดอร์
              </button>
            </div>
          )}

          {message && (
            <div className="mt-3 rounded-2xl bg-accent-greenBg px-4 py-3 text-sm font-semibold text-accent-greenText">
              {message}
            </div>
          )}

          {orders.length > 0 && (
            <div className="mt-5 border-t border-brand-border pt-4">
              <h2 className="mb-2 font-itim text-xl">ออเดอร์ของโต๊ะ</h2>
              <div className="space-y-2">
                {orders.map((order) => (
                  <div key={order.id} className="rounded-2xl bg-[var(--c-surface-2)] p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-itim text-lg text-brand-primary">
                        {order.orderNo}
                      </span>
                      <span className="rounded-full bg-brand-card px-2.5 py-1 text-[11px] font-bold text-brand-muted">
                        {RESTAURANT_ORDER_STATUS[
                          order.status as keyof typeof RESTAURANT_ORDER_STATUS
                        ] ?? order.status}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-brand-muted">
                      {order.items.map((item, index) => (
                        <div key={`${item.productName}-${index}`}>
                          <div>{item.productName} x{item.quantity}</div>
                          {item.note && (
                            <div className="whitespace-pre-line pl-2 text-[11px] text-accent-orange">
                              {item.note}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {order.status === "new" && (
                      <button
                        onClick={() => cancelOrder(order.id)}
                        disabled={isPending}
                        className="mt-2 w-full rounded-xl border border-accent-orange bg-brand-card py-2 text-xs font-bold text-accent-orange disabled:opacity-60"
                      >
                        ยกเลิกออเดอร์นี้
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-[22px] border-2 border-accent-orange bg-[var(--c-orange-soft)] p-3 shadow-[0_10px_22px_rgba(var(--c-sh-o),.16)]">
                <div className="mb-2 flex items-end justify-between">
                  <div>
                    <div className="text-xs font-bold text-accent-orange">
                      พร้อมชำระเงิน
                    </div>
                    <div className="text-sm font-semibold text-brand-muted">
                      กดเพื่อเรียกพนักงานมาเก็บเงิน
                    </div>
                  </div>
                  <div className="font-itim text-3xl text-accent-orange">
                    {baht(orderTotal)}
                  </div>
                </div>
                <button
                  onClick={callBill}
                  disabled={isPending || paymentStatus === "requested"}
                  className={[
                    "w-full rounded-[18px] py-4 text-lg font-bold text-white shadow-[0_8px_0_var(--c-orange-dark),0_15px_28px_rgba(var(--c-sh-o),.28)] transition active:translate-y-1 active:shadow-[0_4px_0_var(--c-orange-dark),0_10px_18px_rgba(var(--c-sh-o),.22)] disabled:translate-y-0 disabled:opacity-70 disabled:shadow-none",
                    paymentStatus === "requested"
                      ? "bg-accent-green"
                      : "bg-accent-orange",
                  ].join(" ")}
                >
                  {paymentStatus === "requested" ? "เรียกพนักงานแล้ว" : "เก็บตัง"}
                </button>
              </div>
            </div>
          )}
        </aside>
      </main>

      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-border bg-[var(--c-surface)] p-3 shadow-[0_-8px_24px_rgba(var(--c-sh),.14)] lg:hidden">
          <a
            href="#cart"
            className="flex items-center justify-between gap-3 rounded-2xl bg-brand-primary px-5 py-3.5 text-white"
          >
            <span className="font-bold">
              🧺 {cart.reduce((s, c) => s + c.qty, 0)} รายการ
            </span>
            <span className="font-itim text-2xl leading-none">{baht(cartTotal)}</span>
            <span className="text-sm font-bold">ดูตะกร้า →</span>
          </a>
        </div>
      )}

      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end bg-[rgba(var(--c-scrim),.44)] p-0 sm:items-center sm:justify-center sm:p-5">
          <div className="max-h-[92vh] w-full overflow-hidden rounded-t-[26px] bg-[var(--c-surface)] shadow-[0_-18px_50px_rgba(var(--c-scrim),.28)] sm:max-w-[560px] sm:rounded-[24px]">
            <div className="flex items-start justify-between gap-3 border-b border-brand-border bg-[var(--c-header)] px-5 py-4">
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

            <div className="max-h-[58vh] overflow-auto px-5 py-4">
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
                        const selected = optionSelections[group.key]?.includes(option.label) ?? false;
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
                    className="min-h-[84px] w-full resize-none rounded-2xl border border-brand-border bg-brand-card px-4 py-3 text-sm outline-none focus:border-brand-primary"
                  />
                </section>
              </div>
            </div>

            <div className="border-t border-brand-border bg-brand-card px-5 py-4">
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
      )}
    </div>
  );
}
