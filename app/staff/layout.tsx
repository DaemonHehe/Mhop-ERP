import { AdminRouteGuard } from "@/components/admin-route-guard";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <AdminRouteGuard roles={["admin"]}>{children}</AdminRouteGuard>;
}
