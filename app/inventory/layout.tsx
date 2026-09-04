import { AdminRouteGuard } from "@/components/admin-route-guard";

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return <AdminRouteGuard>{children}</AdminRouteGuard>;
}
