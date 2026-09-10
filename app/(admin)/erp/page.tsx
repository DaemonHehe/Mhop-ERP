import Link from "next/link";
import { Truck } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { ErpConsole } from "@/components/erp-console";
import { MonthlyReportButton } from "@/components/monthly-report-button";
import { getErpDataAction } from "@/app/actions/erp";
import { getInventoryAction } from "@/app/actions/store";
import { formatMMK } from "@/lib/data";
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
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/erp/settlements"
              className="flex items-center gap-1.5 rounded-xl border border-[#dedbd0] bg-white px-3.5 py-2.5 text-xs font-bold text-black shadow-xs transition hover:bg-[#eae8df]"
            >
              <Truck size={14} /> Royal Settlements
              {snapshot.expectedRoyalPayment > 0 && (
                <span className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-800">
                  {formatMMK(snapshot.expectedRoyalPayment)}
                </span>
              )}
            </Link>
            <MonthlyReportButton />
          </div>
        }
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
