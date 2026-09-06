import { getStaffAction } from "@/app/actions/admin";
import { PageHeading } from "@/components/page-heading";
import { StaffConsole } from "@/components/staff-console";
export const dynamic = "force-dynamic";
export default async function StaffPage() {
  const staff = await getStaffAction();
  return (
    <>
      <PageHeading
        eyebrow="Administration"
        title="Staff & access"
        description="Create staff accounts, assign roles, reset credentials, and disable access without deleting audit history."
      />
      <StaffConsole staff={staff} />
    </>
  );
}
