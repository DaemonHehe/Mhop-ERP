import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { DataTable } from "@/components/data-table-responsive";
import { getAuditLogsAction } from "@/app/actions/store";
export const dynamic = "force-dynamic";
export default async function Logs() {
  const logs = await getAuditLogsAction();
  const rows = logs.map((l) => [
    l.createdAt.toLocaleTimeString("en-US", { timeZone: "Asia/Yangon" }),
    <code className="text-xs font-bold" key={l.id}>
      {l.event}
    </code>,
    l.actor,
    l.targetCode || "—",
    l.details,
  ]);
  return (
    <AppShell>
      <PageHeading
        eyebrow="Audit trail"
        title="Activity logs"
        description="An operational timeline for automations, staff decisions, and inventory events."
      />
      <DataTable
        headers={["Time", "Event", "Actor", "Target", "Details"]}
        rows={rows}
      />
    </AppShell>
  );
}
