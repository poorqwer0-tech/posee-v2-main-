import { getSettings } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next || "/staff";
  const { shopName, logoEmoji } = await getSettings();
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--c-broth)] px-5 py-10 text-brand-ink">
      <form
        action="/api/login"
        method="post"
        className="w-full max-w-[420px] rounded-[24px] bg-[var(--c-surface)] p-7 shadow-[0_18px_50px_rgba(var(--c-sh),.16)]"
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-[22px] bg-brand-sidebar text-3xl text-white">
            {logoEmoji}
          </div>
          <h1 className="font-itim text-4xl leading-none text-brand-primary">
            เข้าระบบร้าน
          </h1>
          <p className="mt-2 text-sm font-semibold text-brand-muted">{shopName}</p>
          <p className="mt-1 text-sm font-semibold text-brand-muted2">
            สำหรับพนักงานทั่วไปและแอดมิน
          </p>
        </div>

        <input type="hidden" name="next" value={next} />
        <label className="mb-2 block text-sm font-bold text-brand-ink2">
          ชื่อผู้ใช้
        </label>
        <input
          name="username"
          type="text"
          autoFocus
          autoComplete="username"
          placeholder="เช่น admin หรือชื่อพนักงาน"
          className="mb-4 h-13 w-full rounded-2xl border-2 border-brand-border bg-brand-card px-4 py-3 text-lg outline-none focus:border-brand-primary"
        />
        <label className="mb-2 block text-sm font-bold text-brand-ink2">
          รหัสผ่าน
        </label>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="ใส่รหัสผ่าน"
          className="h-13 w-full rounded-2xl border-2 border-brand-border bg-brand-card px-4 py-3 text-lg outline-none focus:border-brand-primary"
        />

        {params.error && (
          <div className="mt-3 rounded-2xl bg-accent-orangeBg px-4 py-3 text-sm font-bold text-accent-orange">
            {params.error === "toomany"
              ? "พยายามเข้าระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่"
              : "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"}
          </div>
        )}

        <button className="mt-5 w-full rounded-2xl bg-brand-primary py-4 text-base font-bold text-white shadow-[0_8px_18px_rgba(var(--c-sh),.24)]">
          เข้าระบบ
        </button>

        <div className="mt-4 rounded-2xl bg-[var(--c-surface-2)] px-4 py-3 text-xs leading-relaxed text-brand-muted2">
          แอดมินตั้งบัญชีพนักงานได้ที่หน้า <b>ตั้งค่า</b> · บัญชีแอดมินตั้งต้นคือ <b>admin</b>
        </div>
      </form>
    </main>
  );
}
