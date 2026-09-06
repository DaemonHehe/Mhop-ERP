import { PageHeading } from "@/components/page-heading";
import { InventoryConsole } from "@/components/inventory-console";
import { getInventoryAction } from "@/app/actions/store";
export const dynamic = "force-dynamic";
export default async function Inventory() {
  const items = await getInventoryAction();
  return (
    <>
      <PageHeading
        eyebrow="Catalog & Stock"
        title="Products & Stock"
        description="Manage gadget products and PUBG accounts in separate sections, with gadget stock and individual account sales."
      />
      <InventoryConsole items={items} />
    </>
  );
}
