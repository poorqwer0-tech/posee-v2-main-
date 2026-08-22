export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  shopName: "กรุณาใส่ชื่อร้าน",
  username: "ชื่อผู้ใช้ต้องเป็น a-z, 0-9, . _ - ยาว 3-32 ตัว",
  password: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร",
  confirm: "รหัสผ่านยืนยันไม่ตรงกัน",
};

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--c-broth)] px-5 py-10 text-brand-ink">
      <form
        action="/api/setup"
        method="post"
        className="w-full max-w-[460px] rounded-[24px] bg-[var(--c-surface)] p-7 shadow-[0_18px_50px_rgba(var(--c-sh),.16)]"
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-[22px] bg-brand-sidebar text-3xl">
            🍜
          </div>
          <h1 className="font-itim text-3xl leading-none text-brand-primary">ตั้งค่าร้านครั้งแรก</h1>
          <p className="mt-2 text-sm font-semibold text-brand-muted2">
            ตั้งชื่อร้านและบัญชีแอดมินเพื่อเริ่มใช้งาน
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl bg-accent-orangeBg px-4 py-3 text-sm font-bold text-accent-orange">
            {ERRORS[error] ?? "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง"}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <Field label="ชื่อร้าน" name="shopName" placeholder="เช่น ก๋วยเตี๋ยวเรือคุณสมชาย" autoFocus required />
          <Field label="เบอร์โทร (ไม่บังคับ)" name="phone" placeholder="เช่น 08x-xxx-xxxx" />
          <Field label="พร้อมเพย์ (เบอร์/เลขบัตร ปชช. — ไม่บังคับ)" name="promptPayId" placeholder="เช่น 0812345678" />

          <div className="my-1 border-t border-dashed border-brand-border" />
          <div className="text-sm font-bold text-brand-ink2">บัญชีแอดมิน (ผู้ดูแลร้าน)</div>
          <Field label="ชื่อผู้ใช้" name="username" defaultValue="admin" required />
          <Field label="รหัสผ่าน (อย่างน้อย 8 ตัว)" name="password" type="password" required />
          <Field label="ยืนยันรหัสผ่าน" name="confirm" type="password" required />
        </div>

        <button className="mt-6 w-full rounded-2xl bg-brand-primary py-4 text-base font-bold text-white shadow-[0_8px_18px_rgba(var(--c-sh),.24)]">
          เริ่มใช้งานร้าน →
        </button>
        <p className="mt-4 text-center text-xs leading-relaxed text-brand-muted3">
          หลังตั้งค่าเสร็จ เพิ่มเมนู/โต๊ะ/พนักงานได้ที่หน้า “ตั้งค่า” และ “เมนู”
        </p>
      </form>
    </main>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  defaultValue,
  autoFocus,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  autoFocus?: boolean;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-brand-ink2">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        required={required}
        autoComplete={type === "password" ? "new-password" : "off"}
        className="h-12 w-full rounded-2xl border-2 border-brand-border bg-brand-card px-4 text-base outline-none focus:border-brand-primary"
      />
    </label>
  );
}
