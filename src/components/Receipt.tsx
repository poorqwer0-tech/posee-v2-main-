"use client";

import { baht } from "@/lib/utils";

export type ReceiptData = {
  shopName: string;
  logoEmoji?: string;
  phone: string;
  address?: string;
  footer: string;
  orderNo: string;
  dateTime: string;
  method: string;
  staffName: string;
  items: { name: string; qty: number; price: number; subtotal: number }[];
  subtotal: number;
  adjustment?: number; // ปรับยอด +/- (โต๊ะ) — ก่อนคิด service/VAT
  discountPct: number;
  discountAmt: number;
  serviceChargePct?: number;
  serviceAmt?: number;
  vatPct?: number;
  vatAmt?: number;
  finalTotal: number;
};

/**
 * ใบเสร็จสำหรับปริ้น — ซ่อนบนจอ (class .receipt-print) จะโชว์เฉพาะตอน window.print()
 * รองรับกระดาษความร้อน 72mm หรือพิมพ์ลงกระดาษ A4 (อยู่ซ้ายบน)
 */
export function Receipt({ data }: { data: ReceiptData }) {
  return (
    <div
      className="receipt-print"
      style={{
        fontFamily: "'Mali', sans-serif",
        fontSize: "12px",
        lineHeight: 1.5,
        color: "#000",
        padding: "4px",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "6px" }}>
        <div style={{ fontSize: "22px" }}>{data.logoEmoji ?? "🍜"}</div>
        <div style={{ fontSize: "18px", fontWeight: 700 }}>{data.shopName}</div>
        {data.address ? <div style={{ fontSize: "11px" }}>{data.address}</div> : null}
        {data.phone ? <div>โทร. {data.phone}</div> : null}
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>เลขที่บิล</span>
        <span style={{ fontWeight: 700 }}>{data.orderNo}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>วันที่/เวลา</span>
        <span>{data.dateTime}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>ชำระโดย</span>
        <span>{data.method}</span>
      </div>
      {data.staffName ? (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>พนักงาน</span>
          <span>{data.staffName}</span>
        </div>
      ) : null}

      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

      {data.items.map((it, i) => (
        <div key={i} style={{ marginBottom: "3px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{it.name}</span>
            <span>{baht(it.subtotal)}</span>
          </div>
          <div style={{ color: "#444", fontSize: "11px" }}>
            {it.qty} x {baht(it.price)}
          </div>
        </div>
      ))}

      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>ยอดรวม</span>
        <span>{baht(data.subtotal)}</span>
      </div>
      {data.adjustment ? (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>ปรับยอด</span>
          <span>
            {data.adjustment > 0 ? "+" : "−"}
            {baht(Math.abs(data.adjustment))}
          </span>
        </div>
      ) : null}
      {data.discountPct > 0 ? (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>ส่วนลด {data.discountPct}%</span>
          <span>−{baht(data.discountAmt)}</span>
        </div>
      ) : null}
      {data.serviceChargePct && data.serviceChargePct > 0 ? (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>ค่าบริการ {data.serviceChargePct}%</span>
          <span>{baht(data.serviceAmt ?? 0)}</span>
        </div>
      ) : null}
      {data.vatPct && data.vatPct > 0 ? (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>VAT {data.vatPct}%</span>
          <span>{baht(data.vatAmt ?? 0)}</span>
        </div>
      ) : null}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "16px",
          fontWeight: 700,
          marginTop: "4px",
        }}
      >
        <span>ยอดสุทธิ</span>
        <span>{baht(data.finalTotal)}</span>
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

      <div style={{ textAlign: "center", marginTop: "6px" }}>
        {data.footer}
      </div>
    </div>
  );
}
