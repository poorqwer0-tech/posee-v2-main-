import { IngredientsClient } from "@/components/IngredientsClient";
import { getIngredients } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function IngredientsPage() {
  const ingredients = await getIngredients();
  return <IngredientsClient ingredients={ingredients} />;
}
