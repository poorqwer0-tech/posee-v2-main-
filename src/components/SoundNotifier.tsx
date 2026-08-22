"use client";

import { useEffect, useRef, useState } from "react";
import { playVoice, primeAudio } from "@/lib/sound";

const PREF_KEY = "pos-sound-on";

type Notif = {
  newOrderIds: number[];
  ready: { id: number; token: string; name: string }[];
  payments: { tableId: number; token: string; name: string }[];
  openRequests: { tableId: number; token: string; name: string }[];
};

/**
 * ตัวแจ้งเตือนกลาง — poll ทุก 4 วิ แล้วเล่นเสียงไม่ว่าอยู่หน้าไหน
 * (ออเดอร์ใหม่ / ทำเสร็จรอเสิร์ฟ / โต๊ะเรียกเก็บเงิน)
 */
export function SoundNotifier() {
  const [on, setOn] = useState(false);
  const onRef = useRef(false);
  const knownNew = useRef<Set<number> | null>(null);
  const knownReady = useRef<Set<number> | null>(null);
  const knownPay = useRef<Set<number> | null>(null);
  const knownOpenReq = useRef<Set<number> | null>(null);

  useEffect(() => {
    setOn(localStorage.getItem(PREF_KEY) === "1");
  }, []);
  useEffect(() => {
    onRef.current = on;
  }, [on]);

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (!res.ok) return;
        const d: Notif = await res.json();

        const first = knownNew.current === null;
        const freshNew = !first && d.newOrderIds.some((id) => !knownNew.current!.has(id));
        const freshReady = first
          ? []
          : d.ready.filter((r) => !knownReady.current!.has(r.id));
        const freshPay = first
          ? []
          : d.payments.filter((p) => !knownPay.current!.has(p.tableId));
        const openReqs = d.openRequests ?? [];
        const freshOpenReq = first
          ? []
          : openReqs.filter((o) => !knownOpenReq.current!.has(o.tableId));

        knownNew.current = new Set(d.newOrderIds);
        knownReady.current = new Set(d.ready.map((r) => r.id));
        knownPay.current = new Set(d.payments.map((p) => p.tableId));
        knownOpenReq.current = new Set(openReqs.map((o) => o.tableId));

        if (first || !onRef.current) return;

        // เล่นทีละเสียงต่อรอบ กันเสียงทับกัน (ลำดับ: ขอเปิดโต๊ะ > เก็บเงิน > ออเดอร์ใหม่ > ทำเสร็จ)
        if (freshOpenReq.length) {
          playVoice("/audio/open-request.mp3", "มีลูกค้าขอเปิดโต๊ะค่ะ");
        } else if (freshPay.length) {
          const p = freshPay[0];
          playVoice(`/audio/payment-${p.token}.mp3`, `${p.name} เรียกเก็บเงินจ้า`);
        } else if (freshNew) {
          playVoice("/audio/new-order.mp3", "ออเดอร์โต๊ะเข้าจ้า");
        } else if (freshReady.length) {
          const r = freshReady[0];
          playVoice(
            r.token ? `/audio/ready-${r.token}.mp3` : "/audio/ready.mp3",
            `ออเดอร์${r.name} พร้อมเสิร์ฟแล้วจ้า`,
          );
        }
      } catch {
        /* เงียบไว้ */
      }
    }
    poll();
    const t = setInterval(poll, 4000);
    return () => clearInterval(t);
  }, []);

  function toggle() {
    const next = !on;
    setOn(next);
    localStorage.setItem(PREF_KEY, next ? "1" : "0");
    if (next) {
      primeAudio(["/audio/new-order.mp3", "/audio/ready.mp3", "/audio/payment.mp3"]);
      playVoice("/audio/new-order.mp3", "เปิดเสียงแล้วจ้า");
    }
  }

  return (
    <button
      onClick={toggle}
      title={on ? "ปิดเสียงแจ้งเตือน" : "เปิดเสียงแจ้งเตือน"}
      className={[
        "fixed right-4 bottom-[80px] z-30 flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold shadow-[0_8px_20px_rgba(var(--c-sh),.22)] transition lg:bottom-4",
        on ? "bg-accent-green text-white" : "bg-brand-card text-brand-muted border border-brand-border",
      ].join(" ")}
    >
      <span className="text-base">{on ? "🔊" : "🔇"}</span>
      {on ? "เสียงเปิดอยู่" : "เปิดเสียง"}
    </button>
  );
}
