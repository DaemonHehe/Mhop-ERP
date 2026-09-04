import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { InventoryConsole } from "@/components/inventory-console";
import { getAccountUnitsAction, getInventoryAction } from "@/app/actions/store";
export const dynamic = "force-dynamic";
export default async function Inventory() {
  const [items, accounts] = await Promise.all([
    getInventoryAction(),
    getAccountUnitsAction(),
  ]);
  return (
    <AppShell>
      <PageHeading
        eyebrow="Catalog & Stock"
        title="Products & Stock"
        description="Create and maintain gaming-gadget stock and individual PUBG account records from one synchronized workspace."
      />
      <InventoryConsole items={items} accounts={accounts} />
    </AppShell>
  );
}
