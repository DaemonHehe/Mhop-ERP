import { AdminRouteGuard } from "@/components/admin-route-guard";

export default function CustomersLayout({ children }: { children: React.ReactNode }) {
  return <AdminRouteGuard>{children}</AdminRouteGuard>;
}
