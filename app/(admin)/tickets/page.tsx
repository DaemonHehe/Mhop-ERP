import { PageHeading } from "@/components/page-heading";
import { WarrantyBoard } from "@/components/warranty-board";
import { getInventoryAction, getTicketsAction } from "@/app/actions/store";
export const dynamic = "force-dynamic";
export default async function Tickets() {
  const [tickets, products] = await Promise.all([
    getTicketsAction(),
    getInventoryAction(),
  ]);
  return (
    <>
      <PageHeading
        eyebrow="Warranty helpdesk"
        title="RMA ticket board"
        description="Verify coverage by order and product identifier, then keep every claim visible through return dispatch."
      />
      <WarrantyBoard tickets={tickets} products={products} />
    </>
  );
}
