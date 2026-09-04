import { AdminRouteGuard } from "@/components/admin-route-guard";

export default function ReceiptsLayout({ children }: { children: React.ReactNode }) {
  return <AdminRouteGuard>{children}</AdminRouteGuard>;
}
