"use client";

import { useState, useTransition } from "react";
import { createExpense, deleteExpense, type ExpenseInput } from "@/lib/actions";
import { baht } from "@/lib/utils";
import { useToast } from "./Toast";

export type ExpenseView = {
  id: number;
  title: string;
  category: string;
  amount: number;
  note: string;
  dateLabel: string;
  timeLabel: string;
  isToday: boolean;
};

const CATEGORIES = ["วัตถุดิบ", "ค่าเช่า", "เงินเดือน", "อุปกรณ์", "อื่นๆ"];

const CAT_EMOJI: Record<string, string> = {
  วัตถุดิบ: "🧺",
  ค่าเช่า: "🏠",
  เงินเดือน: "💵",
  อุปกรณ์: "🔧",
  อื่นๆ: "📦",
};

export function ExpensesClient({
  expenses,
  todayTotal,
}: {
  expenses: ExpenseView[];
  todayTotal: number;
}) {
  const flash = useToast();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("วัตถุดิบ");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  const monthTotal = expenses.reduce((s, e) => s + e.amount, 0);

  function add() {
    if (!title.trim() || !amount) {
      flash("ใส่รายการและจำนวนเงินก่อนนะ");
      return;
    }
    const input: ExpenseInput = {
      title,
      category,
      amount: Number(amount) || 0,
      note,
    };
    startTransition(async () => {
      const res = await createExpense(input);
      if (!res.ok) {
        flash(res.error ?? "เกิดข้อผิดพลาด");
        return;
      }
      setTitle("");
      setAmount("");
      setNote("");
      flash("บันทึกรายจ่ายแล้ว ✓");
    });
  }

  function remove(id: number) {
    startTransition(async () => {
      await deleteExpense(id);
      flash("ลบรายจ่ายแล้ว");
    });
  }

  return (
    <div className="flex-1 animate-fadeUp overflow-auto px-4 sm:px-[26px] pb-[30px] pt-5">
      {/* สรุป */}
      <div className="mb-4 grid grid-cols-2 gap-3.5">
        <div className="flex items-center gap-4 rounded-[20px] bg-[var(--c-surface)] px-[22px] py-5 shadow-[0_6px_18px_rgba(var(--c-sh),.06)]">
          <div className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-accent-orangeBg text-[28px]">
            💸
          </div>
          <div>
            <div className="text-[13px] text-brand-muted2">รายจ่ายวันนี้</div>
            <div className="font-itim text-[30px] leading-[1.15] text-accent-orange">
              {baht(todayTotal)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-[20px] bg-[var(--c-surface)] px-[22px] py-5 shadow-[0_6px_18px_rgba(var(--c-sh),.06)]">
          <div className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-brand-chip text-[28px]">
            🧾
          </div>
          <div>
            <div className="text-[13px] text-brand-muted2">รายจ่ายทั้งหมด</div>
            <div className="font-itim text-[30px] leading-[1.15] text-brand-primary">
              {baht(monthTotal)}
            </div>
            <div className="text-xs text-brand-muted3">{expenses.length} รายการ</div>
          </div>
        </div>
      </div>

      {/* ฟอร์มเพิ่มรายจ่าย */}
      <div className="mb-4 rounded-[20px] bg-[var(--c-surface)] p-[22px] shadow-[0_6px_18px_rgba(var(--c-sh),.06)]">
        <div className="mb-4 font-itim text-[19px] text-brand-ink">เพิ่มรายจ่าย ➕</div>
        <div className="mb-3 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const active = category === c;
            return (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={[
                  "flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all",
                  active
                    ? "bg-brand-primary text-white"
                    : "bg-brand-chip text-[color:var(--c-muted)]",
                ].join(" ")}
              >
                <span>{CAT_EMOJI[c]}</span>
                {c}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-[2]">
            <label className="mb-[7px] block text-[13px] text-brand-muted2">รายการ</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น เมล็ดกาแฟ 2 กก."
              className="w-full rounded-xl border-[1.5px] border-[color:var(--c-border-strong)] bg-brand-cream px-3.5 py-3 text-[15px] text-brand-ink outline-none"
            />
          </div>
          <div className="min-w-[120px] flex-1">
            <label className="mb-[7px] block text-[13px] text-brand-muted2">จำนวนเงิน (บาท)</label>
            <input
              value={amount}
              inputMode="numeric"
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="0"
              className="w-full rounded-xl border-[1.5px] border-[color:var(--c-border-strong)] bg-brand-cream px-3.5 py-3 text-[15px] text-brand-ink outline-none"
            />
          </div>
          <div className="min-w-[160px] flex-[1.5]">
            <label className="mb-[7px] block text-[13px] text-brand-muted2">หมายเหตุ (ไม่บังคับ)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border-[1.5px] border-[color:var(--c-border-strong)] bg-brand-cream px-3.5 py-3 text-[15px] text-brand-ink outline-none"
            />
          </div>
          <button
            onClick={add}
            disabled={isPending}
            className="cursor-pointer rounded-[14px] bg-brand-primary px-7 py-3 text-[15px] font-semibold text-[color:var(--c-on-primary)] shadow-[0_3px_0_var(--c-primary-dark)] transition-transform active:translate-y-0.5 active:shadow-[0_1px_0_var(--c-primary-dark)] disabled:opacity-60"
          >
            บันทึก
          </button>
        </div>
      </div>

      {/* รายการ */}
      <div className="overflow-hidden rounded-[20px] bg-[var(--c-surface)] shadow-[0_6px_18px_rgba(var(--c-sh),.06)]">
        <div className="grid grid-cols-[1fr_140px_120px_110px_60px] gap-2.5 bg-[var(--c-surface-2)] px-[22px] py-3.5 text-xs font-semibold text-brand-muted2">
          <span>รายการ</span>
          <span>หมวดหมู่</span>
          <span>วันที่</span>
          <span className="text-right">จำนวนเงิน</span>
          <span />
        </div>
        {expenses.length === 0 ? (
          <div className="px-[22px] py-16 text-center text-[15px] text-brand-muted3">
            ยังไม่มีรายจ่าย — เพิ่มรายการแรกด้านบนได้เลย
          </div>
        ) : (
          expenses.map((e) => (
            <div
              key={e.id}
              className="grid grid-cols-[1fr_140px_120px_110px_60px] items-center gap-2.5 border-b border-[color:var(--c-divider-soft)] px-[22px] py-[15px] text-sm"
            >
              <span className="min-w-0">
                <span className="font-semibold text-brand-ink2">{e.title}</span>
                {e.note ? (
                  <span className="ml-2 text-xs text-brand-muted3">{e.note}</span>
                ) : null}
              </span>
              <span className="text-brand-muted">
                {CAT_EMOJI[e.category] ?? "📦"} {e.category}
              </span>
              <span className="text-brand-muted3">
                {e.dateLabel} {e.timeLabel}
              </span>
              <span className="text-right font-bold text-accent-orange">
                −{baht(e.amount)}
              </span>
              <span className="flex justify-end">
                <button
                  onClick={() => remove(e.id)}
                  className="cursor-pointer rounded-[10px] border-[1.5px] border-accent-orangeBorder bg-accent-orangeBg px-2.5 py-[5px] text-xs text-accent-orange"
                >
                  ลบ
                </button>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
