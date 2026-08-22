import { StaffTablesClient } from "@/components/StaffTablesClient";
import { getSettings, getStaffTableViews } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const tables = await getStaffTableViews();
  const settings = await getSettings();
  return (
    <StaffTablesClient
      promptPayId={settings.promptPayId}
      tableAutoOpen={settings.tableAutoOpen}
      shopName={settings.shopName}
      logoEmoji={settings.logoEmoji}
      phone={settings.phone}
      address={settings.address}
      receiptFooter={settings.receiptFooter}
      serviceChargePct={settings.serviceChargePct}
      vatPct={settings.vatPct}
      tables={tables.map((view) => ({
        table: {
          id: view.table.id,
          name: view.table.name,
          status: view.table.status,
          qrToken: view.table.qrToken,
        },
        session: view.session
          ? {
              id: view.session.id,
              paymentStatus: view.session.paymentStatus,
              orderToken: view.session.orderToken,
            }
          : null,
        orders: view.orders.map((order) => ({
          id: order.id,
          orderNo: order.orderNo,
          status: order.status,
          finalTotal: order.finalTotal,
          items: order.items.map((item) => ({
            id: item.id,
            productName: item.productName,
            quantity: item.quantity,
            subtotal: item.subtotal,
            note: item.note,
          })),
        })),
        payment: view.payment
          ? {
              id: view.payment.id,
              status: view.payment.status,
              amount: view.payment.amount,
            }
          : null,
        total: view.total,
        hasReady: view.hasReady,
        hasActive: view.hasActive,
      }))}
    />
  );
}
