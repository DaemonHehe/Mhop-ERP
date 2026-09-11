"use client";
import { useEffect, useRef, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

const routeTopics: Record<string, string[]> = {
  "/inventory": [
    "catalog.",
    "inventory.",
    "account.",
    "device.",
    "purchase.received",
    "ticket.resolved",
  ],
  "/bundles": ["bundle.", "catalog.", "stock."],
  "/orders": ["order.", "payment.", "device."],
  "/erp": ["supplier.", "purchase.", "expense.", "ticket.resolved"],
  "/receipts": ["order.", "payment.", "fulfillment."],
  "/tickets": ["ticket.", "order."],
  "/customers": ["customer.", "order.", "payment.", "ticket."],
  "/ai-studio": ["catalog.", "inventory."],
  "/alerts": [
    "alert.",
    "order.",
    "payment.",
    "catalog.",
    "inventory.",
    "purchase.",
    "ticket.",
  ],
  "/staff": ["staff."],
};

function isRelevant(pathname: string, eventType: string) {
  if (pathname === "/dashboard" || pathname === "/logs") return true;
  const topics = routeTopics[pathname];
  return !topics || topics.some((topic) => eventType.startsWith(topic));
}

export function useLiveEvents(enabled = true) {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, startTransition] = useTransition();
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);
  useEffect(() => {
    if (!enabled) return;
    const source = new EventSource("/api/events");
    source.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (
          typeof message.type !== "string" ||
          message.type === "connected" ||
          document.visibilityState !== "visible" ||
          !isRelevant(pathnameRef.current, message.type)
        )
          return;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          startTransition(() => router.refresh());
        }, 250);
      } catch {}
    };
    return () => {
      source.close();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled, router, startTransition]);
}
