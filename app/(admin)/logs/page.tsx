import { PageHeading } from "@/components/page-heading";
import { AuditLogConsole } from "@/components/audit-log-console";
import { getAuditLogsAction } from "@/app/actions/store";
export const dynamic = "force-dynamic";
export default async function Logs() {
  const logs = await getAuditLogsAction();
  return (
    <>
      <PageHeading
        eyebrow="Audit trail"
        title="Activity logs"
        description="A complete weekly history of staff decisions and business changes, organized by operational category."
      />
      <AuditLogConsole logs={logs} />
    </>
  );
}
