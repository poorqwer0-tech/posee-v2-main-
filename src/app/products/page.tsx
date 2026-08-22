import { ProductsClient } from "@/components/ProductsClient";
import { getIngredients, getManageProducts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const products = await getManageProducts();
  const ingredients = await getIngredients();
  return <ProductsClient products={products} ingredients={ingredients} />;
}
