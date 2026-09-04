import { AdminRouteGuard } from "@/components/admin-route-guard";

export default function ErpLayout({ children }: { children: React.ReactNode }) {
  return <AdminRouteGuard>{children}</AdminRouteGuard>;
}
