const blocks = Array.from({ length: 4 });
const rows = Array.from({ length: 6 });

export function RouteSkeleton() {
  return (
    <section
      className="route-skeleton"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading page content"
    >
      <span className="sr-only">Loading page content…</span>
      <div className="skeleton-line h-3 w-28" />
      <div className="mt-4 flex items-end justify-between gap-6">
        <div className="min-w-0 flex-1">
          <div className="skeleton-line h-9 max-w-sm" />
          <div className="skeleton-line mt-3 h-4 max-w-2xl" />
        </div>
        <div className="skeleton-line hidden h-10 w-28 shrink-0 sm:block" />
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {blocks.map((_, index) => (
          <div className="skeleton-card" key={index}>
            <div className="skeleton-line h-3 w-20" />
            <div className="skeleton-line mt-6 h-9 w-28" />
            <div className="skeleton-line mt-4 h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="skeleton-panel mt-4">
        <div className="flex items-center justify-between gap-4 border-b border-black/5 pb-4">
          <div className="skeleton-line h-5 w-36" />
          <div className="skeleton-line h-9 w-24" />
        </div>
        <div className="mt-2 space-y-1">
          {rows.map((_, index) => (
            <div
              className="grid grid-cols-[1.2fr_.8fr_.65fr] gap-4 border-b border-black/5 py-4"
              key={index}
            >
              <div className="skeleton-line h-3" />
              <div className="skeleton-line h-3" />
              <div className="skeleton-line h-3" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
