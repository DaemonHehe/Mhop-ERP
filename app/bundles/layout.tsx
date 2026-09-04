import { AdminRouteGuard } from "@/components/admin-route-guard";

export default function BundlesLayout({ children }: { children: React.ReactNode }) {
  return <AdminRouteGuard>{children}</AdminRouteGuard>;
}
