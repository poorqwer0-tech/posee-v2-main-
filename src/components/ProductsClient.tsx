"use client";

import { useState, useTransition } from "react";
import type { Ingredient } from "@/db/schema";
import type { PosProduct } from "@/lib/queries";
import {
  createProduct,
  updateProduct,
  toggleProduct,
  type ProductInput,
  type RecipeInput,
  type OptionInput,
} from "@/lib/actions";
import { getMenuOptionGroups, optionHelperText } from "@/lib/menu-options";
import { resizeImageToDataUrl } from "@/lib/image";
import {
  EMOJI_CHOICES,
  FORM_CATEGORIES,
  baht,
  categoriesFromProducts,
  DEFAULT_CATEGORY_EMOJI,
} from "@/lib/utils";
import { useToast } from "./Toast";

type FormState = {
  name: string;
  category: string;
  price: string;
  image: string;
  photo: string | null; // data URI / path รูป (null = ไม่มีรูป)
  recipe: Record<number, string>; // ingredientId -> qty (string)
  options: OptionInput[];
};

const EMPTY_FORM: FormState = {
  name: "",
  category: "กาแฟ",
  price: "",
  image: "☕",
  photo: null,
  recipe: {},
  options: [],
};

type GroupMode = "req1" | "opt1" | "multi";
function modeOf(g: OptionInput): GroupMode {
  if (g.min >= 1 && g.max <= 1) return "req1";
  if (g.min === 0 && g.max === 1) return "opt1";
  return "multi";
}
const MODE_MINMAX: Record<GroupMode, { min: number; max: number }> = {
  req1: { min: 1, max: 1 },
  opt1: { min: 0, max: 1 },
  multi: { min: 0, max: 99 },
};
const MODE_LABEL: Record<GroupMode, string> = {
  req1: "ต้องเลือก 1 อย่าง",
  opt1: "เลือกได้ 1 (ไม่บังคับ)",
  multi: "เลือกได้หลายอย่าง",
};

/** ป้ายความพร้อมขายจากวัตถุดิบ */
function makeableBadge(makeable: number | null) {
  if (makeable === null)
    return { label: "ยังไม่ตั้งสูตร", cls: "bg-brand-chip text-brand-muted2" };
  if (makeable <= 0)
    return { label: "วัตถุดิบหมด", cls: "bg-accent-orangeBg text-accent-orange" };
  if (makeable <= 10)
    return { label: `ทำได้อีก ${makeable}`, cls: "bg-[var(--c-warn-soft)] text-[color:var(--c-warn-ink)]" };
  return { label: `ทำได้อีก ${makeable}`, cls: "bg-accent-greenBg text-accent-greenText" };
}

export function ProductsClient({
  products,
  ingredients,
}: {
  products: PosProduct[];
  ingredients: Ingredient[];
}) {
  const flash = useToast();
  const [cat, setCat] = useState("ทั้งหมด");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isPending, startTransition] = useTransition();

  const list = products.filter((p) => cat === "ทั้งหมด" || p.category === cat);
  // ปุ่มลัดหมวด = หมวดแนะนำ + หมวดที่ร้านสร้างไว้แล้ว (ไม่ซ้ำ)
  const categoryChoices = Array.from(
    new Set([...FORM_CATEGORIES, ...products.map((p) => p.category).filter(Boolean)]),
  );
  // แถบกรองหมวด: "ทั้งหมด" + หมวดที่มีสินค้าจริง
  const filterCategories = [
    { key: "ทั้งหมด", emoji: DEFAULT_CATEGORY_EMOJI },
    ...categoriesFromProducts(products),
  ];

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(p: PosProduct) {
    setEditingId(p.id);
    const recipe: Record<number, string> = {};
    for (const r of p.recipe) recipe[r.ingredientId] = String(r.qty);
    // โหลดตัวเลือกที่ใช้อยู่ (ที่ตั้งเอง หรือค่าเริ่มต้นตามหมวด) มาให้แก้ไข
    const options: OptionInput[] = getMenuOptionGroups(p).map((g) => ({
      title: g.title,
      min: g.min,
      max: g.max,
      options: g.options.map((o) => ({ label: o.label, price: o.price })),
    }));
    setForm({
      name: p.name,
      category: p.category,
      price: String(p.price),
      image: p.image,
      photo: p.photo,
      recipe,
      options,
    });
    setShowForm(true);
  }

  // ---------- อัปโหลด/ลบรูปเมนู ----------
  async function onPickPhoto(file: File | undefined) {
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) {
      flash("ไฟล์ใหญ่เกินไป (เกิน 12MB)");
      return;
    }
    try {
      const dataUrl = await resizeImageToDataUrl(file, 500, 0.8);
      setForm((f) => ({ ...f, photo: dataUrl }));
    } catch {
      flash("อ่านรูปไม่สำเร็จ ลองรูปอื่นนะ");
    }
  }

  // ---------- แก้ไขตัวเลือกเมนู ----------
  function updateGroups(fn: (groups: OptionInput[]) => OptionInput[]) {
    setForm((f) => ({ ...f, options: fn(f.options) }));
  }
  function addGroup() {
    updateGroups((g) => [
      ...g,
      { title: "", min: 1, max: 1, options: [{ label: "", price: 0 }] },
    ]);
  }
  function removeGroup(gi: number) {
    updateGroups((g) => g.filter((_, i) => i !== gi));
  }
  function setGroupTitle(gi: number, title: string) {
    updateGroups((g) => g.map((grp, i) => (i === gi ? { ...grp, title } : grp)));
  }
  function setGroupMode(gi: number, mode: GroupMode) {
    updateGroups((g) =>
      g.map((grp, i) => (i === gi ? { ...grp, ...MODE_MINMAX[mode] } : grp)),
    );
  }
  function addOption(gi: number) {
    updateGroups((g) =>
      g.map((grp, i) =>
        i === gi ? { ...grp, options: [...grp.options, { label: "", price: 0 }] } : grp,
      ),
    );
  }
  function removeOption(gi: number, oi: number) {
    updateGroups((g) =>
      g.map((grp, i) =>
        i === gi
          ? { ...grp, options: grp.options.filter((_, j) => j !== oi) }
          : grp,
      ),
    );
  }
  function setOptionField(gi: number, oi: number, field: "label" | "price", value: string) {
    updateGroups((g) =>
      g.map((grp, i) =>
        i === gi
          ? {
              ...grp,
              options: grp.options.map((o, j) =>
                j === oi
                  ? {
                      ...o,
                      [field]:
                        field === "price" ? Number(value.replace(/[^0-9]/g, "")) || 0 : value,
                    }
                  : o,
              ),
            }
          : grp,
      ),
    );
  }

  function handleToggle(p: PosProduct) {
    startTransition(async () => {
      await toggleProduct(p.id, !p.isActive);
    });
  }

  function setRecipeQty(ingredientId: number, value: string) {
    setForm((f) => ({
      ...f,
      recipe: { ...f.recipe, [ingredientId]: value.replace(/[^0-9.]/g, "") },
    }));
  }

  function saveForm() {
    if (!form.name.trim() || !form.price) {
      flash("ใส่ชื่อเมนูและราคาก่อนนะ");
      return;
    }
    const input: ProductInput = {
      name: form.name,
      category: form.category,
      price: Number(form.price) || 0,
      image: form.image,
      photo: form.photo, // string=รูปใหม่, null=เอาออก
    };
    const recipe: RecipeInput = Object.entries(form.recipe)
      .map(([id, qty]) => ({ ingredientId: Number(id), qty: Number(qty) || 0 }))
      .filter((r) => r.qty > 0);
    startTransition(async () => {
      const res = editingId
        ? await updateProduct(editingId, input, recipe, form.options)
        : await createProduct(input, recipe, form.options);
      if (!res.ok) {
        flash(res.error ?? "เกิดข้อผิดพลาด");
        return;
      }
      setShowForm(false);
      flash(editingId ? "แก้ไขเมนูแล้ว ✓" : "เพิ่มเมนูใหม่แล้ว 🎉");
    });
  }

  const notMakeable = products.filter((p) => p.makeable !== null && p.makeable <= 0).length;
  const lowMakeable = products.filter((p) => p.makeable !== null && p.makeable > 0 && p.makeable <= 10).length;

  return (
    <div className="flex-1 animate-fadeUp overflow-auto px-4 sm:px-[26px] pb-[30px] pt-5">
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-[9px]">
          {filterCategories.map((c) => {
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
                <span className="text-[15px]">{c.emoji}</span>
                {c.key}
              </button>
            );
          })}
        </div>
        <button
          onClick={openAdd}
          className="flex cursor-pointer items-center gap-[7px] rounded-[14px] bg-brand-primary px-[18px] py-[11px] text-[15px] font-semibold text-[color:var(--c-on-primary)] shadow-[0_3px_0_var(--c-primary-dark)] transition-transform active:translate-y-0.5 active:shadow-[0_1px_0_var(--c-primary-dark)]"
        >
          <span className="text-[18px]">＋</span> เพิ่มเมนูใหม่
        </button>
      </div>

      {(notMakeable > 0 || lowMakeable > 0) && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[14px] border border-[color:var(--c-warn-border)] bg-[var(--c-surface-2)] px-4 py-3 text-sm">
          <span className="text-[18px]">📦</span>
          <span className="text-brand-muted">ความพร้อมขายจากวัตถุดิบ:</span>
          {notMakeable > 0 && (
            <span className="rounded-full bg-accent-orangeBg px-3 py-1 font-semibold text-accent-orange">
              ทำไม่ได้ {notMakeable} เมนู
            </span>
          )}
          {lowMakeable > 0 && (
            <span className="rounded-full bg-[var(--c-warn-soft)] px-3 py-1 font-semibold text-[color:var(--c-warn-ink)]">
              ใกล้หมด {lowMakeable} เมนู
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3.5">
        {list.map((p) => {
          const badge = makeableBadge(p.makeable);
          return (
            <div
              key={p.id}
              className="flex gap-3.5 rounded-[18px] bg-[var(--c-surface)] p-4 shadow-[0_4px_14px_rgba(var(--c-sh),.06)] transition-opacity"
              style={{ opacity: p.isActive ? 1 : 0.55 }}
            >
              <div className="flex h-[54px] w-[54px] flex-none items-center justify-center overflow-hidden rounded-[14px] bg-[var(--c-placeholder)] text-[28px]">
                {p.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photo} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  p.image
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold leading-tight text-brand-ink2">
                  {p.name}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-[9px] bg-brand-chip px-2 py-0.5 text-[11px] text-brand-muted2">
                    {p.category}
                  </span>
                  <span className="font-itim text-base text-brand-primary">
                    {baht(p.price)}
                  </span>
                  <span className={`rounded-[9px] px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>
                {/* สูตร */}
                <div className="mt-1.5 text-[11px] leading-snug text-brand-muted3">
                  {p.recipe.length
                    ? "สูตร: " +
                      p.recipe.map((r) => `${r.name} ${r.qty}${r.unit}`).join(" · ")
                    : "ยังไม่ตั้งสูตร — กด “แก้ไข” เพื่อเลือกวัตถุดิบ"}
                </div>
                <div className="mt-2.5 flex items-center gap-2.5">
                  <button
                    onClick={() => handleToggle(p)}
                    className="flex w-[42px] cursor-pointer rounded-[14px] p-[3px] transition-all"
                    style={{
                      justifyContent: p.isActive ? "flex-end" : "flex-start",
                      background: p.isActive ? "var(--c-lime)" : "var(--c-divider)",
                    }}
                    aria-label={p.isActive ? "ปิดการขาย" : "เปิดการขาย"}
                  >
                    <span className="block h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.3)]" />
                  </button>
                  <span className="text-xs text-brand-muted3">
                    {p.isActive ? "เปิดขาย" : "ปิดอยู่"}
                  </span>
                  <button
                    onClick={() => openEdit(p)}
                    className="ml-auto cursor-pointer rounded-[10px] border-[1.5px] border-[color:var(--c-border-strong)] bg-brand-card px-3 py-[5px] text-xs text-brand-primary"
                  >
                    แก้ไข
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== MODAL ฟอร์มเมนู + สูตร ===== */}
      {showForm && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-[rgba(var(--c-scrim),.42)] p-5">
          <div className="flex max-h-[88vh] w-full max-w-[460px] flex-col animate-pop rounded-[26px] bg-[var(--c-surface)] shadow-[0_24px_60px_rgba(var(--c-scrim),.3)]">
            <div className="px-7 pt-7 font-itim text-[22px] text-brand-ink">
              {editingId ? "แก้ไขเมนู" : "เพิ่มเมนูใหม่"}
            </div>
            <div className="flex-1 overflow-auto px-7 py-4">
              <div className="flex flex-col gap-4">
                <div>
                  <label className="mb-[7px] block text-[13px] text-brand-muted2">ชื่อเมนู</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-xl border-[1.5px] border-[color:var(--c-border-strong)] bg-brand-cream px-3.5 py-[11px] text-[15px] text-brand-ink outline-none"
                  />
                </div>
                <div>
                  <label className="mb-[7px] block text-[13px] text-brand-muted2">ราคา (บาท)</label>
                  <input
                    value={form.price}
                    inputMode="numeric"
                    onChange={(e) =>
                      setForm({ ...form, price: e.target.value.replace(/[^0-9]/g, "") })
                    }
                    className="w-full rounded-xl border-[1.5px] border-[color:var(--c-border-strong)] bg-brand-cream px-3.5 py-[11px] text-[15px] text-brand-ink outline-none"
                  />
                </div>
                <div>
                  <label className="mb-[7px] block text-[13px] text-brand-muted2">หมวดหมู่</label>
                  <div className="flex flex-wrap gap-2">
                    {categoryChoices.map((c) => (
                      <button
                        key={c}
                        onClick={() => setForm({ ...form, category: c })}
                        className={[
                          "cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold transition-all",
                          form.category === c
                            ? "bg-brand-primary text-white"
                            : "bg-brand-chip text-[color:var(--c-muted)]",
                        ].join(" ")}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  {/* white-label: พิมพ์หมวดใหม่เองได้ (ไม่จำกัดตายตัว) */}
                  <input
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="หรือพิมพ์หมวดใหม่ เช่น เบเกอรี่, ของหวาน"
                    className="mt-2 w-full rounded-xl border-[1.5px] border-[color:var(--c-border-strong)] bg-brand-cream px-3.5 py-2.5 text-[14px] text-brand-ink outline-none focus:border-brand-primary"
                  />
                </div>
                <div>
                  <label className="mb-[7px] block text-[13px] text-brand-muted2">รูปเมนู</label>
                  <div className="flex items-center gap-3">
                    <div className="flex h-[72px] w-[72px] flex-none items-center justify-center overflow-hidden rounded-2xl border-2 border-brand-border2 bg-brand-cream text-[32px]">
                      {form.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={form.photo} alt="รูปเมนู" className="h-full w-full object-cover" />
                      ) : (
                        form.image
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="cursor-pointer rounded-xl bg-brand-primary px-4 py-2 text-[13px] font-semibold text-[color:var(--c-on-primary)]">
                        📷 {form.photo ? "เปลี่ยนรูป" : "อัปโหลดรูป"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => onPickPhoto(e.target.files?.[0])}
                        />
                      </label>
                      {form.photo && (
                        <button
                          onClick={() => setForm({ ...form, photo: null })}
                          className="rounded-xl border border-accent-orangeBorder bg-accent-orangeBg px-4 py-1.5 text-[12px] font-semibold text-accent-orange"
                        >
                          ลบรูป
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="mb-[7px] block text-[13px] text-brand-muted2">ไอคอน (สำรองเมื่อไม่มีรูป)</label>
                  <div className="flex flex-wrap gap-2">
                    {EMOJI_CHOICES.map((e) => (
                      <button
                        key={e}
                        onClick={() => setForm({ ...form, image: e })}
                        className={[
                          "h-11 w-11 cursor-pointer rounded-xl border-2 text-[22px]",
                          form.image === e
                            ? "border-brand-primary bg-[var(--c-selected)]"
                            : "border-[color:var(--c-border)] bg-brand-card",
                        ].join(" ")}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>

                {/* สูตร: วัตถุดิบที่ใช้ */}
                <div>
                  <label className="mb-[7px] block text-[13px] text-brand-muted2">
                    สูตร — วัตถุดิบที่ใช้ต่อ 1 หน่วย (ใส่ 0 = ไม่ใช้)
                  </label>
                  {ingredients.length === 0 ? (
                    <div className="rounded-xl bg-brand-cream px-3.5 py-3 text-[13px] text-brand-muted3">
                      ยังไม่มีวัตถุดิบ — เพิ่มได้ที่หน้า “วัตถุดิบ”
                    </div>
                  ) : (
                    <div className="flex max-h-[210px] flex-col gap-1.5 overflow-auto rounded-xl border border-brand-border2 bg-brand-cream p-2">
                      {ingredients.map((ing) => (
                        <div key={ing.id} className="flex items-center gap-2">
                          <span className="text-[18px]">{ing.emoji}</span>
                          <span className="min-w-0 flex-1 truncate text-[13px] text-brand-ink2">
                            {ing.name}
                          </span>
                          <input
                            value={form.recipe[ing.id] ?? ""}
                            inputMode="numeric"
                            onChange={(e) => setRecipeQty(ing.id, e.target.value)}
                            placeholder="0"
                            className="w-[64px] rounded-lg border border-[color:var(--c-border-strong)] bg-brand-card px-2 py-1.5 text-center text-[13px] text-brand-ink outline-none"
                          />
                          <span className="w-[34px] text-[11px] text-brand-muted3">{ing.unit}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ===== ตัวเลือกเมนู (ลูกค้าเลือกตอนสั่ง) ===== */}
                <div>
                  <label className="mb-[7px] block text-[13px] text-brand-muted2">
                    ตัวเลือกเมนู — ตั้งค่าเฉพาะเมนูนี้ (เช่น ประเภท / ขนาด / เพิ่มไข่)
                  </label>
                  <div className="flex flex-col gap-3">
                    {form.options.map((g, gi) => (
                      <div
                        key={gi}
                        className="rounded-xl border border-brand-border2 bg-brand-cream p-3"
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <input
                            value={g.title}
                            onChange={(e) => setGroupTitle(gi, e.target.value)}
                            placeholder="ชื่อกลุ่ม เช่น ขนาด / ประเภท"
                            className="min-w-0 flex-1 rounded-lg border border-[color:var(--c-border-strong)] bg-brand-card px-2.5 py-1.5 text-[13px] font-semibold text-brand-ink outline-none"
                          />
                          <button
                            onClick={() => removeGroup(gi)}
                            className="rounded-lg border border-accent-orange bg-brand-card px-2 py-1.5 text-[12px] font-bold text-accent-orange"
                          >
                            ลบกลุ่ม
                          </button>
                        </div>
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {(["req1", "opt1", "multi"] as GroupMode[]).map((m) => (
                            <button
                              key={m}
                              onClick={() => setGroupMode(gi, m)}
                              className={[
                                "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                                modeOf(g) === m
                                  ? "bg-brand-primary text-white"
                                  : "bg-brand-card text-brand-muted border border-[color:var(--c-border-strong)]",
                              ].join(" ")}
                            >
                              {MODE_LABEL[m]}
                            </button>
                          ))}
                          <span className="ml-auto self-center text-[11px] text-brand-muted3">
                            {optionHelperText(g.min, g.max)}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {g.options.map((o, oi) => (
                            <div key={oi} className="flex items-center gap-1.5">
                              <input
                                value={o.label}
                                onChange={(e) => setOptionField(gi, oi, "label", e.target.value)}
                                placeholder="ชื่อตัวเลือก"
                                className="min-w-0 flex-1 rounded-lg border border-[color:var(--c-border-strong)] bg-brand-card px-2.5 py-1.5 text-[13px] text-brand-ink outline-none"
                              />
                              <span className="text-[12px] text-brand-muted3">+฿</span>
                              <input
                                value={o.price ? String(o.price) : ""}
                                inputMode="numeric"
                                onChange={(e) => setOptionField(gi, oi, "price", e.target.value)}
                                placeholder="0"
                                className="w-[58px] rounded-lg border border-[color:var(--c-border-strong)] bg-brand-card px-2 py-1.5 text-center text-[13px] text-brand-ink outline-none"
                              />
                              <button
                                onClick={() => removeOption(gi, oi)}
                                className="h-7 w-7 flex-none rounded-lg border border-[color:var(--c-border-strong)] bg-brand-card text-[16px] leading-none text-brand-muted"
                                aria-label="ลบตัวเลือก"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => addOption(gi)}
                          className="mt-2 rounded-lg border border-dashed border-[color:var(--c-tan)] bg-brand-card px-3 py-1.5 text-[12px] font-semibold text-brand-primary"
                        >
                          ＋ เพิ่มตัวเลือก
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={addGroup}
                      className="rounded-xl border-[1.5px] border-dashed border-brand-primary bg-brand-card px-3 py-2.5 text-[13px] font-semibold text-brand-primary"
                    >
                      ＋ เพิ่มกลุ่มตัวเลือก
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-7 pb-7 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 cursor-pointer rounded-[15px] border-[1.5px] border-[color:var(--c-border-strong)] bg-brand-card p-3 text-base text-[color:var(--c-muted)]"
              >
                ยกเลิก
              </button>
              <button
                onClick={saveForm}
                disabled={isPending}
                className="flex-[1.4] cursor-pointer rounded-[15px] bg-brand-primary p-3 font-itim text-[18px] text-[color:var(--c-on-primary)] shadow-[0_4px_0_var(--c-primary-dark)] transition-transform active:translate-y-0.5 active:shadow-[0_2px_0_var(--c-primary-dark)] disabled:opacity-60"
              >
                บันทึกเมนู
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
