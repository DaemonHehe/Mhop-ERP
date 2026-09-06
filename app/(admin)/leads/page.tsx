import { LeadConsole } from "@/components/lead-console";
import { PageHeading } from "@/components/page-heading";
import { getLeadsAction } from "@/app/actions/store";

export const dynamic = "force-dynamic";
export default async function Leads() {
  const leads = await getLeadsAction();
  return (
    <>
      <PageHeading
        eyebrow="Customer follow-up"
        title="Leads & recovery"
        description="Customers who checked the catalog or started buying but have not completed their purchase."
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {[
          [
            "Open leads",
            String(
              leads
                .length,
            ),
          ],
          [
            "Browsing catalog",
            String(leads.filter((l) => l.stage === "browsing").length),
          ],
          [
            "Awaiting payment",
            String(leads.filter((l) => l.stage === "unpaid").length),
          ],
        ].map(([label, value]) => (
          <div className="card p-5" key={label}>
            <p className="eyebrow">{label}</p>
            <p className="metric mt-4">{value}</p>
          </div>
        ))}
      </div>
      <LeadConsole leads={leads} />
    </>
  );
}
