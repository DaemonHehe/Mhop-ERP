import { AdminRouteGuard } from "@/components/admin-route-guard";

export default function AlertsLayout({ children }: { children: React.ReactNode }) {
  return <AdminRouteGuard>{children}</AdminRouteGuard>;
}
