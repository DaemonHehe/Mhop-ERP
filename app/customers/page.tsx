import { AppShell } from "@/components/app-shell";
import { CustomerDirectory } from "@/components/customer-directory";
import { PageHeading } from "@/components/page-heading";
import { getCustomersAction } from "@/app/actions/store";
export const dynamic = "force-dynamic";
export default async function Customers() {
  const customers = await getCustomersAction();
  return (
    <AppShell>
      <PageHeading
        eyebrow="Customer intelligence"
        title="Customer directory"
        description="Purchase history, lifetime value, warranties, and channel preferences in one view."
      />
      <CustomerDirectory customers={customers} />
    </AppShell>
  );
}
