import { KitchenClient } from "@/components/KitchenClient";
import { getKitchenOrders } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  const orders = await getKitchenOrders();
  return (
    <KitchenClient
      orders={orders.map((order) => ({
        id: order.id,
        orderNo: order.orderNo,
        status: order.status,
        tableName: order.tableName,
        tableToken: order.tableToken,
        note: order.note,
        createdAt: order.createdAt,
        items: order.items.map((item) => ({
          id: item.id,
          productName: item.productName,
          quantity: item.quantity,
          note: item.note,
        })),
      }))}
    />
  );
}
