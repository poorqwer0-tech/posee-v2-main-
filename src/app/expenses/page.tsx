import { ExpensesClient, type ExpenseView } from "@/components/ExpensesClient";
import { getExpenses, getTodayExpenses } from "@/lib/queries";

export const dynamic = "force-dynamic";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function ExpensesPage() {
  const today = startOfToday().getTime();
  const rows: ExpenseView[] = (await getExpenses()).map((e) => ({
    id: e.id,
    title: e.title,
    category: e.category,
    amount: e.amount,
    note: e.note,
    dateLabel: e.createdAt.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
    }),
    timeLabel: e.createdAt.toTimeString().slice(0, 5),
    isToday: e.createdAt.getTime() >= today,
  }));

  return <ExpensesClient expenses={rows} todayTotal={await getTodayExpenses()} />;
}
