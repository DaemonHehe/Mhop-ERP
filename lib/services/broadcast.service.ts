import { db } from "@/db";
import { botSessions, customers, orders } from "@/db/schema";
import { audit } from "./audit.service";

export interface BroadcastRecipient {
  telegramUserId: string;
  name?: string;
}

export interface BroadcastAudience {
  totalCount: number;
  recipients: BroadcastRecipient[];
  botConfigured: boolean;
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
  if (!db) return { totalCount: 0, recipients: [], botConfigured };

  const [sessions, people, purchases] = await Promise.all([
    db.select({ telegramUserId: botSessions.telegramUserId }).from(botSessions),
    db.select({ telegramUserId: customers.telegramUserId, name: customers.name }).from(customers),
    db.select({ telegramUserId: orders.telegramUserId, customerName: orders.customerName }).from(orders),
  ]);

  const map = new Map<string, string | undefined>();

  // Add from bot sessions
  for (const s of sessions) {
    const id = s.telegramUserId?.trim();
    if (id && /^[0-9]+$/.test(id)) {
      map.set(id, undefined);
    }
  }

  // Enrich with names from customers
  for (const p of people) {
    const id = p.telegramUserId?.trim();
    if (id && /^[0-9]+$/.test(id)) {
      map.set(id, p.name || map.get(id));
    }
  }

  // Enrich with names from orders
  for (const o of purchases) {
    const id = o.telegramUserId?.trim();
    if (id && /^[0-9]+$/.test(id)) {
      map.set(id, o.customerName || map.get(id));
    }
  }

  const recipients = Array.from(map.entries()).map(([telegramUserId, name]) => ({
    telegramUserId,
    name,
  }));

  return {
    totalCount: recipients.length,
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

  const { recipients } = await getTelegramBroadcastAudience();
  if (recipients.length === 0) {
    return {
      ok: false,
      total: 0,
      sent: 0,
      blocked: 0,
      unreachable: 0,
      failed: 0,
      error: "No reachable Telegram customers found in database.",
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
    await audit(
      "telegram.broadcast_sent",
      undefined,
      `Broadcast delivered to ${sent}/${recipients.length} customers (${blocked} blocked, ${unreachable} unreachable, ${failed} failed): "${snippet}..."`,
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
