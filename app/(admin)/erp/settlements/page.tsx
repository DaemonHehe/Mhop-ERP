import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { CourierSettlementView } from "@/components/courier-settlement-view";
import {
  getSettlementBatchesAction,
  getUnsettledOrdersAction,
} from "@/app/actions/store";

export const dynamic = "force-dynamic";

export default async function CourierSettlementsPage() {
  const [unsettledOrders, settlementBatches] = await Promise.all([
    getUnsettledOrdersAction(),
    getSettlementBatchesAction(),
  ]);

  return (
    <>
      <div className="mb-2">
        <Link
          href="/erp"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#77776f] transition hover:text-black"
        >
          <ArrowLeft size={13} /> Back to ERP & Finance
        </Link>
      </div>
      <PageHeading
        eyebrow="Courier finance"
        title="Royal Express Settlements"
        description="Reconcile bank payouts from Royal Express, allocate collected COD across orders, verify shipping deductions, and record settlements."
      />
      <CourierSettlementView
        unsettledOrders={unsettledOrders}
        settlementBatches={settlementBatches}
      />
    </>
  );
}
