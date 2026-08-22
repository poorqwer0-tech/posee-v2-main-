import { getSettings } from "@/lib/queries";

export const dynamic = "force-dynamic";

// หน้าแจ้งเตือนเมื่อพยายามเข้าหน้า staff จากนอก WiFi ร้าน (โหมด lan-only)
export default async function LanOnlyPage() {
  const { shopName } = await getSettings();
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--c-broth)] px-5 py-10 text-brand-ink">
      <div className="w-full max-w-[440px] rounded-[24px] bg-[var(--c-surface)] p-8 text-center shadow-[0_18px_50px_rgba(var(--c-sh),.16)]">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-brand-sidebar text-3xl">
          📶
        </div>
        <h1 className="font-itim text-3xl leading-tight text-brand-primary">
          เข้าได้เฉพาะ Wi-Fi ร้าน
        </h1>
        <p className="mt-3 text-sm font-semibold text-brand-muted">
          หน้าจัดการของ <b>{shopName}</b> เปิดให้ใช้เฉพาะเมื่อเชื่อมต่อ Wi-Fi ในร้านเท่านั้น
          เพื่อความปลอดภัย
        </p>
        <div className="mt-5 rounded-2xl bg-[var(--c-surface-2)] px-4 py-3 text-left text-xs leading-relaxed text-brand-muted2">
          <b>วิธีเข้าใช้งาน</b>
          <ol className="mt-1.5 list-decimal space-y-1 pl-4">
            <li>เชื่อมต่อ Wi-Fi ของร้านที่อุปกรณ์ของคุณ</li>
            <li>สแกน QR หรือเปิดลิงก์ที่แอดมินให้ไว้อีกครั้ง</li>
          </ol>
          <div className="mt-2 text-brand-muted3">
            หากต้องการเข้าจากนอกร้าน แอดมินเปิดโหมด “สาธารณะ” ได้ที่หน้า “ตั้งค่า”
          </div>
        </div>
      </div>
    </main>
  );
}
