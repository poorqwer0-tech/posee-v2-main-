"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { baht, promptPayPayload, PAYMENT_METHODS, RESTAURANT_ORDER_STATUS } from "@/lib/utils";
import { openTable, requestTablePayment } from "@/lib/actions";
import { QrImage } from "@/components/QrImage";
import { Receipt, type ReceiptData } from "@/components/Receipt";
import { buildReceipt } from "@/lib/escpos";
import { escposEncoding, printBytes } from "@/lib/thermal";

type StaffOrder = {
  id: number;
  orderNo: string;
  status: string;
  finalTotal: number;
  items: { id: number; productName: string; quantity: number; subtotal: number; note: string }[];
};

type StaffTableView = {
  table: { id: number; name: string; status: string; qrToken: string };
  session: { id: number; paymentStatus: string; orderToken: string | null } | null;
  orders: StaffOrder[];
  payment: { id: number; status: string; amount: number } | null;
  total: number;
  hasReady: boolean;
  hasActive: boolean;
};

function tableBadge(view: StaffTableView) {
  if (view.payment?.status === "requested") return "เรียกเก็บเงิน";
  if (view.hasReady) return "รอเสิร์ฟ";
  if (view.hasActive) return "มีออเดอร์";
  if (view.table.status === "open_requested") return "🔔 ขอเปิด";
  return "ว่าง";
}

function tableClass(view: StaffTableView) {
  if (view.payment?.status === "requested") return "border-accent-orange bg-accent-orangeBg";
  if (view.hasReady) return "border-accent-green bg-accent-greenBg";
  if (view.hasActive) return "border-brand-tan bg-[var(--c-surface)]";
  if (view.table.status === "open_requested") return "border-accent-orange bg-accent-orangeBg";
  return "border-brand-border bg-[var(--c-surface)]";
}

export function StaffTablesClient({
  tables,
  promptPayId,
  tableAutoOpen = false,
  shopName,
  logoEmoji,
  phone,
  address,
  receiptFooter,
  serviceChargePct,
  vatPct,
}: {
  tables: StaffTableView[];
  promptPayId: string;
  tableAutoOpen?: boolean;
  shopName: string;
  logoEmoji: string;
  phone: string;
  address: string;
  receiptFooter: string;
  serviceChargePct: number;
  vatPct: number;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<number | null>(tables[0]?.table.id ?? null);
  const [isPending, startTransition] = useTransition();
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [printData, setPrintData] = useState<ReceiptData | null>(null);
  const [adjustment, setAdjustment] = useState(0); // ปรับยอด +/- ก่อนชำระ
  const [method, setMethod] = useState("โอน"); // ช่องทางชำระโต๊ะ (default โอน = โชว์ QR)
  const selected = tables.find((view) => view.table.id === selectedId) ?? tables[0] ?? null;
  const bill = computeBill(selected?.total ?? 0, adjustment);

  // คิดยอดบิลโต๊ะ: ยอดรายการ → (±ปรับยอด) → +ค่าบริการ% → +VAT% = ยอดสุทธิ (สูตรเดียวกับ counter)
  function computeBill(itemSum: number, adj: number) {
    const adjustedSub = Math.max(0, itemSum + adj);
    const serviceAmt = Math.round((adjustedSub * serviceChargePct) / 100);
    const vatAmt = Math.round(((adjustedSub + serviceAmt) * vatPct) / 100);
    return { itemSum, adjustedSub, serviceAmt, vatAmt, grand: adjustedSub + serviceAmt + vatAmt };
  }

  // สร้างข้อมูลใบเสร็จของโต๊ะ = รวมทุกออเดอร์ในรอบ (ไม่รวมที่ยกเลิก) + service/VAT + ปรับยอด
  function tableReceipt(view: StaffTableView): ReceiptData {
    const items = view.orders
      .filter((o) => o.status !== "cancelled")
      .flatMap((o) =>
        o.items.map((it) => ({
          name: it.productName,
          qty: it.quantity,
          price: it.quantity > 0 ? it.subtotal / it.quantity : it.subtotal,
          subtotal: it.subtotal,
        })),
      );
    const bill = computeBill(view.total, adjustment);
    return {
      shopName,
      logoEmoji,
      phone,
      address,
      footer: receiptFooter,
      orderNo: `โต๊ะ ${view.table.name}`,
      dateTime: new Date().toLocaleString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      method,
      staffName: "",
      items,
      subtotal: view.total,
      adjustment,
      discountPct: 0,
      discountAmt: 0,
      serviceChargePct: serviceChargePct > 0 ? serviceChargePct : undefined,
      serviceAmt: bill.serviceAmt,
      vatPct: vatPct > 0 ? vatPct : undefined,
      vatAmt: bill.vatAmt,
      finalTotal: bill.grand,
    };
  }

  // พิมพ์ใบเสร็จของโต๊ะ — ลองเครื่องพิมพ์ความร้อนก่อน ไม่ได้ค่อย fallback window.print()
  async function printTableReceipt(view: StaffTableView) {
    const data = tableReceipt(view);
    if (await printBytes(buildReceipt(data, escposEncoding()))) return;
    setPrintData(data);
    setTimeout(() => {
      window.print();
      setPrintData(null);
    }, 60);
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    const timer = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(timer);
  }, [router]);

  // เปลี่ยนโต๊ะ = ล้างค่าปรับยอด + รีเซ็ตช่องทางชำระ (กันติดจากโต๊ะก่อน)
  useEffect(() => {
    setAdjustment(0);
    setMethod("โอน");
  }, [selectedId]);

  // พิมพ์สลิป QR ลิงก์สั่งอาหาร — ใช้ hidden iframe (กัน popup blocker + รอรูปโหลดก่อนสั่งพิมพ์)
  async function printOrderQr(tableName: string, link: string) {
    const dataUrl = await QRCode.toDataURL(link, { width: 320, margin: 2 });
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) {
      iframe.remove();
      return;
    }
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>QR ${tableName}</title>
<style>
  @page { margin: 8mm; }
  body { font-family: -apple-system, "Noto Sans Thai", sans-serif; text-align: center; padding: 12px; margin: 0; }
  .shop { font-size: 15px; color: #555; }
  .table { font-size: 30px; font-weight: 700; margin: 4px 0 2px; }
  .hint { font-size: 16px; margin: 6px 0 10px; }
  img { width: 300px; height: 300px; }
  .url { font-size: 10px; color: #888; word-break: break-all; margin-top: 8px; }
</style></head><body>
  <div class="shop">${shopName}</div>
  <div class="table">โต๊ะ ${tableName}</div>
  <div class="hint">📱 สแกนเพื่อสั่งอาหาร</div>
  <img id="qr" src="${dataUrl}" alt="QR สั่งอาหาร" />
  <div class="url">${link}</div>
</body></html>`);
    doc.close();
    const done = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => iframe.remove(), 1000);
    };
    const img = doc.getElementById("qr") as HTMLImageElement | null;
    if (img && !img.complete) {
      img.onload = done;
      img.onerror = done;
    } else {
      done();
    }
  }

  function copyLink(link: string) {
    navigator.clipboard?.writeText(link).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  }

  // มาร์ก "ทำเสร็จแล้ว" จากหน้าโต๊ะได้ด้วย (เหมือนจอครัว) — new → ready
  function markDone(orderId: number) {
    startTransition(async () => {
      await fetch("/api/order-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: "ready" }),
      });
      router.refresh();
    });
  }

  function markPaid(sessionId: number) {
    startTransition(async () => {
      await fetch("/api/payment-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, adjustment, method }),
      });
      router.refresh();
    });
  }

  function cancelOrder(orderId: number) {
    startTransition(async () => {
      await fetch("/api/order-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: "cancelled" }),
      });
      router.refresh();
    });
  }

  // พนักงานกดเรียกเก็บเงินแทนลูกค้า (เผื่อลูกค้ากดเองไม่เป็น) — ใช้ server action (มีสิทธิ์ staff)
  function callBill(tableToken: string) {
    startTransition(async () => {
      await requestTablePayment(tableToken);
      router.refresh();
    });
  }

  // พนักงานเปิดโต๊ะ (โหมดเข้ม) — ลูกค้าจะสแกนสั่งได้ก็ต่อเมื่อเปิดแล้ว
  function openTableFn(tableToken: string) {
    startTransition(async () => {
      await openTable(tableToken);
      router.refresh();
    });
  }

  // โต๊ะที่ลูกค้า "ขอเปิด" รออนุมัติ — โชว์ popup ให้ staff กดเปิด (อัปเดตทุกรอบ refresh 3 วิ)
  const openRequested = tables.filter((v) => v.table.status === "open_requested");

  return (
    <>
      {openRequested.length > 0 && (
        <div className="fixed inset-x-0 top-3 z-[70] flex justify-center px-3">
          <div className="w-full max-w-md animate-pop rounded-2xl border-2 border-accent-orange bg-accent-orangeBg p-4 shadow-[0_14px_40px_rgba(var(--c-scrim),.28)]">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-2xl">🔔</span>
              <span className="font-itim text-xl text-accent-orange">
                ลูกค้าขอเปิดโต๊ะ ({openRequested.length})
              </span>
            </div>
            <div className="space-y-2">
              {openRequested.map((v) => (
                <div
                  key={v.table.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-brand-card px-3 py-2"
                >
                  <span className="font-bold text-brand-ink">{v.table.name}</span>
                  <button
                    onClick={() => {
                      setSelectedId(v.table.id);
                      openTableFn(v.table.qrToken);
                    }}
                    disabled={isPending}
                    className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-[color:var(--c-on-primary)] disabled:opacity-50"
                  >
                    เปิดโต๊ะ
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 lg:grid lg:grid-cols-[1fr_420px] lg:gap-5 lg:overflow-hidden lg:px-[26px] lg:py-5">
      <section className="mb-4 lg:mb-0 lg:min-h-0 lg:overflow-auto">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
          {tables.map((view) => (
            <button
              key={view.table.id}
              onClick={() => setSelectedId(view.table.id)}
              className={[
                "min-h-[132px] rounded-[20px] border-2 p-4 text-left shadow-[0_8px_20px_rgba(var(--c-sh),.06)] transition hover:-translate-y-0.5",
                tableClass(view),
                selected?.table.id === view.table.id ? "ring-2 ring-brand-primary" : "",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-itim text-3xl leading-none text-brand-primary">
                  {view.table.name}
                </div>
                <span className="rounded-full bg-brand-card px-2.5 py-1 text-[11px] font-bold text-brand-muted">
                  {tableBadge(view)}
                </span>
              </div>
              <div className="mt-5 text-xs font-semibold text-brand-muted2">ยอดปัจจุบัน</div>
              <div className="font-itim text-2xl text-brand-ink">{baht(view.total)}</div>
              <div className="mt-1 text-xs text-brand-muted3">
                {view.orders.length} ออเดอร์
              </div>
            </button>
          ))}
        </div>
      </section>

      <aside className="rounded-[22px] bg-[var(--c-surface)] shadow-[0_10px_28px_rgba(var(--c-sh),.1)] lg:min-h-0 lg:overflow-auto">
        {!selected ? (
          <div className="p-8 text-center text-brand-muted2">ยังไม่มีโต๊ะ</div>
        ) : (
          <>
            <header className="border-b border-brand-border bg-[var(--c-header)] px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-itim text-4xl leading-none text-brand-primary">
                    {selected.table.name}
                  </h2>
                  <div className="mt-1 text-sm font-semibold text-brand-muted2">
                    /table/{selected.table.qrToken}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-brand-muted2">รวม</div>
                  <div className="font-itim text-3xl text-brand-ink">
                    {baht(selected.total)}
                  </div>
                </div>
              </div>
            </header>

            <div className="space-y-4 p-5">
              {/* โหมด auto-open: ซ่อนบล็อกเปิดโต๊ะ/ลิงก์ (ลูกค้าสแกน QR โต๊ะสั่งเองได้เลย ไม่ต้องให้ staff จัดการ) */}
              {!selected.session && !tableAutoOpen && (
                <div className="rounded-2xl border border-brand-border bg-[var(--c-surface-2)] p-4 text-center">
                  <div className="text-sm text-brand-muted2">
                    {selected.table.status === "open_requested"
                      ? "🔔 ลูกค้าขอเปิดโต๊ะนี้ — กดเปิดเพื่อให้เริ่มสั่งอาหารได้"
                      : "โต๊ะนี้ยังไม่เปิด — ลูกค้าสแกน QR จะยังสั่งไม่ได้จนกว่าจะเปิดโต๊ะ"}
                  </div>
                  <button
                    onClick={() => openTableFn(selected.table.qrToken)}
                    disabled={isPending}
                    className="mt-3 w-full rounded-2xl bg-brand-primary py-3 font-itim text-xl text-[color:var(--c-on-primary)] disabled:opacity-50"
                  >
                    เปิดโต๊ะ
                  </button>
                </div>
              )}

              {selected.session?.orderToken && origin && !tableAutoOpen && (
                <div className="rounded-2xl border border-brand-border bg-[var(--c-surface-2)] p-4 text-center">
                  <div className="text-sm font-semibold text-brand-muted2">
                    ลิงก์สั่งอาหาร (รอบนี้) — ให้ลูกค้าสแกน/เปิด
                  </div>
                  <QrImage
                    text={`${origin}/t/${selected.session.orderToken}`}
                    size={180}
                    alt="ลิงก์สั่งอาหาร"
                    className="mx-auto my-2 h-44 w-44 rounded-xl bg-white"
                  />
                  <div className="break-all text-[11px] text-brand-muted3">
                    {`${origin}/t/${selected.session.orderToken}`}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => copyLink(`${origin}/t/${selected.session!.orderToken}`)}
                      className="flex-1 rounded-2xl border border-brand-border py-2.5 font-itim text-lg text-brand-primary"
                    >
                      {copied ? "✓ คัดลอกแล้ว" : "📋 คัดลอกลิงก์"}
                    </button>
                    <button
                      onClick={() =>
                        printOrderQr(selected.table.name, `${origin}/t/${selected.session!.orderToken}`)
                      }
                      className="flex-1 rounded-2xl border border-brand-border py-2.5 font-itim text-lg text-brand-primary"
                    >
                      🖨️ พิมพ์ QR
                    </button>
                  </div>
                </div>
              )}
              {selected.orders.length === 0 ? (
                <div className="rounded-2xl bg-[var(--c-surface-2)] px-4 py-12 text-center text-sm text-brand-muted2">
                  โต๊ะนี้ยังไม่มีออเดอร์
                </div>
              ) : (
                selected.orders.map((order) => (
                  <div key={order.id} className="rounded-2xl border border-brand-border p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-itim text-2xl text-brand-primary">
                          {order.orderNo}
                        </div>
                        <div className="text-xs font-bold text-brand-muted2">
                          {RESTAURANT_ORDER_STATUS[
                            order.status as keyof typeof RESTAURANT_ORDER_STATUS
                          ] ?? order.status}
                        </div>
                      </div>
                      <div className="font-bold text-brand-ink">{baht(order.finalTotal)}</div>
                    </div>
                    <div className="space-y-1.5 text-sm text-brand-muted">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex justify-between gap-3">
                          <span>
                            <span>{item.productName} x{item.quantity}</span>
                            {item.note && (
                              <span className="mt-1 block whitespace-pre-line rounded-xl bg-accent-orangeBg px-2.5 py-2 text-[12px] font-bold leading-relaxed text-accent-orange">
                                {item.note}
                              </span>
                            )}
                          </span>
                          <span className="font-semibold text-brand-ink2">{baht(item.subtotal)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      {order.status === "new" && (
                        <button
                          onClick={() => markDone(order.id)}
                          disabled={isPending}
                          className="flex-1 rounded-2xl bg-accent-green py-3 text-sm font-bold text-white disabled:opacity-60"
                        >
                          ทำเสร็จแล้ว ✓
                        </button>
                      )}
                      {order.status !== "paid" && order.status !== "cancelled" && (
                        <button
                          onClick={() => cancelOrder(order.id)}
                          disabled={isPending}
                          className="flex-1 rounded-2xl border border-accent-orange bg-brand-card py-3 text-sm font-bold text-accent-orange disabled:opacity-60"
                        >
                          ยกเลิก
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}

              {selected.session &&
                selected.hasActive &&
                selected.payment?.status !== "requested" && (
                  <button
                    onClick={() => callBill(selected.table.qrToken)}
                    disabled={isPending}
                    className="w-full rounded-2xl border-2 border-accent-orange bg-accent-orangeBg py-3.5 text-base font-bold text-accent-orange disabled:opacity-60"
                  >
                    เรียกเก็บเงิน / เก็บตัง 💵
                  </button>
                )}

              {selected.payment?.status === "requested" && selected.session && (
                <div className="rounded-[20px] border-2 border-accent-orange bg-accent-orangeBg p-5">
                  <div className="mb-3">
                    <div className="font-itim text-2xl text-accent-orange">ลูกค้าเรียกเก็บเงิน</div>
                  </div>

                  {/* สรุปยอด: รายการ → ปรับยอด → ค่าบริการ → VAT → สุทธิ */}
                  <div className="mb-3 space-y-1.5 rounded-2xl bg-brand-card p-4 text-sm">
                    <div className="flex justify-between text-brand-muted">
                      <span>ยอดรายการ</span>
                      <span>{baht(selected.total)}</span>
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
                    {serviceChargePct > 0 && (
                      <div className="flex justify-between text-brand-muted">
                        <span>ค่าบริการ {serviceChargePct}%</span>
                        <span>{baht(bill.serviceAmt)}</span>
                      </div>
                    )}
                    {vatPct > 0 && (
                      <div className="flex justify-between text-brand-muted">
                        <span>VAT {vatPct}%</span>
                        <span>{baht(bill.vatAmt)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-dashed border-brand-border pt-1.5 text-base font-bold text-brand-ink">
                      <span>ยอดสุทธิ</span>
                      <span className="text-accent-orange">{baht(bill.grand)}</span>
                    </div>
                  </div>

                  {/* ช่องทางชำระเงิน — ชุดเดียวกับหน้าขาย (เงินสด/โอน/บัตร) */}
                  <div className="mb-3 grid grid-cols-3 gap-2">
                    {PAYMENT_METHODS.map((m) => {
                      const active = method === m.key;
                      return (
                        <button
                          key={m.key}
                          onClick={() => setMethod(m.key)}
                          className={[
                            "flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 px-1.5 py-2.5 text-sm font-semibold transition-all",
                            active
                              ? "border-brand-primary bg-brand-card text-brand-primary"
                              : "border-brand-border bg-brand-card text-brand-muted2",
                          ].join(" ")}
                        >
                          <span className="text-[22px]">{m.emoji}</span>
                          {m.key}
                        </button>
                      );
                    })}
                  </div>

                  {method === "โอน" ? (
                    <div className="rounded-2xl bg-brand-card p-4 text-center">
                      <QrImage
                        text={promptPayPayload(promptPayId, bill.grand)}
                        size={224}
                        alt="PromptPay QR"
                        className="mx-auto h-56 w-56"
                      />
                      <div className="mt-2 text-xs text-brand-muted2">
                        PromptPay: {promptPayId}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-brand-card p-5 text-center text-sm text-brand-muted2">
                      รับชำระ{method} {baht(bill.grand)}
                    </div>
                  )}
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => printTableReceipt(selected)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border-2 border-brand-primary bg-brand-card py-3.5 text-base font-bold text-brand-primary"
                    >
                      🖨️ พิมพ์ใบเสร็จ
                    </button>
                    <button
                      onClick={() => markPaid(selected.session!.id)}
                      disabled={isPending}
                      className="flex-1 rounded-2xl bg-brand-primary py-3.5 text-base font-bold text-white disabled:opacity-60"
                    >
                      ชำระแล้ว / ปิดโต๊ะ
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </aside>

      {/* ใบเสร็จซ่อนไว้สำหรับ window.print() (fallback เมื่อไม่มีเครื่องพิมพ์ความร้อน) */}
      {printData && <Receipt data={printData} />}
      </div>
    </>
  );
}
