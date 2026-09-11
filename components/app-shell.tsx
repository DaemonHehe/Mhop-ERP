"use client";
import { brandAssets } from "@/lib/brand-assets";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  ReceiptText,
  LifeBuoy,
  Users,
  ScrollText,
  Bell,
  ChevronDown,
  Menu,
  X,
  Building2,
  WandSparkles,
  Layers3,
  UserCog,
  Store,
  Bot,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "./logo";
import { LiveRefresh } from "./live-refresh";
import { GlobalSearch } from "./global-search";
import { clientConfig } from "@/lib/client-config";

const nav = [
  ["/dashboard", "Command center", LayoutDashboard],
  ["/inventory", "Products & Stock", Package],
  ["/bundles", "Bundle Sets", Layers3],
  ["/orders", "Orders", ShoppingBag],
  ["/erp", "ERP & Finance", Building2],
  ["/receipts", "Receipts", ReceiptText],
  ["/tickets", "Warranty & RMA", LifeBuoy],
  ["/customers", "Customers", Users],
  ["/bot", "Bot & Messages", Bot],
  ["/ai-studio", "AI Creative Studio", WandSparkles],
  ["/staff", "Staff & access", UserCog],
  ["/logs", "Activity logs", ScrollText],
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <LiveRefresh />
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px] lg:hidden"
        />
      )}
      <aside
        className={`app-sidebar fixed inset-y-0 left-0 z-50 w-[248px] overflow-y-auto p-5 pb-28 text-white transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between">
          <Logo light />
          <button onClick={() => setOpen(false)} className="lg:hidden">
            <X size={20} />
          </button>
        </div>
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[.045] p-3 shadow-[inset_2px_2px_8px_rgba(0,0,0,.28),inset_-1px_-1px_4px_rgba(255,255,255,.04)]">
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-white/45">
            Workspace
          </p>
          <div className="mt-2 flex items-center justify-between text-sm font-semibold">
            <span>MH OP Operations</span>
            <ChevronDown size={15} />
          </div>
        </div>
        <nav className="mt-7 space-y-1">
          {nav.map(([href, label, Icon]) => {
            const active = path === href;
            return (
              <Link
                key={href}
                href={href}
                prefetch
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
                onMouseEnter={() => router.prefetch(href)}
                onFocus={() => router.prefetch(href)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${active ? "bg-[#c7f36b] font-bold text-black" : "text-white/60 hover:bg-white/5 hover:text-white"}`}
              >
                <Icon size={17} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/10 bg-white/[.035] p-3 shadow-[inset_2px_2px_8px_rgba(0,0,0,.22)]">
          <div className="flex items-center gap-3">
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-white/20 bg-black shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
              <Image
                src={brandAssets.logo}
                alt="MH OP Admin"
                fill
                sizes="36px"
                className="object-contain"
              />
            </div>
            <div>
              <p className="text-sm font-semibold">MH OP Admin</p>
              <p className="text-[11px] text-white/45">Operations</p>
              <p className="mt-0.5 text-[9px] text-white/30">
                Built by {clientConfig.developer.name}
              </p>
            </div>
          </div>
        </div>
      </aside>
      <main className="app-main min-w-0 lg:col-start-2">
        <header className="app-topbar sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b px-3 sm:px-4 md:px-8">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl lg:hidden"
            >
              <Menu size={19} />
            </button>
            <GlobalSearch />
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/shop"
              aria-label="View store"
              className="pill grid h-11 w-11 place-items-center p-0 sm:flex sm:h-9 sm:w-auto sm:px-4 sm:py-2"
            >
              <Store size={15} />
              <span className="hidden sm:inline">View store</span>
            </Link>
            <Link
              href="/alerts"
              aria-label="Staff alerts"
              className="grid h-11 w-11 place-items-center rounded-xl border border-white/80 bg-white/55 shadow-[3px_4px_9px_rgba(70,68,58,.1),inset_0_1px_white] sm:h-9 sm:w-9 sm:rounded-full"
            >
              <Bell size={16} />
            </Link>
          </div>
        </header>
        <div
          key={path}
          className="route-content overflow-x-hidden p-4 pb-8 md:p-8"
        >
          {children}
        </div>
      </main>
    </div>
  );
}
