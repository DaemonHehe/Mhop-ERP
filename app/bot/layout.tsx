import { AdminRouteGuard } from "@/components/admin-route-guard";

export default function BotLayout({ children }: { children: React.ReactNode }) {
  return <AdminRouteGuard>{children}</AdminRouteGuard>;
}
