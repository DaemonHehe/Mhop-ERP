import Link from "next/link";
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#171813] p-6 text-white">
      <div className="text-center">
        <p className="eyebrow !text-[#c7f36b]">404 · Route missing</p>
        <h1 className="display mt-4 text-6xl font-bold">
          Nothing stocked here.
        </h1>
        <p className="mt-4 text-sm text-white/50">
          The page may have moved or the address is incorrect.
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-block rounded-full bg-[#c7f36b] px-6 py-3 text-xs font-bold text-black"
        >
          Return to command center
        </Link>
      </div>
    </main>
  );
}
