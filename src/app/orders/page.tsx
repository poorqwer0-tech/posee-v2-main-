import { OrdersClient, type OrderView } from "@/components/OrdersClient";
import { getAllStaff, getOrders, getSettings } from "@/lib/queries";
import { timeLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const staff = await getAllStaff();
  const emojiByName = new Map(staff.map((s) => [s.name, s.emoji]));
  const s = await getSettings();

  const orders: OrderView[] = (await getOrders()).map((o) => ({
    id: o.id,
    no: o.orderNo,
    total: o.total,
    discount: o.discount,
    finalTotal: o.finalTotal,
    method: o.paymentMethod,
    status: o.status,
    time: timeLabel(o.createdAt),
    dateTime: o.createdAt.toLocaleString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    staffName: o.staffName ?? "",
    staffEmoji: o.staffName ? emojiByName.get(o.staffName) ?? "🧑" : "",
    items: o.items.map((it) => ({
      name: it.productName,
      emoji: it.emoji,
      price: it.price,
      qty: it.quantity,
      subtotal: it.subtotal,
    })),
  }));

  return (
    <OrdersClient
      orders={orders}
      shop={{
        shopName: s.shopName,
        logoEmoji: s.logoEmoji,
        phone: s.phone,
        address: s.address,
        footer: s.receiptFooter,
        promptPayId: s.promptPayId,
        serviceChargePct: s.serviceChargePct,
        vatPct: s.vatPct,
      }}
    />
  );
}
