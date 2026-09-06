import { AdminRouteGuard } from "@/components/admin-route-guard";
import { AppShell } from "@/components/app-shell";

export default function OperationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminRouteGuard>
      <AppShell>{children}</AppShell>
    </AdminRouteGuard>
  );
}
