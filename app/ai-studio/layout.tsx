import { AdminRouteGuard } from "@/components/admin-route-guard";

export default function AiStudioLayout({ children }: { children: React.ReactNode }) {
  return <AdminRouteGuard>{children}</AdminRouteGuard>;
}
