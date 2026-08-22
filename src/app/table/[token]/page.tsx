import { notFound } from "next/navigation";
import { CustomerOrderClient } from "@/components/CustomerOrderClient";
import {
  getBestSellerProducts,
  getCustomerProducts,
  getCustomerTableView,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function CustomerTablePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const view = await getCustomerTableView(token);
  if (!view) notFound();

  const products = await getCustomerProducts();
  const bestSellers = (await getBestSellerProducts(6)).map((p) => ({
    id: p.id,
    sold: p.sold,
  }));
  return (
    <CustomerOrderClient
      token={token}
      orderToken={view.session?.orderToken ?? null}
      requested={view.table.status === "open_requested"}
      tableName={view.table.name}
      products={products}
      bestSellers={bestSellers}
      paymentStatus={view.payment?.status}
      orders={view.orders.map((order) => ({
        id: order.id,
        orderNo: order.orderNo,
        status: order.status,
        finalTotal: order.finalTotal,
        items: order.items.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          subtotal: item.subtotal,
          note: item.note,
        })),
      }))}
    />
  );
}
