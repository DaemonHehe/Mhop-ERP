import { PageHeading } from "@/components/page-heading";
import { ErpConsole } from "@/components/erp-console";
import { MonthlyReportButton } from "@/components/monthly-report-button";
import { getErpDataAction } from "@/app/actions/erp";
import { getInventoryAction } from "@/app/actions/store";
export const dynamic = "force-dynamic";
export default async function ErpPage() {
  const [{ snapshot, suppliers, purchases, expenses }, products] =
    await Promise.all([getErpDataAction(), getInventoryAction()]);
  return (
    <>
      <PageHeading
        eyebrow="Business control"
        title="ERP & Finance"
        description="Control suppliers, purchasing, stock receiving, operating expenses, inventory value, and business profitability from one synchronized ledger."
        action={<MonthlyReportButton />}
      />
      <ErpConsole
        snapshot={snapshot}
        suppliers={suppliers}
        purchases={purchases}
        expenses={expenses}
        products={products}
      />
    </>
  );
}
