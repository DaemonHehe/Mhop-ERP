import Link from "next/link";
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link
      href="/dashboard"
      aria-label="MH OP home"
      className={`display text-xl font-bold tracking-tight ${light ? "text-white" : "text-black"}`}
    >
      MH<span className="text-[#ff6b35]">/</span>OP
    </Link>
  );
}
