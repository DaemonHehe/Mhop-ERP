import { getReceiptOrdersAction } from "@/app/actions/store";
import { getPaymentAccountsAction } from "@/app/actions/payment-accounts";
import { PageHeading } from "@/components/page-heading";
import { ReceiptsConsole } from "@/components/receipts-console";

export const dynamic = "force-dynamic";

export default async function Receipts() {
  const [orders, accounts] = await Promise.all([
    getReceiptOrdersAction(),
    getPaymentAccountsAction(),
  ]);

  return (
    <>
      <div className="no-print">
        <PageHeading
          eyebrow="Point of sale"
          title="Sales vouchers & payments"
          description="Print sales vouchers, customize thermal receipts, and manage transfer bank accounts."
        />
      </div>
      <ReceiptsConsole orders={orders} accounts={accounts} />
    </>
  );
}
