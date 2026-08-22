"use client";

import { useEffect, useState } from "react";

type StockItem = {
  id: number;
  name: string;
  unit: string;
  emoji: string;
  stock: number;
  lowThreshold: number;
};

export default function StockClient() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "move" | "">("");
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);

  // form fields
  const [fName, setFName] = useState("");
  const [fUnit, setFUnit] = useState("");
  const [fEmoji, setFEmoji] = useState("📦");
  const [fStock, setFStock] = useState(0);
  const [fThreshold, setFThreshold] = useState(0);

  // move fields
  const [moveType, setMoveType] = useState<"in" | "out" | "adjust">("in");
  const [moveQty, setMoveQty] = useState(0);

  const THB = new Intl.NumberFormat("th-TH");

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    try {
      const res = await fetch("/api/stock");
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      setError("โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  const filtered = items.filter(
    (it) =>
      it.name.toLowerCase().includes(q.toLowerCase()) ||
      it.emoji.includes(q)
  );

  const lowCount = items.filter((it) => it.stock <= it.lowThreshold && it.lowThreshold > 0).length;

  // ---- Modal helpers ----
  function openAdd() {
    setModalMode("add");
    setFName("");
    setFUnit("");
    setFEmoji("📦");
    setFStock(0);
    setFThreshold(0);
    setModalOpen(true);
  }

  function openMove(item: StockItem) {
    setModalMode("move");
    setEditingItem(item);
    setMoveType("in");
    setMoveQty(0);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setModalMode("");
    setEditingItem(null);
  }

  async function saveAdd() {
    if (!fName.trim()) {
      setError("กรุณาใส่ชื่อวัตถุดิบ");
      return;
    }
    try {
      const res = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fName.trim(),
          unit: fUnit.trim() || "หน่วย",
          emoji: fEmoji || "📦",
          stock: fStock,
          lowThreshold: fThreshold,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "บันทึกไม่สำเร็จ");
        return;
      }
      await fetchItems();
      closeModal();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    }
  }

  async function saveMove() {
    if (!editingItem || moveQty < 0) return;
    if (moveType !== "adjust" && moveQty <= 0) {
      setError("กรุณากรอกจำนวนมากกว่า 0");
      return;
    }
    try {
      const res = await fetch("/api/stock/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingItem.id,
          type: moveType,
          qty: moveQty,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "บันทึกไม่สำเร็จ");
        return;
      }
      await fetchItems();
      closeModal();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    }
  }

  async function removeItem(id: number, name: string) {
    if (!confirm("ลบ \"" + name + "\" ?")) return;
    try {
      await fetch("/api/stock?id=" + id, { method: "DELETE" });
      await fetchItems();
    } catch {
      setError("ลบไม่สำเร็จ");
    }
  }

  // ---- Preview for move ----
  function movePreview() {
    if (!editingItem || moveQty <= 0) return "";
    let after = editingItem.stock;
    if (moveType === "in") after = editingItem.stock + moveQty;
    else if (moveType === "out") after = editingItem.stock - moveQty;
    else after = moveQty;
    const label = moveType === "adjust" ? "ตั้งเป็น" : "หลังทำรายการ";
    return label + ": " + THB.format(after) + " " + editingItem.unit + (after < 0 ? " ⚠️ ติดลบ!" : "");
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-3 text-brand-muted2">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-border border-t-brand-primary" />
          กำลังโหลด...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* KPI cards */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-brand-border bg-brand-card p-4">
          <div className="text-xs font-semibold text-brand-muted2">รายการทั้งหมด</div>
          <div className="mt-1 font-itim text-2xl text-brand-ink">{THB.format(items.length)}</div>
        </div>
        <div className="rounded-2xl border border-brand-border bg-brand-card p-4">
          <div className="text-xs font-semibold text-brand-muted2">หน่วยรวมในคลัง</div>
          <div className="mt-1 font-itim text-2xl text-brand-ink">
            {THB.format(items.reduce((s, i) => s + i.stock, 0))}
          </div>
        </div>
        <div className="rounded-2xl border border-brand-border bg-brand-card p-4">
          <div className="text-xs font-semibold text-brand-muted2">ใกล้หมดสต็อก</div>
          <div className="mt-1 font-itim text-2xl text-accent-orange">
            {THB.format(lowCount)}
            {lowCount > 0 && <span className="ml-1 text-xs font-semibold">⚠️</span>}
          </div>
        </div>
      </div>

      {/* Error toast */}
      {error && (
        <div className="mb-4 rounded-2xl border border-accent-orangeBorder bg-accent-orangeBg px-4 py-3 text-sm font-bold text-accent-orange">
          {error}
          <button className="ml-2 text-accent-orange/60 hover:text-accent-orange" onClick={() => setError("")}>
            ✕
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          className="h-10 w-72 max-w-full rounded-xl border border-brand-border bg-brand-card px-3 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          placeholder="🔍 ค้นหาวัตถุดิบ..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex-1" />
        <button
          className="flex h-10 items-center gap-2 rounded-xl bg-brand-primary px-4 text-sm font-bold text-white shadow-md hover:bg-brand-primaryDark"
          onClick={openAdd}
        >
          + เพิ่มวัตถุดิบ
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-brand-border bg-brand-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-border bg-brand-cream text-left text-xs font-semibold text-brand-muted2">
              <th className="px-4 py-3">วัตถุดิบ</th>
              <th className="px-4 py-3 text-center">คงเหลือ</th>
              <th className="px-4 py-3 text-center">หน่วย</th>
              <th className="px-4 py-3 text-center">จุดเตือน</th>
              <th className="px-4 py-3 text-center">สถานะ</th>
              <th className="px-4 py-3 text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-brand-muted">
                  {items.length === 0
                    ? "ยังไม่มีวัตถุดิบในคลัง — กด \"เพิ่มวัตถุดิบ\" เพื่อเริ่มต้น"
                    : "ไม่พบวัตถุดิบที่ค้นหา"}
                </td>
              </tr>
            )}
            {filtered.map((item) => {
              const isLow = item.lowThreshold > 0 && item.stock <= item.lowThreshold;
              return (
                <tr key={item.id} className="border-b border-brand-border last:border-b-0 hover:bg-brand-cream/50">
                  <td className="px-4 py-3">
                    <span className="mr-2 text-lg">{item.emoji}</span>
                    <span className="font-semibold text-brand-ink">{item.name}</span>
                  </td>
                  <td className={`px-4 py-3 text-center font-semibold tabular-nums ${isLow ? "text-accent-orange" : "text-brand-ink"}`}>
                    {THB.format(item.stock)}
                  </td>
                  <td className="px-4 py-3 text-center text-brand-muted">{item.unit}</td>
                  <td className="px-4 py-3 text-center text-brand-muted">
                    {item.lowThreshold > 0 ? THB.format(item.lowThreshold) : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isLow ? (
                      <span className="inline-block rounded-full bg-accent-orangeBg px-3 py-1 text-xs font-bold text-accent-orange">
                        ⚠️ ใกล้หมด
                      </span>
                    ) : (
                      <span className="inline-block rounded-full bg-accent-greenBg px-3 py-1 text-xs font-bold text-accent-greenText">
                        ✓ ปกติ
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        className="rounded-lg bg-accent-greenBg px-3 py-1.5 text-xs font-bold text-accent-greenText hover:bg-accent-green/20"
                        onClick={() => openMove(item)}
                      >
                        ปรับสต็อก
                      </button>
                      <button
                        className="rounded-lg bg-accent-orangeBg px-3 py-1.5 text-xs font-bold text-accent-orange hover:bg-accent-orange/20"
                        onClick={() => removeItem(item.id, item.name)}
                      >
                        ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={closeModal}>
          <div
            className="w-full max-w-md rounded-2xl bg-brand-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-brand-ink">
                {modalMode === "add" ? "เพิ่มวัตถุดิบ" : "ปรับสต็อก — " + editingItem?.name}
              </h2>
              <button className="text-brand-muted hover:text-brand-ink" onClick={closeModal}>
                ✕
              </button>
            </div>

            {modalMode === "add" && (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-brand-muted2">ชื่อวัตถุดิบ *</label>
                  <input
                    className="h-10 w-full rounded-xl border border-brand-border bg-brand-bg px-3 text-sm outline-none focus:border-brand-primary"
                    placeholder="เช่น นมสด, กาแฟ, แก้ว"
                    value={fName}
                    onChange={(e) => setFName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-brand-muted2">หน่วยนับ</label>
                    <input
                      className="h-10 w-full rounded-xl border border-brand-border bg-brand-bg px-3 text-sm outline-none focus:border-brand-primary"
                      placeholder="กรัม / มล. / ชิ้น"
                      value={fUnit}
                      onChange={(e) => setFUnit(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-brand-muted2">ไอคอน</label>
                    <input
                      className="h-10 w-full rounded-xl border border-brand-border bg-brand-bg px-3 text-sm outline-none focus:border-brand-primary"
                      placeholder="📦"
                      value={fEmoji}
                      onChange={(e) => setFEmoji(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-brand-muted2">จำนวนเริ่มต้น</label>
                    <input
                      className="h-10 w-full rounded-xl border border-brand-border bg-brand-bg px-3 text-sm outline-none focus:border-brand-primary"
                      type="number"
                      min={0}
                      value={fStock}
                      onChange={(e) => setFStock(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-brand-muted2">จุดเตือนใกล้หมด</label>
                    <input
                      className="h-10 w-full rounded-xl border border-brand-border bg-brand-bg px-3 text-sm outline-none focus:border-brand-primary"
                      type="number"
                      min={0}
                      value={fThreshold}
                      onChange={(e) => setFThreshold(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-3">
                  <button className="rounded-xl border border-brand-border bg-brand-bg px-4 py-2 text-sm font-semibold text-brand-muted hover:bg-brand-cream" onClick={closeModal}>
                    ยกเลิก
                  </button>
                  <button className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-white hover:bg-brand-primaryDark" onClick={saveAdd}>
                    บันทึก
                  </button>
                </div>
              </div>
            )}

            {modalMode === "move" && editingItem && (
              <div className="space-y-4">
                <div className="rounded-xl bg-brand-bg p-3 text-center">
                  <span className="text-xs text-brand-muted2">จำนวนปัจจุบัน</span>
                  <div className="font-itim text-2xl text-brand-ink">
                    {THB.format(editingItem.stock)} <span className="text-sm text-brand-muted">{editingItem.unit}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(["in", "out", "adjust"] as const).map((t) => (
                    <button
                      key={t}
                      className={`rounded-xl border py-2 text-center text-sm font-semibold transition-colors ${
                        moveType === t
                          ? t === "in"
                            ? "border-accent-green bg-accent-greenBg text-accent-greenText"
                            : t === "out"
                              ? "border-accent-orange bg-accent-orangeBg text-accent-orange"
                              : "border-brand-tan bg-brand-chip text-brand-ink"
                          : "border-brand-border bg-brand-bg text-brand-muted hover:border-brand-muted"
                      }`}
                      onClick={() => setMoveType(t)}
                    >
                      <div>{t === "in" ? "รับเข้า" : t === "out" ? "เบิกออก" : "ปรับยอด"}</div>
                      <div className="text-[10px] opacity-60">
                        {t === "in" ? "+ เพิ่มสต็อก" : t === "out" ? "− ลดสต็อก" : "ตั้งค่าใหม่"}
                      </div>
                    </button>
                  ))}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-brand-muted2">
                    {moveType === "adjust" ? "ตั้งจำนวนใหม่" : "จำนวนที่" + (moveType === "in" ? "รับเข้า" : "เบิกออก")} *
                  </label>
                  <input
                    className="h-10 w-full rounded-xl border border-brand-border bg-brand-bg px-3 text-sm outline-none focus:border-brand-primary"
                    type="number"
                    min={0}
                    value={moveQty || ""}
                    onChange={(e) => setMoveQty(Number(e.target.value))}
                    autoFocus
                  />
                </div>

                {movePreview() && (
                  <div className="rounded-lg bg-brand-bg px-3 py-2 text-xs text-brand-muted2">
                    {movePreview()}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button className="rounded-xl border border-brand-border bg-brand-bg px-4 py-2 text-sm font-semibold text-brand-muted hover:bg-brand-cream" onClick={closeModal}>
                    ยกเลิก
                  </button>
                  <button className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-white hover:bg-brand-primaryDark" onClick={saveMove}>
                    บันทึกรายการ
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
