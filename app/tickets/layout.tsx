import { AdminRouteGuard } from "@/components/admin-route-guard";

export default function TicketsLayout({ children }: { children: React.ReactNode }) {
  return <AdminRouteGuard>{children}</AdminRouteGuard>;
}
