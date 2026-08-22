"use client";

import { useEffect, useState, useTransition } from "react";
import {
  createStaff,
  createTable,
  deleteStaff,
  deleteTable,
  removeStaffLogin,
  renameTable,
  setStaffAccess,
  setTableAutoOpen,
  setStaffLogin,
  toggleStaff,
  toggleTable,
  updateSettings,
  type SettingsInput,
} from "@/lib/actions";
import { tableOrderLink } from "@/lib/utils";
import { QrImage } from "@/components/QrImage";
import { primaryOverride } from "@/lib/theme";
import { useToast } from "./Toast";

const STAFF_EMOJI = ["🌸", "🧋", "☕", "🧑", "👩", "👨", "🐱", "⭐", "🍰", "🥐"];

type TableRow = { id: number; name: string; qrToken: string; isActive: boolean };
type StaffRow = {
  id: number;
  name: string;
  emoji: string;
  color: string;
  isActive: boolean;
  username: string | null;
  role: "admin" | "staff";
  hasLogin: boolean;
};
type LoginDraft = { username: string; password: string; role: "admin" | "staff" };

export function SettingsClient({
  initial,
  staff,
  tables,
  staffAccess,
  accessOverridden = false,
  tableAutoOpen = false,
  lanUrl,
}: {
  initial: SettingsInput;
  staff: StaffRow[];
  tables: TableRow[];
  staffAccess: "lan-only" | "public";
  accessOverridden?: boolean;
  tableAutoOpen?: boolean;
  lanUrl: string | null;
}) {
  const flash = useToast();
  const [form, setForm] = useState<SettingsInput>(initial);
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"lan-only" | "public">(staffAccess);
  const [autoOpen, setAutoOpen] = useState(tableAutoOpen);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("🌸");
  const [newTable, setNewTable] = useState("");
  const [qrTable, setQrTable] = useState<TableRow | null>(null);
  const [origin, setOrigin] = useState("");
  // แก้บัญชีล็อกอินของพนักงาน (id → draft)
  const [loginEdit, setLoginEdit] = useState<{ id: number; draft: LoginDraft } | null>(null);

  useEffect(() => setOrigin(window.location.origin), []);

  // ---------- บัญชีล็อกอินพนักงาน ----------
  function openLogin(s: StaffRow) {
    setLoginEdit({
      id: s.id,
      draft: { username: s.username ?? "", password: "", role: s.role },
    });
  }
  function saveLogin() {
    if (!loginEdit) return;
    const { id, draft } = loginEdit;
    startTransition(async () => {
      const res = await setStaffLogin(id, draft);
      if (!res.ok) return flash(res.error ?? "บันทึกไม่สำเร็จ");
      setLoginEdit(null);
      flash("ตั้งบัญชีล็อกอินแล้ว ✓");
    });
  }
  function onRemoveLogin(s: StaffRow) {
    startTransition(async () => {
      const res = await removeStaffLogin(s.id);
      if (!res.ok) return flash(res.error ?? "ยกเลิกไม่สำเร็จ");
      setLoginEdit(null);
      flash("ยกเลิกบัญชีล็อกอินแล้ว");
    });
  }

  // ---------- โต๊ะ ----------
  function addTable() {
    const name = newTable.trim() || `โต๊ะ ${tables.length + 1}`;
    startTransition(async () => {
      const res = await createTable(name);
      if (!res.ok) return flash(res.error ?? "เพิ่มโต๊ะไม่สำเร็จ");
      setNewTable("");
      flash("เพิ่มโต๊ะแล้ว 🎉");
    });
  }
  function onRenameTable(t: TableRow) {
    const name = prompt("เปลี่ยนชื่อโต๊ะ", t.name);
    if (name == null) return;
    startTransition(async () => {
      const res = await renameTable(t.id, name);
      if (!res.ok) flash(res.error ?? "เปลี่ยนชื่อไม่สำเร็จ");
    });
  }
  function onToggleTable(t: TableRow) {
    startTransition(async () => {
      await toggleTable(t.id, !t.isActive);
    });
  }
  function onDeleteTable(t: TableRow) {
    startTransition(async () => {
      const res = await deleteTable(t.id);
      if (!res.ok) return flash(res.error ?? "ลบไม่สำเร็จ");
      flash("ลบโต๊ะแล้ว");
    });
  }

  function save() {
    startTransition(async () => {
      await updateSettings(form);
      flash("บันทึกการตั้งค่าแล้ว ✓");
    });
  }

  function addStaff() {
    if (!newName.trim()) {
      flash("ใส่ชื่อพนักงานก่อนนะ");
      return;
    }
    startTransition(async () => {
      const res = await createStaff(newName, newEmoji);
      if (!res.ok) {
        flash(res.error ?? "เกิดข้อผิดพลาด");
        return;
      }
      setNewName("");
      flash("เพิ่มพนักงานแล้ว 🎉");
    });
  }

  function onToggleStaff(s: StaffRow) {
    startTransition(async () => {
      await toggleStaff(s.id, !s.isActive);
    });
  }

  function onDeleteStaff(s: StaffRow) {
    startTransition(async () => {
      await deleteStaff(s.id);
      flash("ลบพนักงานแล้ว");
    });
  }

  function changeMode(next: "lan-only" | "public") {
    if (next === mode || isPending) return;
    const prev = mode;
    setMode(next);
    startTransition(async () => {
      const res = await setStaffAccess(next);
      if (!res.ok) {
        setMode(prev);
        flash(res.error ?? "เปลี่ยนโหมดไม่สำเร็จ");
        return;
      }
      flash(next === "public" ? "เปิดโหมดสาธารณะแล้ว ⚠️" : "โหมดเฉพาะ Wi-Fi ร้านแล้ว ✓");
    });
  }

  function changeAutoOpen(next: boolean) {
    if (next === autoOpen || isPending) return;
    setAutoOpen(next);
    startTransition(async () => {
      const res = await setTableAutoOpen(next);
      if (!res.ok) {
        setAutoOpen(!next);
        flash(res.error ?? "เปลี่ยนโหมดไม่สำเร็จ");
        return;
      }
      flash(next ? "สแกนแล้วสั่งได้เลย ✓" : "โหมดขออนุมัติเปิดโต๊ะ ✓");
    });
  }

  return (
    <div className="flex-1 animate-fadeUp overflow-auto px-4 sm:px-[26px] pb-[30px] pt-5">
      {/* ===== การเข้าถึงหน้าจัดการ (Wi-Fi ร้าน vs สาธารณะ) + QR ===== */}
      <div className="mb-4 max-w-[920px] rounded-[20px] bg-[var(--c-surface)] p-[26px] shadow-[0_6px_18px_rgba(var(--c-sh),.06)]">
        <div className="font-itim text-[20px] text-brand-ink">การเข้าถึงหน้าจัดการ 🔐</div>
        <p className="mb-4 mt-0.5 text-[13px] text-brand-muted2">
          พนักงานเข้าหน้าขาย/ครัว/โต๊ะ ได้จากที่ไหนบ้าง (หน้าลูกค้าสั่งอาหารเปิดสาธารณะเสมอ)
        </p>
        {accessOverridden && (
          <div className="mb-4 rounded-2xl bg-[var(--c-surface-2)] px-4 py-3 text-[12px] font-semibold leading-relaxed text-brand-muted2">
            ℹ️ ระบบนี้รันบนคลาวด์ (ไม่มี Wi-Fi ร้าน) — ใช้โหมด <b>สาธารณะ</b> อัตโนมัติ
            ตัวเลือกด้านล่างจะมีผลเมื่อย้ายไปรันในเครื่องที่ร้าน (local)
          </div>
        )}
        <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="flex gap-2">
              <button
                onClick={() => changeMode("lan-only")}
                className={[
                  "flex-1 rounded-2xl border-2 px-4 py-3 text-left text-sm font-bold transition-all",
                  mode === "lan-only"
                    ? "border-accent-green bg-accent-green text-white shadow-[0_3px_0_var(--c-lime-ink)]"
                    : "border-[color:var(--c-border-strong)] bg-brand-card text-brand-muted",
                ].join(" ")}
              >
                📶 เฉพาะ Wi-Fi ร้าน
                <span className="ml-1 text-[11px] font-semibold opacity-80">(แนะนำ)</span>
              </button>
              <button
                onClick={() => changeMode("public")}
                className={[
                  "flex-1 rounded-2xl border-2 px-4 py-3 text-left text-sm font-bold transition-all",
                  mode === "public"
                    ? "border-accent-orange bg-accent-orange text-white shadow-[0_3px_0_var(--c-primary-dark)]"
                    : "border-[color:var(--c-border-strong)] bg-brand-card text-brand-muted",
                ].join(" ")}
              >
                🌐 สาธารณะ
                <span className="ml-1 text-[11px] font-semibold opacity-80">(เข้าจากเน็ตได้)</span>
              </button>
            </div>
            {mode === "public" ? (
              <div className="mt-3 rounded-2xl bg-accent-orangeBg px-4 py-3 text-[12px] font-semibold leading-relaxed text-accent-orange">
                ⚠️ หน้าจัดการเข้าถึงได้จากอินเทอร์เน็ต (ยังต้องล็อกอิน) —
                <b> ตั้งรหัสผ่านให้แข็งแรงก่อนเปิดโหมดนี้</b> เพื่อกันคนเดารหัส
              </div>
            ) : (
              <div className="mt-3 rounded-2xl bg-[var(--c-surface-2)] px-4 py-3 text-[12px] font-semibold leading-relaxed text-brand-muted2">
                🔒 ปลอดภัยสุด — เปิดหน้าจัดการได้เฉพาะเมื่อต่อ Wi-Fi ในร้าน
                ถ้าลิงก์หลุดออกไป คนนอกก็เข้าหน้าจัดการไม่ได้
              </div>
            )}
          </div>
          {lanUrl && (
            <div className="flex flex-col items-center justify-center rounded-2xl bg-[var(--c-surface-2)] p-4">
              <QrImage text={lanUrl} size={132} alt="QR เข้าผ่าน Wi-Fi ร้าน" />
              <div className="mt-2 text-center text-[12px] font-bold text-brand-ink2">
                สแกนเข้าใช้งานผ่าน Wi-Fi ร้าน
              </div>
              <div className="mt-0.5 break-all text-center text-[11px] text-brand-muted3">
                {lanUrl}
              </div>
              <div className="mt-1.5 text-center text-[11px] font-semibold text-accent-orange">
                ⚠️ ต้องต่อ Wi-Fi ร้านก่อน ถึงจะเปิดได้
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== โหมดเปิดโต๊ะของลูกค้า (สแกนแล้วสั่งเลย vs ขออนุมัติ) ===== */}
      <div className="mb-4 max-w-[920px] rounded-[20px] bg-[var(--c-surface)] p-[26px] shadow-[0_6px_18px_rgba(var(--c-sh),.06)]">
        <div className="font-itim text-[20px] text-brand-ink">ลูกค้าสแกน QR โต๊ะ 📱</div>
        <p className="mb-4 mt-0.5 text-[13px] text-brand-muted2">
          เมื่อลูกค้าสแกน QR ที่ติดบนโต๊ะ จะให้สั่งได้เลย หรือให้พนักงานกดเปิดโต๊ะก่อน
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => changeAutoOpen(false)}
            className={[
              "flex-1 rounded-2xl border-2 px-4 py-3 text-left text-sm font-bold transition-all",
              !autoOpen
                ? "border-accent-green bg-accent-green text-white shadow-[0_3px_0_var(--c-lime-ink)]"
                : "border-[color:var(--c-border-strong)] bg-brand-card text-brand-muted",
            ].join(" ")}
          >
            🔔 ขออนุมัติก่อน
            <span className="ml-1 text-[11px] font-semibold opacity-80">(แนะนำ)</span>
          </button>
          <button
            onClick={() => changeAutoOpen(true)}
            className={[
              "flex-1 rounded-2xl border-2 px-4 py-3 text-left text-sm font-bold transition-all",
              autoOpen
                ? "border-accent-orange bg-accent-orange text-white shadow-[0_3px_0_var(--c-primary-dark)]"
                : "border-[color:var(--c-border-strong)] bg-brand-card text-brand-muted",
            ].join(" ")}
          >
            ⚡ สแกนแล้วสั่งเลย
            <span className="ml-1 text-[11px] font-semibold opacity-80">(ไม่ต้องรอ)</span>
          </button>
        </div>
        {autoOpen ? (
          <div className="mt-3 rounded-2xl bg-accent-orangeBg px-4 py-3 text-[12px] font-semibold leading-relaxed text-accent-orange">
            ⚡ ลูกค้าสแกนแล้วเปิดโต๊ะ + สั่งได้ทันที ไม่ต้องรอพนักงาน — สะดวกแต่โต๊ะอาจถูกเปิดโดยคนที่เดินผ่าน
          </div>
        ) : (
          <div className="mt-3 rounded-2xl bg-[var(--c-surface-2)] px-4 py-3 text-[12px] font-semibold leading-relaxed text-brand-muted2">
            🔒 ลูกค้ากด “ขอเปิดโต๊ะ” → พนักงานกดเปิดก่อนถึงสั่งได้ (กันคนสุ่มยิงออเดอร์เข้าโต๊ะว่าง)
          </div>
        )}
      </div>

      <div className="grid max-w-[920px] grid-cols-1 gap-4 lg:grid-cols-[1.1fr_.9fr]">
        {/* ฟอร์มข้อมูลร้าน */}
        <div className="rounded-[20px] bg-[var(--c-surface)] p-[26px] shadow-[0_6px_18px_rgba(var(--c-sh),.06)]">
          <div className="mb-5 font-itim text-[20px] text-brand-ink">ข้อมูลร้าน 🏠</div>
          <div className="flex flex-col gap-[18px]">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="mb-[7px] block text-[13px] text-brand-muted2">ชื่อร้าน</label>
                <input
                  value={form.shopName}
                  onChange={(e) => setForm({ ...form, shopName: e.target.value })}
                  className="w-full rounded-xl border-[1.5px] border-[color:var(--c-border-strong)] bg-brand-cream px-3.5 py-3 text-[15px] text-brand-ink outline-none"
                />
              </div>
              <div className="w-[74px] shrink-0">
                <label className="mb-[7px] block text-[13px] text-brand-muted2">โลโก้</label>
                <input
                  value={form.logoEmoji}
                  onChange={(e) => setForm({ ...form, logoEmoji: e.target.value })}
                  maxLength={4}
                  aria-label="อีโมจิโลโก้ร้าน"
                  className="w-full rounded-xl border-[1.5px] border-[color:var(--c-border-strong)] bg-brand-cream px-3 py-3 text-center text-[22px] leading-none outline-none"
                />
              </div>
            </div>

            {/* สีหลักของร้าน (white-label) */}
            <div>
              <label className="mb-[7px] block text-[13px] text-brand-muted2">สีหลักของร้าน</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.primaryColor || "#d93a2b"}
                  onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                  aria-label="เลือกสีหลัก"
                  className="h-11 w-14 shrink-0 cursor-pointer rounded-xl border-[1.5px] border-[color:var(--c-border-strong)] bg-transparent p-1"
                />
                {/* preview: ปุ่ม + กล่องโลโก้ ใช้สีที่เลือกจริง */}
                <div
                  className="flex flex-1 items-center gap-2"
                  style={primaryOverride(form.primaryColor) ?? undefined}
                >
                  <span
                    className="grid h-9 w-9 place-items-center rounded-lg text-lg leading-none"
                    style={{ background: "var(--c-logo-grad)" }}
                  >
                    {form.logoEmoji || "🍜"}
                  </span>
                  <span className="rounded-lg bg-brand-primary px-3 py-2 text-[13px] font-bold text-white">
                    ปุ่มหลัก
                  </span>
                </div>
                {form.primaryColor && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, primaryColor: "" })}
                    className="shrink-0 text-[12px] font-semibold text-[color:var(--c-muted-2)] underline"
                  >
                    ใช้สีเริ่มต้น
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-[11px] text-brand-muted3">
                ว่าง = ใช้ธีมเริ่มต้น · เลือกสีแล้วมีผลกับปุ่ม/ไฮไลต์/กล่องโลโก้ทั้งแอป
              </p>
            </div>
            <div>
              <label className="mb-[7px] block text-[13px] text-brand-muted2">เบอร์โทร</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-xl border-[1.5px] border-[color:var(--c-border-strong)] bg-brand-cream px-3.5 py-3 text-[15px] text-brand-ink outline-none"
              />
            </div>
            <div>
              <label className="mb-[7px] block text-[13px] text-brand-muted2">ที่อยู่ร้าน (โชว์บนใบเสร็จ)</label>
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="เช่น 123 ถ.สุขุมวิท แขวงคลองเตย"
                className="w-full rounded-xl border-[1.5px] border-[color:var(--c-border-strong)] bg-brand-cream px-3.5 py-3 text-[15px] text-brand-ink outline-none"
              />
            </div>

            <div className="rounded-xl border border-brand-border2 bg-brand-cream p-3.5">
              <div className="mb-2.5 text-[13px] font-semibold text-brand-muted2">💳 การเงิน / ใบเสร็จ</div>
              <label className="mb-[6px] block text-[12px] text-brand-muted3">พร้อมเพย์ (เบอร์/เลขบัตร ปชช.) — ใช้สร้าง QR เก็บเงิน</label>
              <input
                value={form.promptPayId}
                inputMode="numeric"
                onChange={(e) => setForm({ ...form, promptPayId: e.target.value })}
                placeholder="0881234567"
                className="mb-3 w-full rounded-xl border-[1.5px] border-[color:var(--c-border-strong)] bg-brand-card px-3.5 py-2.5 text-[15px] text-brand-ink outline-none"
              />
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-[6px] block text-[12px] text-brand-muted3">ค่าบริการ %</label>
                  <input
                    value={form.serviceChargePct ? String(form.serviceChargePct) : ""}
                    inputMode="numeric"
                    onChange={(e) =>
                      setForm({ ...form, serviceChargePct: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 })
                    }
                    placeholder="0"
                    className="w-full rounded-xl border-[1.5px] border-[color:var(--c-border-strong)] bg-brand-card px-3.5 py-2.5 text-center text-[15px] text-brand-ink outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-[6px] block text-[12px] text-brand-muted3">VAT %</label>
                  <input
                    value={form.vatPct ? String(form.vatPct) : ""}
                    inputMode="numeric"
                    onChange={(e) =>
                      setForm({ ...form, vatPct: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 })
                    }
                    placeholder="0"
                    className="w-full rounded-xl border-[1.5px] border-[color:var(--c-border-strong)] bg-brand-card px-3.5 py-2.5 text-center text-[15px] text-brand-ink outline-none"
                  />
                </div>
              </div>
              <div className="mt-2 text-[11px] text-brand-muted3">ใส่ 0 = ไม่คิด (คิดกับบิลหน้าขายของ แสดงบนใบเสร็จ)</div>
            </div>

            <div>
              <label className="mb-[7px] block text-[13px] text-brand-muted2">
                ข้อความท้ายใบเสร็จ
              </label>
              <textarea
                value={form.receiptFooter}
                onChange={(e) =>
                  setForm({ ...form, receiptFooter: e.target.value })
                }
                className="min-h-[84px] w-full resize-y rounded-xl border-[1.5px] border-[color:var(--c-border-strong)] bg-brand-cream px-3.5 py-3 text-[15px] text-brand-ink outline-none"
              />
            </div>
            <button
              onClick={save}
              disabled={isPending}
              className="self-start cursor-pointer rounded-[14px] bg-brand-primary px-7 py-3 font-itim text-[18px] text-[color:var(--c-on-primary)] shadow-[0_4px_0_var(--c-primary-dark)] transition-transform active:translate-y-0.5 active:shadow-[0_2px_0_var(--c-primary-dark)] disabled:opacity-60"
            >
              {isPending ? "กำลังบันทึก…" : "บันทึก"}
            </button>
          </div>
        </div>

        {/* ตัวอย่างใบเสร็จ */}
        <div className="flex flex-col items-center gap-3.5">
          <div className="text-[13px] text-brand-muted2">ตัวอย่างใบเสร็จ</div>
          <div className="w-[260px] rounded-md bg-[var(--c-surface)] px-5 py-[22px] shadow-[0_10px_28px_rgba(var(--c-sh),.16)]">
            <div className="mb-3 border-b-[1.5px] border-dashed border-[color:var(--c-divider)] pb-3 text-center">
              <div className="text-[30px]">{form.logoEmoji || "🍜"}</div>
              <div className="font-itim text-[21px] text-brand-ink">
                {form.shopName || "ชื่อร้าน"}
              </div>
              {form.address ? (
                <div className="text-[11px] text-brand-muted3">{form.address}</div>
              ) : null}
              <div className="text-[11px] text-brand-muted3">โทร. {form.phone}</div>
            </div>
            <div className="flex flex-col gap-[5px] text-xs text-brand-muted">
              <div className="flex justify-between">
                <span>ลาเต้ x1</span>
                <span>฿55</span>
              </div>
              <div className="flex justify-between">
                <span>ครัวซองต์ x1</span>
                <span>฿55</span>
              </div>
            </div>
            <div className="my-3 flex justify-between border-t-[1.5px] border-dashed border-[color:var(--c-divider)] pt-2.5 font-bold text-brand-ink">
              <span>รวม</span>
              <span>฿110</span>
            </div>
            <div className="border-t-[1.5px] border-dashed border-[color:var(--c-divider)] pt-2.5 text-[10px] text-brand-muted3">
              พนักงาน: {staff.find((s) => s.isActive)?.name ?? "—"}
            </div>
            <div className="border-t-[1.5px] border-dashed border-[color:var(--c-divider)] pt-3 text-center text-xs text-brand-muted2">
              {form.receiptFooter}
            </div>
          </div>
        </div>
      </div>

      {/* ===== จัดการพนักงานขาย ===== */}
      <div className="mt-4 max-w-[920px] rounded-[20px] bg-[var(--c-surface)] p-[26px] shadow-[0_6px_18px_rgba(var(--c-sh),.06)]">
        <div className="mb-1 font-itim text-[20px] text-brand-ink">พนักงานขาย 👥</div>
        <div className="mb-5 text-[13px] text-brand-muted3">
          พนักงานที่เปิดอยู่จะเลือกได้ในหน้าขายของ เพื่อบันทึกว่าใครเป็นคนขายแต่ละบิล
        </div>

        {/* รายชื่อพนักงาน */}
        <div className="mb-5 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
          {staff.length === 0 ? (
            <div className="text-sm text-brand-muted3">ยังไม่มีพนักงาน</div>
          ) : (
            staff.map((s) => (
              <div
                key={s.id}
                className="rounded-[16px] border border-brand-border2 bg-brand-card p-3 transition-opacity"
                style={{ opacity: s.isActive ? 1 : 0.5 }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-[20px]"
                    style={{ background: `${s.color}22` }}
                  >
                    {s.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[15px] font-semibold text-brand-ink2">{s.name}</span>
                      {s.role === "admin" && (
                        <span className="flex-none rounded-full bg-brand-primary px-1.5 py-0.5 text-[10px] font-bold text-[color:var(--c-on-primary)]">
                          แอดมิน
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <button
                        onClick={() => onToggleStaff(s)}
                        className="flex w-[42px] cursor-pointer rounded-[14px] p-[3px] transition-all"
                        style={{
                          justifyContent: s.isActive ? "flex-end" : "flex-start",
                          background: s.isActive ? "var(--c-lime)" : "var(--c-divider)",
                        }}
                        aria-label={s.isActive ? "ปิดการใช้งาน" : "เปิดการใช้งาน"}
                      >
                        <span className="block h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.3)]" />
                      </button>
                      <span className="text-xs text-brand-muted3">
                        {s.isActive ? "เปิดอยู่" : "ปิดอยู่"}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => onDeleteStaff(s)}
                    className="flex-none cursor-pointer rounded-[10px] border-[1.5px] border-accent-orangeBorder bg-accent-orangeBg px-2.5 py-[5px] text-xs text-accent-orange"
                    aria-label="ลบพนักงาน"
                  >
                    ลบ
                  </button>
                </div>

                {/* บัญชีล็อกอิน */}
                <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-brand-border2 pt-2.5">
                  <span className="min-w-0 truncate text-[12px]">
                    {s.hasLogin ? (
                      <span className="text-brand-muted">🔑 @{s.username}</span>
                    ) : (
                      <span className="text-brand-muted3">ยังไม่มีล็อกอิน</span>
                    )}
                  </span>
                  <button
                    onClick={() => (loginEdit?.id === s.id ? setLoginEdit(null) : openLogin(s))}
                    className="flex-none cursor-pointer rounded-lg border border-[color:var(--c-border-strong)] bg-brand-card px-2.5 py-1 text-[11px] font-semibold text-brand-primary"
                  >
                    {s.hasLogin ? "แก้ล็อกอิน" : "ตั้งล็อกอิน"}
                  </button>
                </div>

                {loginEdit?.id === s.id && (
                  <div className="mt-2.5 flex flex-col gap-2 rounded-xl bg-[var(--c-surface-2)] p-2.5">
                    <input
                      value={loginEdit.draft.username}
                      onChange={(e) =>
                        setLoginEdit({ id: s.id, draft: { ...loginEdit.draft, username: e.target.value } })
                      }
                      placeholder="ชื่อผู้ใช้ (a-z 0-9 . _ -)"
                      className="rounded-lg border border-[color:var(--c-border-strong)] bg-brand-card px-2.5 py-1.5 text-[13px] text-brand-ink outline-none"
                    />
                    <input
                      value={loginEdit.draft.password}
                      type="password"
                      onChange={(e) =>
                        setLoginEdit({ id: s.id, draft: { ...loginEdit.draft, password: e.target.value } })
                      }
                      placeholder={s.hasLogin ? "รหัสใหม่ (เว้นว่าง = รหัสเดิม)" : "ตั้งรหัสผ่าน (≥8 ตัว)"}
                      className="rounded-lg border border-[color:var(--c-border-strong)] bg-brand-card px-2.5 py-1.5 text-[13px] text-brand-ink outline-none"
                    />
                    <div className="flex gap-1.5">
                      {(["staff", "admin"] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() =>
                            setLoginEdit({ id: s.id, draft: { ...loginEdit.draft, role: r } })
                          }
                          className={[
                            "flex-1 rounded-lg py-1 text-[12px] font-semibold",
                            loginEdit.draft.role === r
                              ? "bg-brand-primary text-[color:var(--c-on-primary)]"
                              : "bg-brand-card text-brand-muted border border-[color:var(--c-border)]",
                          ].join(" ")}
                        >
                          {r === "admin" ? "แอดมิน" : "พนักงาน"}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={saveLogin}
                        disabled={isPending}
                        className="flex-1 rounded-lg bg-brand-primary py-1.5 text-[12px] font-bold text-[color:var(--c-on-primary)] disabled:opacity-60"
                      >
                        บันทึก
                      </button>
                      {s.hasLogin && (
                        <button
                          onClick={() => onRemoveLogin(s)}
                          disabled={isPending}
                          className="rounded-lg border border-accent-orangeBorder bg-accent-orangeBg px-2.5 py-1.5 text-[12px] font-semibold text-accent-orange disabled:opacity-60"
                        >
                          ยกเลิก
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* เพิ่มพนักงาน */}
        <div className="rounded-[16px] border border-dashed border-brand-border3 bg-brand-cream p-4">
          <div className="mb-3 text-[13px] text-brand-muted2">เพิ่มพนักงานใหม่</div>
          <div className="mb-3 flex flex-wrap gap-2">
            {STAFF_EMOJI.map((e) => {
              const active = newEmoji === e;
              return (
                <button
                  key={e}
                  onClick={() => setNewEmoji(e)}
                  className={[
                    "h-10 w-10 cursor-pointer rounded-xl border-2 text-[20px]",
                    active
                      ? "border-brand-primary bg-[var(--c-selected)]"
                      : "border-[color:var(--c-border)] bg-brand-card",
                  ].join(" ")}
                >
                  {e}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2.5">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addStaff();
              }}
              placeholder="ชื่อพนักงาน"
              className="flex-1 rounded-xl border-[1.5px] border-[color:var(--c-border-strong)] bg-brand-card px-3.5 py-3 text-[15px] text-brand-ink outline-none"
            />
            <button
              onClick={addStaff}
              disabled={isPending}
              className="flex-none cursor-pointer rounded-[14px] bg-brand-primary px-6 py-3 text-[15px] font-semibold text-[color:var(--c-on-primary)] shadow-[0_3px_0_var(--c-primary-dark)] transition-transform active:translate-y-0.5 active:shadow-[0_1px_0_var(--c-primary-dark)] disabled:opacity-60"
            >
              เพิ่ม
            </button>
          </div>
        </div>
      </div>

      {/* ===== จัดการโต๊ะ + QR ===== */}
      <div className="mt-4 max-w-[920px] rounded-[20px] bg-[var(--c-surface)] p-[26px] shadow-[0_6px_18px_rgba(var(--c-sh),.06)]">
        <div className="mb-1 font-itim text-[20px] text-brand-ink">โต๊ะ &amp; QR สั่งอาหาร 🍜</div>
        <div className="mb-5 text-[13px] text-brand-muted3">
          ลูกค้าสแกน QR ของแต่ละโต๊ะเพื่อสั่งเอง · โต๊ะที่ปิดจะไม่ขึ้นในหน้าโต๊ะและสแกนไม่ได้
        </div>

        <div className="mb-5 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
          {tables.length === 0 ? (
            <div className="text-sm text-brand-muted3">ยังไม่มีโต๊ะ</div>
          ) : (
            tables.map((t) => (
              <div
                key={t.id}
                className="rounded-[16px] border border-brand-border2 bg-brand-card p-3.5 transition-opacity"
                style={{ opacity: t.isActive ? 1 : 0.5 }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-itim text-[22px] text-brand-primary">{t.name}</div>
                  <span className="rounded-full bg-brand-chip px-2 py-0.5 text-[11px] font-semibold text-brand-muted2">
                    {t.qrToken}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => setQrTable(t)}
                    className="cursor-pointer rounded-[10px] bg-accent-green px-2.5 py-[6px] text-xs font-bold text-white"
                  >
                    ดู QR
                  </button>
                  <button
                    onClick={() => onRenameTable(t)}
                    className="cursor-pointer rounded-[10px] border-[1.5px] border-[color:var(--c-border-strong)] bg-brand-card px-2.5 py-[6px] text-xs text-brand-primary"
                  >
                    เปลี่ยนชื่อ
                  </button>
                  <button
                    onClick={() => onToggleTable(t)}
                    className="cursor-pointer rounded-[10px] border-[1.5px] border-[color:var(--c-border-strong)] bg-brand-card px-2.5 py-[6px] text-xs text-brand-muted"
                  >
                    {t.isActive ? "ปิด" : "เปิด"}
                  </button>
                  <button
                    onClick={() => onDeleteTable(t)}
                    className="cursor-pointer rounded-[10px] border-[1.5px] border-accent-orangeBorder bg-accent-orangeBg px-2.5 py-[6px] text-xs text-accent-orange"
                  >
                    ลบ
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="rounded-[16px] border border-dashed border-brand-border3 bg-brand-cream p-4">
          <div className="mb-3 text-[13px] text-brand-muted2">เพิ่มโต๊ะใหม่</div>
          <div className="flex gap-2.5">
            <input
              value={newTable}
              onChange={(e) => setNewTable(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTable();
              }}
              placeholder={`ชื่อโต๊ะ (เว้นว่าง = โต๊ะ ${tables.length + 1})`}
              className="flex-1 rounded-xl border-[1.5px] border-[color:var(--c-border-strong)] bg-brand-card px-3.5 py-3 text-[15px] text-brand-ink outline-none"
            />
            <button
              onClick={addTable}
              disabled={isPending}
              className="flex-none cursor-pointer rounded-[14px] bg-brand-primary px-6 py-3 text-[15px] font-semibold text-[color:var(--c-on-primary)] shadow-[0_3px_0_var(--c-primary-dark)] transition-transform active:translate-y-0.5 active:shadow-[0_1px_0_var(--c-primary-dark)] disabled:opacity-60"
            >
              เพิ่มโต๊ะ
            </button>
          </div>
        </div>
      </div>

      {/* ===== MODAL QR โต๊ะ ===== */}
      {qrTable && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(var(--c-scrim),.5)] p-5"
          onClick={() => setQrTable(null)}
        >
          <div
            className="qr-print w-[320px] animate-pop rounded-[24px] bg-[var(--c-surface)] p-7 text-center shadow-[0_24px_60px_rgba(var(--c-scrim),.4)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-itim text-[26px] text-brand-primary">{qrTable.name}</div>
            <div className="mb-4 text-[13px] text-brand-muted2">สแกนเพื่อสั่งอาหาร</div>
            {origin ? (
              <QrImage
                text={tableOrderLink(origin, qrTable.qrToken)}
                size={240}
                alt={`QR ${qrTable.name}`}
                className="mx-auto h-[240px] w-[240px] rounded-xl bg-white"
              />
            ) : null}
            <div className="mt-3 break-all text-[11px] text-brand-muted3">
              {origin}/table/{qrTable.qrToken}
            </div>
            <div className="mt-5 flex gap-2.5 print:hidden">
              <button
                onClick={() => setQrTable(null)}
                className="flex-1 cursor-pointer rounded-[14px] border-[1.5px] border-[color:var(--c-border-strong)] bg-brand-card p-3 text-[15px] text-brand-muted"
              >
                ปิด
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 cursor-pointer rounded-[14px] bg-brand-primary p-3 text-[15px] font-semibold text-[color:var(--c-on-primary)] shadow-[0_3px_0_var(--c-primary-dark)]"
              >
                🖨️ ปริ้น QR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
