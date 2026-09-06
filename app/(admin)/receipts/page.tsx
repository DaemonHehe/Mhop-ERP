import { getReceiptOrdersAction } from "@/app/actions/store";
import { PageHeading } from "@/components/page-heading";
import { ReceiptBuilder } from "@/components/receipt-builder";
export const dynamic = "force-dynamic";
export default async function Receipts() {
  const orders = await getReceiptOrdersAction();
  return (
    <>
      <div className="no-print">
        <PageHeading
          eyebrow="Point of sale"
          title="Sales voucher studio"
          description="Print the MH OP sales voucher or choose a compact 80mm/58mm thermal receipt."
        />
      </div>
      <ReceiptBuilder orders={orders} />
    </>
  );
}
