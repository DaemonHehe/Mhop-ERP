export interface SystemEvent {
  type: string;
  timestamp: string;
  data?: Record<string, unknown>;
}
type Listener = (event: SystemEvent) => void;
class EventHub {
  private listeners = new Set<Listener>();
  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  emit(type: string, data?: Record<string, unknown>) {
    const event = { type, timestamp: new Date().toISOString(), data };
    for (const listener of this.listeners) listener(event);
    const target = process.env.N8N_WEBHOOK_URL;
    const secret = process.env.N8N_WEBHOOK_SECRET;
    if (target && secret) {
      try {
        const url = new URL(target);
        if (process.env.NODE_ENV === "production" && url.protocol !== "https:")
          throw new Error("production N8N_WEBHOOK_URL must use HTTPS");
        void deliverEvent(url.toString(), secret, event);
      } catch (error) {
        console.warn(
          "[MH OP event delivery]",
          error instanceof Error ? error.message : error,
        );
      }
    }
    else if (target)
      console.warn("[MH OP event delivery] N8N_WEBHOOK_SECRET is required");
  }
}

async function deliverEvent(target: string, secret: string, event: SystemEvent) {
  const body = JSON.stringify(event);
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(body),
    );
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await fetch(target, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-mhop-automation-key": secret,
            "x-gadgetos-signature": `sha256=${Buffer.from(signature).toString("hex")}`,
          },
          body,
          signal: controller.signal,
        });
        if (response.ok) return;
        if (response.status < 500 && response.status !== 429)
          throw new Error(`n8n rejected event with status ${response.status}`);
      } catch (error) {
        if (attempt === 3) throw error;
      } finally {
        clearTimeout(timeout);
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    }
    throw new Error("n8n event delivery exhausted retries");
  } catch (error) {
    console.warn(
      "[MH OP event delivery]",
      error instanceof Error ? error.message : error,
    );
  }
}
const globalEvents = globalThis as typeof globalThis & {
  gadgetOSEvents?: EventHub;
};
export const systemEvents = globalEvents.gadgetOSEvents ?? new EventHub();
if (process.env.NODE_ENV !== "production")
  globalEvents.gadgetOSEvents = systemEvents;
export const emitSystemEvent = (type: string, data?: Record<string, unknown>) =>
  systemEvents.emit(type, data);
