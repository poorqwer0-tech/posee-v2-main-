import { PosClient } from "@/components/PosClient";
import {
  getActiveStaff,
  getActiveTables,
  getPosProducts,
  getSettings,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const products = await getPosProducts();
  const staff = await getActiveStaff();
  const tables = await getActiveTables();
  const s = await getSettings();
  return (
    <PosClient
      products={products}
      staff={staff}
      tables={tables.map((t) => ({ id: t.id, name: t.name, qrToken: t.qrToken }))}
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
