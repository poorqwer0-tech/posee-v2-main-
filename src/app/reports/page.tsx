import { getReport } from "@/lib/queries";
import { baht } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const {
    todaySales,
    orderCount,
    avg,
    dailyBars,
    bestSellers,
    staffSales,
    todayExpenses,
    profit,
  } = await getReport();

  const statCards = [
    { emoji: "💰", label: "ยอดขายวันนี้", value: baht(todaySales), sub: "เฉพาะบิลสำเร็จ", color: "var(--c-primary)" },
    { emoji: "💸", label: "รายจ่ายวันนี้", value: baht(todayExpenses), sub: "รวมทุกหมวด", color: "var(--c-orange)" },
    { emoji: profit >= 0 ? "📈" : "📉", label: "กำไรสุทธิวันนี้", value: baht(profit), sub: "ยอดขาย − รายจ่าย", color: profit >= 0 ? "var(--c-lime-ink)" : "var(--c-orange)" },
    { emoji: "🧾", label: "จำนวนออเดอร์", value: `${orderCount} บิล`, sub: "เฉพาะที่สำเร็จ", color: "var(--c-primary)" },
    { emoji: "📊", label: "ยอดเฉลี่ย/บิล", value: baht(avg), sub: "ต่อ 1 ออเดอร์", color: "var(--c-primary)" },
  ];

  const maxDay = Math.max(1, ...dailyBars.map((b) => b.value));
  const maxSell = Math.max(1, ...bestSellers.map((s) => s.qty));
  const maxStaff = Math.max(1, ...staffSales.map((s) => s.sales));

  return (
    <div className="flex-1 animate-fadeUp overflow-auto px-[26px] pb-[30px] pt-5">
      {/* การ์ดสรุป */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-3.5">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-3 rounded-[20px] bg-[var(--c-surface)] px-[18px] py-5 shadow-[0_6px_18px_rgba(var(--c-sh),.06)]"
          >
            <div className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-[var(--c-placeholder)] text-[24px]">
              {s.emoji}
            </div>
            <div className="min-w-0">
              <div className="text-[12px] text-brand-muted2">{s.label}</div>
              <div
                className="font-itim text-[26px] leading-[1.15]"
                style={{ color: s.color }}
              >
                {s.value}
              </div>
              <div className="text-[11px] text-brand-muted3">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-3.5">
        {/* กราฟ 7 วัน */}
        <div className="rounded-[20px] bg-[var(--c-surface)] p-[22px] shadow-[0_6px_18px_rgba(var(--c-sh),.06)]">
          <div className="mb-[18px] font-itim text-[19px] text-brand-ink">
            ยอดขาย 7 วันล่าสุด 📈
          </div>
          <div className="flex h-[190px] items-end justify-between gap-2.5">
            {dailyBars.map((b, i) => (
              <div
                key={i}
                className="flex h-full flex-1 flex-col items-center justify-end gap-2"
              >
                <div className="text-[11px] text-brand-muted3">
                  {b.value >= 1000
                    ? `${(b.value / 1000).toFixed(1)}k`
                    : String(b.value)}
                </div>
                <div
                  className="w-[70%] max-w-[34px] rounded-[8px_8px_4px_4px] transition-all"
                  style={{
                    height: `${Math.max(6, Math.round((b.value / maxDay) * 150))}px`,
                    background: b.isToday
                      ? "linear-gradient(180deg,var(--c-primary),var(--c-primary-dark))"
                      : "linear-gradient(180deg,var(--c-tan),var(--c-tan))",
                  }}
                />
                <div className="text-xs text-brand-muted2">{b.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* เมนูขายดี */}
        <div className="rounded-[20px] bg-[var(--c-surface)] p-[22px] shadow-[0_6px_18px_rgba(var(--c-sh),.06)]">
          <div className="mb-[18px] font-itim text-[19px] text-brand-ink">
            เมนูขายดี ⭐
          </div>
          <div className="flex flex-col gap-[15px]">
            {bestSellers.length === 0 ? (
              <div className="flex items-center gap-3 text-sm text-brand-muted3">
                <span className="text-[20px]">🫖</span> ยังไม่มีข้อมูล
              </div>
            ) : (
              bestSellers.map((m) => (
                <div key={m.name} className="flex items-center gap-3">
                  <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[11px] bg-[var(--c-placeholder)] text-[20px]">
                    {m.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-[5px] flex justify-between text-[13px]">
                      <span className="font-semibold text-brand-ink2">{m.name}</span>
                      <span className="text-brand-muted3">{m.qty} แก้ว</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-md bg-brand-chip">
                      <div
                        className="h-full rounded-md"
                        style={{
                          width: `${Math.round((m.qty / maxSell) * 100)}%`,
                          background: "linear-gradient(90deg,var(--c-tan),var(--c-primary))",
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ยอดขายแยกตามพนักงาน */}
      <div className="mt-3.5 rounded-[20px] bg-[var(--c-surface)] p-[22px] shadow-[0_6px_18px_rgba(var(--c-sh),.06)]">
        <div className="mb-[18px] font-itim text-[19px] text-brand-ink">
          ยอดขายแยกตามพนักงานวันนี้ 👥
        </div>
        {staffSales.length === 0 ? (
          <div className="flex items-center gap-3 text-sm text-brand-muted3">
            <span className="text-[20px]">🧑‍🍳</span> วันนี้ยังไม่มียอดขาย
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-8 gap-y-[15px]">
            {staffSales.map((s) => (
              <div key={s.name} className="flex items-center gap-3">
                <div
                  className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full text-[18px]"
                  style={{ background: `${s.color}22` }}
                >
                  {s.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-[5px] flex justify-between text-[13px]">
                    <span className="font-semibold text-brand-ink2">{s.name}</span>
                    <span className="text-brand-muted3">
                      {baht(s.sales)} · {s.bills} บิล
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-md bg-brand-chip">
                    <div
                      className="h-full rounded-md"
                      style={{
                        width: `${Math.round((s.sales / maxStaff) * 100)}%`,
                        background: s.color,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
