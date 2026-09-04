import { Storefront } from "@/components/storefront";
import { getPublicCommerceAction } from "@/app/actions/public";
export const dynamic = "force-dynamic";
export default async function Shop() {
  const { products, bundles } = await getPublicCommerceAction();
  return <Storefront products={products} bundles={bundles} />;
}
