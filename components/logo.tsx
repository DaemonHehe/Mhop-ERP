import { brandAssets } from "@/lib/brand-assets";
import Link from "next/link";
import Image from "next/image";

export function Logo({
  light = false,
  showText = true,
  href,
  className = "",
}: {
  light?: boolean;
  showText?: boolean;
  href?: string;
  className?: string;
}) {
  const targetHref = href ?? (light ? "/dashboard" : "/shop");
  return (
    <Link
      href={targetHref}
      aria-label="MH OP home"
      className={`group inline-flex items-center gap-2.5 transition-opacity hover:opacity-90 ${className}`}
    >
      <div
        className={`relative h-10 ${showText ? "w-28" : "w-10"} shrink-0 overflow-hidden rounded-xl border ${
          light ? "border-white/20 bg-black" : "border-black/15 bg-black"
        } shadow-sm transition-transform duration-200 group-hover:scale-105`}
      >
        <Image
          src={brandAssets.logo}
          alt="MH OP Logo"
          fill
          sizes={showText ? "112px" : "40px"}
          className="object-cover"
          priority
        />
      </div>

    </Link>
  );
}
