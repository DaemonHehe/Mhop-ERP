import { AdminRouteGuard } from "@/components/admin-route-guard";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AdminRouteGuard>{children}</AdminRouteGuard>;
}
