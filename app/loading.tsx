import { RouteSkeleton } from "@/components/route-skeleton";

export default function Loading() {
  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <RouteSkeleton />
      </div>
    </main>
  );
}
