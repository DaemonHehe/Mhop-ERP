import { AdminRouteGuard } from "@/components/admin-route-guard";

export default function LogsLayout({ children }: { children: React.ReactNode }) {
  return <AdminRouteGuard>{children}</AdminRouteGuard>;
}
