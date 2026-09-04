export default function Loading() {
  return (
    <main className="min-h-screen bg-[#f4f2ec] p-8">
      <div className="mx-auto max-w-6xl animate-pulse">
        <div className="h-4 w-28 rounded bg-[#dcd9cf]" />
        <div className="mt-4 h-10 w-80 rounded bg-[#dcd9cf]" />
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 rounded-2xl bg-[#e5e2d9]" />
          ))}
        </div>
        <div className="mt-4 h-80 rounded-2xl bg-[#e5e2d9]" />
      </div>
    </main>
  );
}
