import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { BundleConsole } from "@/components/bundle-console";
import { getBundlesAction } from "@/app/actions/bundles";
import { getInventoryAction } from "@/app/actions/store";
export const dynamic = "force-dynamic";
export default async function BundlesPage() {
  const [bundles, products] = await Promise.all([
    getBundlesAction(),
    getInventoryAction(),
  ]);
  return (
    <AppShell>
      <PageHeading
        eyebrow="Catalog merchandising"
        title="Bundle Sets"
        description="Combine active products into discounted sets. Availability follows the lowest underlying SKU quantity and checkout consumes each included item atomically."
      />
      <BundleConsole bundles={bundles} products={products} />
    </AppShell>
  );
}
