"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RESTAURANT_ORDER_STATUS, timeLabel } from "@/lib/utils";
import { buildKitchenTicket } from "@/lib/escpos";
import { connectThermalPrinter, escposEncoding, isThermalSupported, printBytes, shouldOfferPrintApp } from "@/lib/thermal";
import { useToast } from "./Toast";

type KitchenOrder = {
  id: number;
  orderNo: string;
  status: string;
  tableName: string;
  tableToken: string;
  note: string;
  createdAt: Date;
  items: { id: number; productName: string; quantity: number; note: string }[];
};

// 2 ขั้นเท่านั้น: รับออเดอร์ (new) → ทำเสร็จแล้ว (ready) แล้วออกจากจอครัว
const NEXT_ACTION: Record<string, { next: string; label: string; className: string }> = {
  new: {
    next: "ready",
    label: "ทำเสร็จแล้ว ✓",
    className: "bg-accent-green text-white",
  },
};

function statusClass(status: string) {
  if (status === "new") return "bg-accent-orangeBg text-accent-orange";
  if (status === "ready") return "bg-accent-greenBg text-accent-greenText";
  return "bg-brand-chip text-brand-muted";
}

export function KitchenClient({ orders }: { orders: KitchenOrder[] }) {
  const router = useRouter();
  const flash = useToast();
  const [isPending, startTransition] = useTransition();
  const [printOrder, setPrintOrder] = useState<KitchenOrder | null>(null); // สำหรับ fallback พิมพ์ผ่านเบราว์เซอร์
  const [thermal, setThermal] = useState(false);
  const [offerApp, setOfferApp] = useState(false);
  // จอครัวโชว์เฉพาะที่ยังต้องทำ (รับออเดอร์); ทำเสร็จแล้ว = ออกจากจอ (นับใน tile ด้านบน)
  const active = orders.filter((o) => o.status === "new");

  useEffect(() => {
    setThermal(isThermalSupported());
    setOfferApp(shouldOfferPrintApp());
  }, []);

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(timer);
  }, [router]);

  function move(orderId: number, status: string) {
    startTransition(async () => {
      await fetch("/api/order-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status }),
      });
      router.refresh();
    });
  }

  async function connectPrinter() {
    const ok = await connectThermalPrinter();
    flash(ok ? "เชื่อมเครื่องพิมพ์แล้ว 🖨️" : "เชื่อมไม่สำเร็จ / ยกเลิก");
  }

  /** พิมพ์บิลครัว — ลองส่ง ESC/POS ก่อน ถ้าไม่ได้ค่อยพิมพ์ผ่านเบราว์เซอร์ */
  async function printTicket(order: KitchenOrder) {
    const ticket = {
      tableName: order.tableName,
      orderNo: order.orderNo,
      time: timeLabel(new Date(order.createdAt)),
      items: order.items.map((it) => ({
        name: it.productName,
        quantity: it.quantity,
        note: it.note,
      })),
      note: order.note,
    };
    // ลองส่ง ESC/POS ทุกช่องทาง (Sunmi ในตัว → แอปตัวกลาง → USB serial)
    const sent = await printBytes(buildKitchenTicket(ticket, escposEncoding()));
    if (sent) {
      flash(`พิมพ์บิลครัว ${order.tableName} แล้ว 🖨️`);
      return;
    }
    // fallback: พิมพ์ผ่านเบราว์เซอร์ (OS driver → เครื่องพิมพ์ 72mm)
    setPrintOrder(order);
    setTimeout(() => {
      window.print();
      setPrintOrder(null);
    }, 60);
  }

  return (
    <div className="flex-1 overflow-auto px-3 py-4 sm:px-[26px] sm:py-5">
      {thermal && (
        <div className="mb-3 flex items-center justify-end">
          <button
            onClick={connectPrinter}
            className="rounded-full border border-brand-border bg-brand-card px-3.5 py-1.5 text-xs font-bold text-brand-muted shadow-[0_1px_0_rgb(var(--brand-border2))]"
          >
            🖨️ เชื่อมเครื่องพิมพ์
          </button>
        </div>
      )}
      {offerApp && (
        <div className="mb-3 flex items-center justify-end">
          <a
            href="/print-app.apk"
            download
            className="rounded-full border border-brand-primary bg-brand-card px-3.5 py-1.5 text-xs font-bold text-brand-primary shadow-[0_1px_0_rgb(var(--brand-border2))]"
          >
            📥 ติดตั้งแอปพิมพ์ Sunmi
          </a>
        </div>
      )}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:mb-5 sm:gap-3">
        {["new", "ready"].map((status) => (
          <div key={status} className="rounded-[18px] bg-[var(--c-surface)] p-4 shadow-[0_6px_16px_rgba(var(--c-sh),.06)]">
            <div className="text-xs font-bold text-brand-muted2">
              {RESTAURANT_ORDER_STATUS[status as keyof typeof RESTAURANT_ORDER_STATUS]}
            </div>
            <div className="font-itim text-3xl text-brand-primary">
              {orders.filter((o) => o.status === status).length}
            </div>
          </div>
        ))}
      </div>

      {active.length === 0 ? (
        <div className="rounded-[22px] bg-[var(--c-surface)] px-6 py-20 text-center shadow-[0_6px_16px_rgba(var(--c-sh),.06)]">
          <div className="font-itim text-3xl text-brand-primary">ยังไม่มีออเดอร์เข้าครัว</div>
          <div className="mt-2 text-sm text-brand-muted2">หน้านี้จะอัปเดตอัตโนมัติทุก 3 วินาที</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          {active.map((order) => {
            const action = NEXT_ACTION[order.status];
            return (
              <article
                key={order.id}
                className="overflow-hidden rounded-[20px] bg-[var(--c-surface)] shadow-[0_10px_26px_rgba(var(--c-sh),.09)]"
              >
                <header className="flex items-start justify-between gap-3 border-b border-brand-border bg-[var(--c-header)] px-5 py-4">
                  <div>
                    <div className="font-itim text-3xl leading-none text-brand-primary">
                      {order.tableName}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-brand-muted2">
                      {order.orderNo} · {timeLabel(new Date(order.createdAt))}
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(order.status)}`}>
                    {RESTAURANT_ORDER_STATUS[
                      order.status as keyof typeof RESTAURANT_ORDER_STATUS
                    ] ?? order.status}
                  </span>
                </header>

                <div className="space-y-3 p-5">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-[18px] border border-brand-border bg-brand-card p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xl font-bold leading-tight text-brand-ink2">
                            {item.productName}
                          </div>
                        </div>
                        <div className="rounded-full bg-brand-sidebar px-3 py-1 font-itim text-xl text-white">
                          x{item.quantity}
                        </div>
                      </div>

                      {item.note ? (
                        <div className="mt-3 whitespace-pre-line rounded-2xl bg-accent-orangeBg px-4 py-3 text-[15px] font-bold leading-relaxed text-accent-orange">
                          {item.note}
                        </div>
                      ) : (
                        <div className="mt-3 rounded-2xl bg-[var(--c-surface-2)] px-4 py-2 text-sm font-semibold text-brand-muted2">
                          ไม่มีรายละเอียดเพิ่มเติม
                        </div>
                      )}
                    </div>
                  ))}

                  {order.note && (
                    <div className="rounded-2xl bg-accent-orangeBg px-4 py-3 text-sm font-semibold text-accent-orange">
                      หมายเหตุ: {order.note}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => printTicket(order)}
                      className="flex-none rounded-2xl border-[1.5px] border-brand-border bg-brand-card px-3.5 py-3.5 text-base font-bold text-brand-primary"
                      aria-label="พิมพ์บิลครัว"
                      title="พิมพ์บิลครัว"
                    >
                      🖨️
                    </button>
                    {action && (
                      <button
                        onClick={() => move(order.id, action.next)}
                        disabled={isPending}
                        className={`flex-1 rounded-2xl py-3.5 text-base font-bold ${action.className} disabled:opacity-60`}
                      >
                        {action.label}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* บิลครัวสำหรับพิมพ์ผ่านเบราว์เซอร์ (fallback) — ซ่อนบนจอ */}
      {printOrder && (
        <div className="kitchen-ticket-print">
          <div style={{ textAlign: "center", fontWeight: 700, fontSize: "20px" }}>
            {printOrder.tableName}
          </div>
          <div style={{ textAlign: "center" }}>บิลครัว {printOrder.orderNo}</div>
          <div style={{ textAlign: "center", marginBottom: "6px" }}>
            {timeLabel(new Date(printOrder.createdAt))}
          </div>
          <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
          {printOrder.items.map((it) => (
            <div key={it.id} style={{ marginBottom: "4px" }}>
              <div style={{ fontSize: "16px", fontWeight: 700 }}>
                x{it.quantity} {it.productName}
              </div>
              {it.note ? (
                <div style={{ fontSize: "13px", paddingLeft: "12px" }}>- {it.note}</div>
              ) : null}
            </div>
          ))}
          {printOrder.note ? (
            <>
              <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
              <div>หมายเหตุ: {printOrder.note}</div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
