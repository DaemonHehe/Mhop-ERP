import { redirect } from "next/navigation";
import { authorizeStaff } from "@/lib/auth/authorize";

export async function AdminRouteGuard({
  children,
  roles = ["admin", "staff"],
}: {
  children: React.ReactNode;
  roles?: string[];
}) {
  const staff = await authorizeStaff();
  if (!staff) redirect("/login");
  if (!roles.includes(staff.role)) redirect("/dashboard");
  return children;
}
