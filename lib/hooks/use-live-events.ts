"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export function useLiveEvents(enabled = true) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled) return;
    const source = new EventSource("/api/events");
    source.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type !== "connected") router.refresh();
      } catch {}
    };
    return () => source.close();
  }, [enabled, router]);
}
