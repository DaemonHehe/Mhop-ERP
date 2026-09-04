import { AdminRouteGuard } from "@/components/admin-route-guard";

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return <AdminRouteGuard>{children}</AdminRouteGuard>;
}
