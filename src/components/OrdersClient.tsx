"use client";

import { useState, useTransition } from "react";
import { cancelOrder } from "@/lib/actions";
import { baht, RESTAURANT_ORDER_STATUS } from "@/lib/utils";
import { Receipt, type ReceiptData } from "./Receipt";
import { buildReceipt } from "@/lib/escpos";
import { escposEncoding, printBytes } from "@/lib/thermal";
import type { ShopInfo } from "./PosClient";
import { useToast } from "./Toast";

export type OrderItemView = {
  name: string;
  emoji: string;
  price: number;
  qty: number;
  subtotal: number;
};

export type OrderView = {
  id: number;
  no: string;
  total: number;
  discount: number;
  finalTotal: number;
  method: string;
  status: string;
  time: string;
  dateTime: string;
  staffName: string;
  staffEmoji: string;
  items: OrderItemView[];
};

function badgeClass(status: string) {
  if (status === "ready" || status === "paid") return "bg-accent-greenBg text-accent-greenText";
  if (status === "cancelled" || status === "ยกเลิก") return "bg-accent-orangeBg text-accent-orange";
  return "bg-brand-chip text-[color:var(--c-muted)]";
}

function statusLabel(status: string) {
  return (
    RESTAURANT_ORDER_STATUS[status as keyof typeof RESTAURANT_ORDER_STATUS] ?? status
  );
}

const COLS = "grid-cols-[96px_1fr_120px_72px_100px_92px_56px]";

export function OrdersClient({
  orders,
  shop,
}: {
  orders: OrderView[];
  shop: ShopInfo;
}) {
  const flash = useToast();
  const [selected, setSelected] = useState<OrderView | null>(null);
  const [isPending, startTransition] = useTransition();

  const receipt: ReceiptData | null = selected
    ? {
        shopName: shop.shopName,
        logoEmoji: shop.logoEmoji,
        phone: shop.phone,
        address: shop.address,
        footer: shop.footer,
        orderNo: selected.no,
        dateTime: selected.dateTime,
        method: selected.method,
        staffName: selected.staffName,
        items: selected.items.map((it) => ({
          name: it.name,
          qty: it.qty,
          price: it.price,
          subtotal: it.subtotal,
        })),
        subtotal: selected.total,
        discountPct: selected.discount,
        discountAmt: Math.max(0, selected.total - selected.finalTotal),
        finalTotal: selected.finalTotal,
      }
    : null;

  function handleCancel() {
    if (!selected) return;
    startTransition(async () => {
      await cancelOrder(selected.id);
      setSelected(null);
      flash("ยกเลิกบิลแล้ว");
    });
  }

  return (
    <div className="flex-1 animate-fadeUp overflow-auto px-4 sm:px-[26px] pb-[30px] pt-5">
      <div className="overflow-x-auto rounded-[20px] bg-[var(--c-surface)] shadow-[0_6px_18px_rgba(var(--c-sh),.06)]">
        <div className="min-w-[620px]">
        <div
          className={`grid ${COLS} gap-2.5 bg-[var(--c-surface-2)] px-[22px] py-3.5 text-xs font-semibold text-brand-muted2`}
        >
          <span>เลขบิล</span>
          <span>รายการ</span>
          <span>พนักงาน</span>
          <span className="text-center">เวลา</span>
          <span className="text-right">ยอดสุทธิ</span>
          <span className="text-center">สถานะ</span>
          <span />
        </div>

        {orders.length === 0 ? (
          <div className="px-[22px] py-16 text-center text-[15px] text-brand-muted3">
            ยังไม่มีออเดอร์ — ไปที่หน้า “ขายของ” เพื่อเปิดบิลแรกได้เลย ☕
          </div>
        ) : (
          orders.map((o) => (
            <div
              key={o.id}
              className={`grid ${COLS} items-center gap-2.5 border-b border-[color:var(--c-divider-soft)] px-[22px] py-[15px] text-sm`}
            >
              <span className="font-itim text-base text-brand-primary">{o.no}</span>
              <span className="overflow-hidden text-ellipsis whitespace-nowrap text-brand-muted">
                {o.items.map((it) => `${it.name}×${it.qty}`).join(", ")}
              </span>
              <span className="overflow-hidden text-ellipsis whitespace-nowrap text-brand-muted">
                {o.staffName ? `${o.staffEmoji} ${o.staffName}` : "—"}
              </span>
              <span className="text-center text-brand-muted3">{o.time}</span>
              <span className="text-right font-bold text-brand-ink2">
                {baht(o.finalTotal)}
              </span>
              <span className="flex justify-center">
                <span
                  className={`rounded-xl px-3 py-1 text-xs font-semibold ${badgeClass(o.status)}`}
                >
                  {statusLabel(o.status)}
                </span>
              </span>
              <span className="flex justify-end">
                <button
                  onClick={() => setSelected(o)}
                  className="cursor-pointer rounded-[10px] border-[1.5px] border-[color:var(--c-border-strong)] bg-brand-card px-3 py-[5px] text-xs text-brand-primary"
                >
                  ดู
                </button>
              </span>
            </div>
          ))
        )}
        </div>
      </div>

      {/* ===== MODAL รายละเอียดบิล ===== */}
      {selected && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-[rgba(var(--c-scrim),.42)] p-5">
          <div className="w-full max-w-[360px] animate-pop rounded-[18px] bg-[var(--c-surface)] px-6 py-[26px] shadow-[0_24px_60px_rgba(var(--c-scrim),.3)]">
            <div className="mb-3.5 border-b-[1.5px] border-dashed border-[color:var(--c-divider)] pb-3.5 text-center">
              <div className="text-[30px]">🧾</div>
              <div className="font-itim text-[22px] text-brand-ink">บิล {selected.no}</div>
              <div className="text-xs text-brand-muted3">
                {selected.time} · {selected.method}
              </div>
              {selected.staffName && (
                <div className="mt-1 text-xs text-brand-muted">
                  👤 ขายโดย {selected.staffEmoji} {selected.staffName}
                </div>
              )}
            </div>
            <div className="mb-3.5 flex flex-col gap-[9px]">
              {selected.items.map((it, i) => (
                <div
                  key={i}
                  className="flex justify-between text-sm text-brand-muted"
                >
                  <span>
                    {it.name} ×{it.qty}
                  </span>
                  <span className="font-semibold text-brand-ink2">
                    {baht(it.subtotal)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mb-[18px] flex items-end justify-between border-t-[1.5px] border-dashed border-[color:var(--c-divider)] pt-3">
              <span className="text-sm font-semibold text-brand-ink2">ยอดสุทธิ</span>
              <span className="font-itim text-[26px] text-brand-primary">
                {baht(selected.finalTotal)}
              </span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setSelected(null)}
                className="flex-1 cursor-pointer rounded-[14px] border-[1.5px] border-[color:var(--c-border-strong)] bg-brand-card p-3 text-[15px] text-[color:var(--c-muted)]"
              >
                ปิด
              </button>
              <button
                onClick={async () => {
                  if (receipt && (await printBytes(buildReceipt(receipt, escposEncoding())))) return;
                  window.print();
                }}
                className="flex flex-1 items-center justify-center gap-1 cursor-pointer rounded-[14px] border-[1.5px] border-brand-primary bg-brand-card p-3 text-[15px] font-semibold text-brand-primary"
              >
                🖨️ ปริ้น
              </button>
              {selected.status !== "cancelled" &&
                selected.status !== "ยกเลิก" &&
                selected.status !== "paid" && (
                  <button
                    onClick={handleCancel}
                    disabled={isPending}
                    className="flex-1 cursor-pointer rounded-[14px] border-[1.5px] border-accent-orangeBorder bg-accent-orangeBg p-3 text-[15px] text-accent-orange disabled:opacity-60"
                  >
                    ยกเลิกบิล
                  </button>
                )}
            </div>
          </div>
        </div>
      )}

      {/* ใบเสร็จซ่อนไว้สำหรับปริ้น */}
      {receipt && <Receipt data={receipt} />}
    </div>
  );
}
