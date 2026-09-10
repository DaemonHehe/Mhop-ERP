import { db } from "@/db";
import { botSessions, customers, orders } from "@/db/schema";
import { sendTelegramMessage } from "@/lib/telegram/bot";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { audit } from "./audit.service";
import type { BotSessionState } from "./bot-session.service";
import { formatRecoveryReminder } from "./bot-settings.service";

export type RecoveryLead = {
  id: string;
  customerName: string;
  phone: string | null;
  telegramUserId: string | null;
  stage: "browsing" | "unpaid";
  detail: string;
  activityAt: Date;
};

export async function getRecoveryLeads(): Promise<RecoveryLead[]> {
  if (!db) return [];
  const [sessions, purchases, people] = await Promise.all([
    db.select().from(botSessions), db.select().from(orders), db.select().from(customers),
  ]);
  const result: RecoveryLead[] = [];
  for (const order of purchases) {
    const isUnpaid =
      order.customerPaymentStatus === "unpaid" ||
      order.customerPaymentStatus === "deposit_pending" ||
      order.paymentStatus === "pending";
    if (!isUnpaid || order.paymentSlipUrl ||
        !["new", "confirmed"].includes(order.fulfillmentStatus)) continue;
    const person = people.find((p) => p.id === order.customerId);
    const telegramId = order.telegramUserId || person?.telegramUserId || null;
    const session = sessions.find((entry) => entry.telegramUserId === telegramId);
    const shoppingAt = (session?.stateJson as BotSessionState | null)?.shoppingAt;
    const latestActivity = shoppingAt ? Date.parse(shoppingAt) : NaN;
    result.push({
      id: `order:${order.id}`, customerName: order.customerName, phone: order.phone,
      telegramUserId: order.telegramUserId || person?.telegramUserId || null,
      stage: "unpaid", detail: `Order ${order.orderCode} · Payment not completed`, activityAt: Number.isFinite(latestActivity) && latestActivity > order.createdAt.getTime() ? new Date(latestActivity) : order.createdAt,
    });
  }
  for (const session of sessions) {
    const state = session.stateJson as BotSessionState | null;
    if (!state?.shoppingAt || state.privateChatId !== Number(session.telegramUserId)) continue;
    const activityAt = new Date(state.shoppingAt);
    if (!Number.isFinite(activityAt.getTime())) continue;
    const person = people.find((p) => p.telegramUserId === session.telegramUserId);
    // An order after the inquiry supersedes browsing, including payment under review.
    if (purchases.some((o) => (o.telegramUserId === session.telegramUserId || o.customerId === person?.id) && o.createdAt >= activityAt)) continue;
    if (result.some((l) => l.telegramUserId === session.telegramUserId)) continue;
    result.push({ id: `session:${session.id}`, customerName: person?.name || `Telegram ${session.telegramUserId}`,
      phone: person?.phone || null, telegramUserId: session.telegramUserId, stage: "browsing",
      detail: "Catalog / sales inquiry · No purchase completed", activityAt });
  }
  return result.sort((a, b) => b.activityAt.getTime() - a.activityAt.getTime());
}

export function isAutomationRecoveryLead(lead: RecoveryLead, now = Date.now()) {
  return /^[1-9][0-9]*$/.test(lead.telegramUserId || "") &&
    Number.isSafeInteger(Number(lead.telegramUserId)) &&
    now - new Date(lead.activityAt).getTime() >= 15 * 60_000;
}

export async function sendRecoveryReminder(id: string, expectedActivityAt?: string) {
  const lead = (await getRecoveryLeads()).find((entry) => entry.id === id);
  if (expectedActivityAt && (!lead || !isAutomationRecoveryLead(lead) ||
      new Date(lead.activityAt).toISOString() !== expectedActivityAt))
    return { ok: true, skipped: true, reason: "Customer activity or purchase status changed" };
  if (!lead) return { ok: false, error: "This customer is no longer in the recovery queue. Refresh the page." };
  const chatId = Number(lead.telegramUserId);
  if (!Number.isSafeInteger(chatId) || chatId <= 0) return { ok: false, error: "No Telegram customer chat is linked." };
  if (!consumeRateLimit(`lead-reminder:${chatId}`, 1, 60_000))
    return { ok: false, error: "Please wait one minute before sending another reminder to this customer." };
  const text = await formatRecoveryReminder({
    stage: lead.stage,
    orderCode: lead.detail.split(" · ")[0],
    customer: lead.customerName,
  });
  try {
    const delivery = await sendTelegramMessage(chatId, text);
    if (!delivery.delivered) return { ok: false, error: "The Telegram customer sales bot is not configured." };
  } catch {
    return { ok: false, error: "Telegram could not confirm delivery. The customer may need to start or unblock the sales bot. Check the chat before retrying." };
  }
  try { await audit("lead.reminder_sent", id, "Customer sales bot reminder delivered"); } catch { /* Delivery already succeeded. */ }
  return { ok: true };
}
