"use client";

import { useState, useTransition } from "react";
import type { Ingredient } from "@/db/schema";
import {
  adjustIngredientStock,
  createIngredient,
  deleteIngredient,
  updateIngredient,
  type IngredientInput,
} from "@/lib/actions";
import { useToast } from "./Toast";

const EMOJI_CHOICES = [
  "🫘", "🥛", "🍵", "🧡", "🍮", "🍫", "🧋", "🍋", "🍦", "🥤", "🥐", "🍰", "🍪", "💧", "🧊", "📦",
];
const UNITS = ["กรัม", "มล.", "ชิ้น", "ใบ", "ลูก", "ขวด", "ถุง", "กล่อง"];

type FormState = {
  name: string;
  unit: string;
  emoji: string;
  stock: string;
  lowThreshold: string;
};

const EMPTY: FormState = {
  name: "",
  unit: "กรัม",
  emoji: "🫘",
  stock: "",
  lowThreshold: "",
};

export function IngredientsClient({
  ingredients,
}: {
  ingredients: Ingredient[];
}) {
  const flash = useToast();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [restock, setRestock] = useState<Record<number, string>>({});

  const lowItems = ingredients.filter((i) => i.stock <= i.lowThreshold);

  function add() {
    if (!form.name.trim()) {
      flash("ใส่ชื่อวัตถุดิบก่อนนะ");
      return;
    }
    const input: IngredientInput = {
      name: form.name,
      unit: form.unit,
      emoji: form.emoji,
      stock: Number(form.stock) || 0,
      lowThreshold: Number(form.lowThreshold) || 0,
    };
    startTransition(async () => {
      const res = editingId
        ? await updateIngredient(editingId, input)
        : await createIngredient(input);
      if (!res.ok) {
        flash(res.error ?? "เกิดข้อผิดพลาด");
        return;
      }
      setForm(EMPTY);
      setEditingId(null);
      flash(editingId ? "แก้ไขวัตถุดิบแล้ว ✓" : "เพิ่มวัตถุดิบแล้ว 🎉");
    });
  }

  function startEdit(i: Ingredient) {
    setEditingId(i.id);
    setForm({
      name: i.name,
      unit: i.unit,
      emoji: i.emoji,
      stock: String(i.stock),
      lowThreshold: String(i.lowThreshold),
    });
  }

  function adjust(id: number, delta: number) {
    startTransition(async () => {
      await adjustIngredientStock(id, delta);
    });
  }

  function applyRestock(id: number) {
    const amt = Number(restock[id]);
    if (!amt) return;
    setRestock((r) => ({ ...r, [id]: "" }));
    adjust(id, amt);
  }

  function remove(id: number) {
    startTransition(async () => {
      await deleteIngredient(id);
      flash("ลบวัตถุดิบแล้ว");
    });
  }

  return (
    <div className="flex-1 animate-fadeUp overflow-auto px-4 sm:px-[26px] pb-[30px] pt-5">
      {/* สรุป + เตือน */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3 rounded-[16px] bg-[var(--c-surface)] px-5 py-3 shadow-[0_4px_14px_rgba(var(--c-sh),.06)]">
          <span className="text-[22px]">📦</span>
          <div>
            <div className="text-[12px] text-brand-muted2">วัตถุดิบทั้งหมด</div>
            <div className="font-itim text-[22px] leading-tight text-brand-primary">
              {ingredients.length} รายการ
            </div>
          </div>
        </div>
        {lowItems.length > 0 && (
          <div className="flex flex-1 flex-wrap items-center gap-2 rounded-[16px] border border-[color:var(--c-warn-border)] bg-[var(--c-surface-2)] px-4 py-3 text-sm">
            <span className="text-[18px]">⚠️</span>
            <span className="font-semibold text-[color:var(--c-warn-ink)]">
              ใกล้หมด/หมด {lowItems.length} รายการ:
            </span>
            <span className="text-brand-muted">
              {lowItems.map((i) => `${i.emoji} ${i.name}`).join(" · ")}
            </span>
          </div>
        )}
      </div>

      {/* ฟอร์มเพิ่ม/แก้ไข */}
      <div className="mb-4 rounded-[20px] bg-[var(--c-surface)] p-[22px] shadow-[0_6px_18px_rgba(var(--c-sh),.06)]">
        <div className="mb-4 font-itim text-[19px] text-brand-ink">
          {editingId ? "แก้ไขวัตถุดิบ ✏️" : "เพิ่มวัตถุดิบ ➕"}
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {EMOJI_CHOICES.map((e) => (
            <button
              key={e}
              onClick={() => setForm({ ...form, emoji: e })}
              className={[
                "h-10 w-10 cursor-pointer rounded-xl border-2 text-[20px]",
                form.emoji === e
                  ? "border-brand-primary bg-[var(--c-selected)]"
                  : "border-[color:var(--c-border)] bg-brand-card",
              ].join(" ")}
            >
              {e}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-[2]">
            <label className="mb-[7px] block text-[13px] text-brand-muted2">ชื่อวัตถุดิบ</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="เช่น เมล็ดกาแฟ"
              className="w-full rounded-xl border-[1.5px] border-[color:var(--c-border-strong)] bg-brand-cream px-3.5 py-3 text-[15px] text-brand-ink outline-none"
            />
          </div>
          <div className="min-w-[110px] flex-1">
            <label className="mb-[7px] block text-[13px] text-brand-muted2">หน่วย</label>
            <select
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="w-full rounded-xl border-[1.5px] border-[color:var(--c-border-strong)] bg-brand-cream px-3.5 py-3 text-[15px] text-brand-ink outline-none"
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          {!editingId && (
            <div className="min-w-[110px] flex-1">
              <label className="mb-[7px] block text-[13px] text-brand-muted2">จำนวนเริ่มต้น</label>
              <input
                value={form.stock}
                inputMode="numeric"
                onChange={(e) =>
                  setForm({ ...form, stock: e.target.value.replace(/[^0-9.]/g, "") })
                }
                placeholder="0"
                className="w-full rounded-xl border-[1.5px] border-[color:var(--c-border-strong)] bg-brand-cream px-3.5 py-3 text-[15px] text-brand-ink outline-none"
              />
            </div>
          )}
          <div className="min-w-[110px] flex-1">
            <label className="mb-[7px] block text-[13px] text-brand-muted2">เตือนเมื่อต่ำกว่า</label>
            <input
              value={form.lowThreshold}
              inputMode="numeric"
              onChange={(e) =>
                setForm({
                  ...form,
                  lowThreshold: e.target.value.replace(/[^0-9.]/g, ""),
                })
              }
              placeholder="0"
              className="w-full rounded-xl border-[1.5px] border-[color:var(--c-border-strong)] bg-brand-cream px-3.5 py-3 text-[15px] text-brand-ink outline-none"
            />
          </div>
          <button
            onClick={add}
            disabled={isPending}
            className="cursor-pointer rounded-[14px] bg-brand-primary px-7 py-3 text-[15px] font-semibold text-[color:var(--c-on-primary)] shadow-[0_3px_0_var(--c-primary-dark)] transition-transform active:translate-y-0.5 active:shadow-[0_1px_0_var(--c-primary-dark)] disabled:opacity-60"
          >
            {editingId ? "บันทึก" : "เพิ่ม"}
          </button>
          {editingId && (
            <button
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY);
              }}
              className="cursor-pointer rounded-[14px] border-[1.5px] border-[color:var(--c-border-strong)] bg-brand-card px-5 py-3 text-[15px] text-[color:var(--c-muted)]"
            >
              ยกเลิก
            </button>
          )}
        </div>
      </div>

      {/* รายการวัตถุดิบ */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3.5">
        {ingredients.map((i) => {
          const low = i.stock <= i.lowThreshold;
          const color = i.stock <= 0 ? "var(--c-orange)" : low ? "var(--c-warn-ink)" : "var(--c-lime-ink)";
          return (
            <div
              key={i.id}
              className="rounded-[18px] bg-[var(--c-surface)] p-4 shadow-[0_4px_14px_rgba(var(--c-sh),.06)]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 flex-none items-center justify-center rounded-[14px] bg-[var(--c-placeholder)] text-[24px]">
                  {i.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold text-brand-ink2">{i.name}</div>
                  <div className="text-xs text-brand-muted3">
                    เตือนเมื่อ &lt; {i.lowThreshold} {i.unit}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-itim text-[24px] leading-none" style={{ color }}>
                    {i.stock % 1 === 0 ? i.stock : i.stock.toFixed(1)}
                  </div>
                  <div className="text-[11px] text-brand-muted3">{i.unit}</div>
                </div>
              </div>

              {low && (
                <div className="mt-2 inline-block rounded-full bg-accent-orangeBg px-2.5 py-0.5 text-[11px] font-semibold text-accent-orange">
                  {i.stock <= 0 ? "หมด — ต้องสั่งเพิ่ม" : "ใกล้หมด"}
                </div>
              )}

              {/* เติม/ตัด */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <button onClick={() => adjust(i.id, -10)} className="rounded-lg border border-brand-border2 bg-brand-card px-2 py-1 text-xs text-brand-primary">−10</button>
                <button onClick={() => adjust(i.id, -1)} className="rounded-lg border border-brand-border2 bg-brand-card px-2 py-1 text-xs text-brand-primary">−1</button>
                <button onClick={() => adjust(i.id, 1)} className="rounded-lg border border-brand-border2 bg-brand-card px-2 py-1 text-xs text-brand-primary">+1</button>
                <button onClick={() => adjust(i.id, 10)} className="rounded-lg border border-brand-border2 bg-brand-card px-2 py-1 text-xs text-brand-primary">+10</button>
                <input
                  value={restock[i.id] ?? ""}
                  inputMode="numeric"
                  onChange={(e) =>
                    setRestock((r) => ({
                      ...r,
                      [i.id]: e.target.value.replace(/[^0-9.]/g, ""),
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyRestock(i.id);
                  }}
                  placeholder="เติม"
                  className="w-[64px] rounded-lg border border-brand-border2 bg-brand-cream px-2 py-1 text-xs text-brand-ink outline-none"
                />
                <button
                  onClick={() => applyRestock(i.id)}
                  className="rounded-lg bg-accent-green px-2.5 py-1 text-xs font-semibold text-white"
                >
                  เติม
                </button>
              </div>

              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => startEdit(i)}
                  className="cursor-pointer rounded-[10px] border-[1.5px] border-[color:var(--c-border-strong)] bg-brand-card px-3 py-[5px] text-xs text-brand-primary"
                >
                  แก้ไข
                </button>
                <button
                  onClick={() => remove(i.id)}
                  className="cursor-pointer rounded-[10px] border-[1.5px] border-accent-orangeBorder bg-accent-orangeBg px-3 py-[5px] text-xs text-accent-orange"
                >
                  ลบ
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
