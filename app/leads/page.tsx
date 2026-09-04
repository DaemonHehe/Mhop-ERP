import { AppShell } from "@/components/app-shell";
import { LeadConsole } from "@/components/lead-console";
import { PageHeading } from "@/components/page-heading";
import { getLeadsAction } from "@/app/actions/store";

export const dynamic = "force-dynamic";
export default async function Leads() {
  const leads = await getLeadsAction();
  return (
    <AppShell>
      <PageHeading
        eyebrow="Sales pipeline"
        title="Leads & recovery"
        description="Turn product questions and abandoned carts into timely, helpful follow-ups."
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {[
          [
            "Open leads",
            String(
              leads.filter((l) => l.stage !== "converted" && l.stage !== "lost")
                .length,
            ),
          ],
          [
            "Recovery queue",
            String(leads.filter((l) => l.stage === "new").length),
          ],
          [
            "Converted",
            String(leads.filter((l) => l.stage === "converted").length),
          ],
        ].map(([label, value]) => (
          <div className="card p-5" key={label}>
            <p className="eyebrow">{label}</p>
            <p className="metric mt-4">{value}</p>
          </div>
        ))}
      </div>
      <LeadConsole leads={leads} />
    </AppShell>
  );
}
