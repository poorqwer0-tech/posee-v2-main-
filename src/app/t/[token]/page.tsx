import { CustomerOrderClient } from "@/components/CustomerOrderClient";
import {
  getBestSellerProducts,
  getCustomerProducts,
  getOrderTokenView,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

/** ลิงก์สั่งอาหารชั่วคราวต่อรอบ — เข้าด้วย order_token โดยตรง (พนักงานสร้าง/ส่งให้ลูกค้า)
 *  โต๊ะปิด/จ่ายแล้ว → token ไม่ active → ขึ้น "ลิงก์หมดอายุ" */
export default async function TempOrderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const view = await getOrderTokenView(token);

  if (!view) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--c-surface-2)] p-6 text-center">
        <div className="rounded-2xl bg-[var(--c-surface)] px-6 py-8 shadow-[0_10px_28px_rgba(var(--c-sh),.1)]">
          <div className="text-4xl">🔒</div>
          <h1 className="mt-2 font-itim text-2xl text-brand-primary">ลิงก์นี้หมดอายุแล้ว</h1>
          <p className="mt-1 text-sm text-[color:var(--c-muted)]">
            โต๊ะปิดแล้ว — กรุณาสแกน QR ที่โต๊ะใหม่ หรือเรียกพนักงาน
          </p>
        </div>
      </div>
    );
  }

  const products = await getCustomerProducts();
  const bestSellers = (await getBestSellerProducts(6)).map((p) => ({
    id: p.id,
    sold: p.sold,
  }));
  return (
    <CustomerOrderClient
      token={view.table.qrToken}
      orderToken={token}
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
