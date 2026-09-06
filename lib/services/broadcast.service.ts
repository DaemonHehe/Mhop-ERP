import { db } from "@/db";
import { botSessions, customers, orders } from "@/db/schema";
import { audit } from "./audit.service";

export interface BroadcastRecipient {
  telegramUserId: string;
  name?: string;
  phone?: string;
  orderCount: number;
  hasDelivered: boolean;
  hasActive: boolean;
  latestStatus?: string;
  latestOrderCode?: string;
}

export interface BroadcastAudience {
  totalCount: number;
  deliveredCount: number;
  activeCount: number;
  recipients: BroadcastRecipient[];
  botConfigured: boolean;
}

export interface BroadcastTargetOptions {
  segment?: "all" | "delivered" | "active" | "custom";
  selectedTelegramUserIds?: string[];
}

export interface BroadcastResult {
  ok: boolean;
  total: number;
  sent: number;
  blocked: number;
  unreachable: number;
  failed: number;
  error?: string;
  errors?: string[];
}

export async function getTelegramBroadcastAudience(): Promise<BroadcastAudience> {
  const botConfigured = Boolean(process.env.TELEGRAM_CUSTOMER_BOT_TOKEN);
  if (!db)
    return {
      totalCount: 0,
      deliveredCount: 0,
      activeCount: 0,
      recipients: [],
      botConfigured,
    };

  const [sessions, people, purchases] = await Promise.all([
    db.select({ telegramUserId: botSessions.telegramUserId }).from(botSessions),
    db
      .select({
        telegramUserId: customers.telegramUserId,
        name: customers.name,
        phone: customers.phone,
      })
      .from(customers),
    db
      .select({
        telegramUserId: orders.telegramUserId,
        customerName: orders.customerName,
        phone: orders.phone,
        fulfillmentStatus: orders.fulfillmentStatus,
        orderCode: orders.orderCode,
      })
      .from(orders),
  ]);

  interface RecipientAccumulator {
    name?: string;
    phone?: string;
    orderCount: number;
    hasDelivered: boolean;
    hasActive: boolean;
    latestStatus?: string;
    latestOrderCode?: string;
  }

  const map = new Map<string, RecipientAccumulator>();

  const getOrCreate = (id: string): RecipientAccumulator => {
    let rec = map.get(id);
    if (!rec) {
      rec = {
        orderCount: 0,
        hasDelivered: false,
        hasActive: false,
      };
      map.set(id, rec);
    }
    return rec;
  };

  // Add from bot sessions
  for (const s of sessions) {
    const id = s.telegramUserId?.trim();
    if (id && /^[0-9]+$/.test(id)) {
      getOrCreate(id);
    }
  }

  // Enrich with names and phones from customers
  for (const p of people) {
    const id = p.telegramUserId?.trim();
    if (id && /^[0-9]+$/.test(id)) {
      const rec = getOrCreate(id);
      if (p.name && !rec.name) rec.name = p.name;
      if (p.phone && !rec.phone) rec.phone = p.phone;
    }
  }

  // Enrich with orders (detecting delivered vs active)
  for (const o of purchases) {
    const id = o.telegramUserId?.trim();
    if (id && /^[0-9]+$/.test(id)) {
      const rec = getOrCreate(id);
      rec.orderCount += 1;
      if (o.customerName && !rec.name) rec.name = o.customerName;
      if (o.phone && !rec.phone) rec.phone = o.phone;
      if (o.orderCode) rec.latestOrderCode = o.orderCode;
      if (o.fulfillmentStatus) rec.latestStatus = o.fulfillmentStatus;

      if (o.fulfillmentStatus === "delivered") {
        rec.hasDelivered = true;
      }
      if (
        ["confirmed", "packing", "packed", "dispatched"].includes(
          o.fulfillmentStatus || "",
        )
      ) {
        rec.hasActive = true;
      }
    }
  }

  const recipients: BroadcastRecipient[] = Array.from(map.entries()).map(
    ([telegramUserId, data]) => ({
      telegramUserId,
      name: data.name,
      phone: data.phone,
      orderCount: data.orderCount,
      hasDelivered: data.hasDelivered,
      hasActive: data.hasActive,
      latestStatus: data.latestStatus,
      latestOrderCode: data.latestOrderCode,
    }),
  );

  const deliveredCount = recipients.filter((r) => r.hasDelivered).length;
  const activeCount = recipients.filter((r) => r.hasActive).length;

  return {
    totalCount: recipients.length,
    deliveredCount,
    activeCount,
    recipients,
    botConfigured,
  };
}

async function sendSingleBroadcast(
  token: string,
  chatId: number,
  text: string,
): Promise<{ status: "sent" | "blocked" | "unreachable" | "failed"; error?: string }> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });

    if (response.ok) {
      return { status: "sent" };
    }

    const payload = await response.json().catch(() => ({}));
    const description = typeof payload?.description === "string" ? payload.description : "";

    // User blocked the bot
    if (response.status === 403) {
      return { status: "blocked", error: description || "Blocked by user" };
    }

    // Chat not found or deactivated
    if (response.status === 400 && (description.includes("chat not found") || description.includes("deactivated"))) {
      return { status: "unreachable", error: description || "Chat not found or user deactivated" };
    }

    // Rate limited - wait and retry once
    if (response.status === 429) {
      const retryAfter = Number(payload?.parameters?.retry_after) || 1;
      await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfter * 1000, 5000)));
      const retryRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
        }),
      });
      if (retryRes.ok) return { status: "sent" };
    }

    return { status: "failed", error: `HTTP ${response.status}: ${description.slice(0, 100)}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "failed", error: message.slice(0, 100) };
  }
}

export async function sendTelegramBroadcast(
  text: string,
  actor = "staff",
  target?: BroadcastTargetOptions,
): Promise<BroadcastResult> {
  const content = text?.trim();
  if (!content) {
    return {
      ok: false,
      total: 0,
      sent: 0,
      blocked: 0,
      unreachable: 0,
      failed: 0,
      error: "Broadcast message text cannot be empty.",
    };
  }

  if (content.length > 4000) {
    return {
      ok: false,
      total: 0,
      sent: 0,
      blocked: 0,
      unreachable: 0,
      failed: 0,
      error: "Broadcast message exceeds 4,000 characters limit.",
    };
  }

  const token = process.env.TELEGRAM_CUSTOMER_BOT_TOKEN;
  if (!token) {
    return {
      ok: false,
      total: 0,
      sent: 0,
      blocked: 0,
      unreachable: 0,
      failed: 0,
      error: "TELEGRAM_CUSTOMER_BOT_TOKEN is not configured on this server.",
    };
  }

  const audience = await getTelegramBroadcastAudience();
  let recipients = audience.recipients;

  if (target?.segment === "delivered") {
    recipients = recipients.filter((r) => r.hasDelivered);
  } else if (target?.segment === "active") {
    recipients = recipients.filter((r) => r.hasActive);
  } else if (target?.segment === "custom" && target.selectedTelegramUserIds) {
    const selectedSet = new Set(target.selectedTelegramUserIds);
    recipients = recipients.filter((r) => selectedSet.has(r.telegramUserId));
  }

  if (recipients.length === 0) {
    return {
      ok: false,
      total: 0,
      sent: 0,
      blocked: 0,
      unreachable: 0,
      failed: 0,
      error: "No reachable Telegram customers found for the selected segment.",
    };
  }

  let sent = 0;
  let blocked = 0;
  let unreachable = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const recipient of recipients) {
    const chatId = Number(recipient.telegramUserId);
    if (!Number.isSafeInteger(chatId) || chatId <= 0) {
      unreachable++;
      continue;
    }

    const outcome = await sendSingleBroadcast(token, chatId, content);

    if (outcome.status === "sent") {
      sent++;
    } else if (outcome.status === "blocked") {
      blocked++;
    } else if (outcome.status === "unreachable") {
      unreachable++;
    } else {
      failed++;
      if (outcome.error && errors.length < 5) {
        errors.push(`${recipient.name || chatId}: ${outcome.error}`);
      }
    }

    // Rate pacing: 40ms pause between sends stays under ~25 msgs/sec (Telegram limit is 30/sec)
    await new Promise((resolve) => setTimeout(resolve, 40));
  }

  try {
    const snippet = content.slice(0, 80).replace(/\n/g, " ");
    const segmentLabel = target?.segment ? `[${target.segment}] ` : "";
    await audit(
      "telegram.broadcast_sent",
      undefined,
      `Broadcast delivered to ${sent}/${recipients.length} customers ${segmentLabel}(${blocked} blocked, ${unreachable} unreachable, ${failed} failed): "${snippet}..."`,
      actor,
    );
  } catch (auditErr) {
    console.error("[MH OP Broadcast Audit]", auditErr);
  }

  return {
    ok: sent > 0 || (blocked + unreachable === recipients.length),
    total: recipients.length,
    sent,
    blocked,
    unreachable,
    failed,
    errors: errors.length > 0 ? errors : undefined,
  };
}
