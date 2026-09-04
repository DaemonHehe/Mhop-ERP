import { getStaffAction } from "@/app/actions/admin";
import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { StaffConsole } from "@/components/staff-console";
import { authorizeStaff } from "@/lib/auth/authorize";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function StaffPage() {
  if (!(await authorizeStaff(["admin"]))) redirect("/dashboard");
  const staff = await getStaffAction();
  return (
    <AppShell>
      <PageHeading
        eyebrow="Administration"
        title="Staff & access"
        description="Create staff accounts, assign roles, reset credentials, and disable access without deleting audit history."
      />
      <StaffConsole staff={staff} />
    </AppShell>
  );
}
