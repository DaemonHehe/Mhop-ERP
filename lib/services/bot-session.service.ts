import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { botSessions, staffAlerts } from "@/db/schema";
import { sendTelegramOpsMessage } from "@/lib/telegram/bot";

export type BotConversationMessage = {
  role: "user" | "assistant";
  text: string;
  at: string;
};

export type BotSessionState = {
  shoppingAt?: string;
  privateChatId?: number;
  lastCommand?: string;
  lastSeenAt?: string;
  history?: BotConversationMessage[];
  mode?: "openai" | "safe_fallback";
  needsHuman?: boolean;
};

const cleanText = (value: string, max = 1_200) =>
  value
    .trim()
    .replace(
      /\b(password|passcode|otp|recovery\s*code)\s*[:=]\s*\S+/gi,
      "$1: [redacted]",
    )
    .slice(0, max);

function asState(value: unknown): BotSessionState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const candidate = value as BotSessionState;
  const history = Array.isArray(candidate.history)
    ? candidate.history
        .filter(
          (entry): entry is BotConversationMessage =>
            !!entry &&
            (entry.role === "user" || entry.role === "assistant") &&
            typeof entry.text === "string" &&
            typeof entry.at === "string",
        )
        .slice(-8)
    : [];
  return { ...candidate, history };
}

export async function getBotSessionState(
  telegramUserId: string,
): Promise<BotSessionState> {
  if (!db) return {};
  try {
    const [session] = await db
      .select({ state: botSessions.stateJson })
      .from(botSessions)
      .where(eq(botSessions.telegramUserId, telegramUserId))
      .orderBy(desc(botSessions.updatedAt))
      .limit(1);
    return asState(session?.state);
  } catch (error) {
    console.error("[MH OP bot session read]", error);
    return {};
  }
}

export async function updateBotSessionActivity(
  telegramUserId: string,
  patch: BotSessionState,
) {
  if (!db) return;
  try {
    const current = await getBotSessionState(telegramUserId);
    const state = { ...current, ...patch };
    await db
      .insert(botSessions)
      .values({ telegramUserId, stateJson: state })
      .onConflictDoUpdate({
        target: botSessions.telegramUserId,
        set: { stateJson: state, updatedAt: new Date() },
      });
  } catch (error) {
    console.error("[MH OP bot session write]", error);
  }
}

export async function saveBotConversationTurn(
  telegramUserId: string,
  userText: string,
  assistantText: string,
  mode: "openai" | "safe_fallback",
  needsHuman: boolean,
) {
  const current = await getBotSessionState(telegramUserId);
  const now = new Date().toISOString();
  const history = [
    ...(current.history || []),
    { role: "user" as const, text: cleanText(userText), at: now },
    {
      role: "assistant" as const,
      text: cleanText(assistantText),
      at: now,
    },
  ].slice(-8);
  await updateBotSessionActivity(telegramUserId, {
    lastCommand: cleanText(userText, 1_000),
    lastSeenAt: now,
    history,
    mode,
    needsHuman,
  });
}

export async function createSalesHandoffAlert(
  telegramUserId: string,
  customerMessage: string,
  extra?: { orderCode?: string; customerName?: string },
) {
  if (!db) return;
  try {
    const [existing] = await db
      .select({ id: staffAlerts.id })
      .from(staffAlerts)
      .where(
        and(
          eq(staffAlerts.type, "sales_agent_handoff"),
          eq(staffAlerts.targetCode, telegramUserId.slice(0, 80)),
          eq(staffAlerts.isRead, false),
        ),
      )
      .limit(1);

    if (!existing) {
      await db.insert(staffAlerts).values({
        type: "sales_agent_handoff",
        title: extra?.orderCode
          ? `Support Request: Order ${extra.orderCode}`
          : "Customer requested sales support",
        body: `Telegram ${telegramUserId}${extra?.customerName ? ` (${extra.customerName})` : ""}: ${cleanText(customerMessage, 300)}`,
        targetCode: telegramUserId.slice(0, 80),
      });
    }

    const cleanMsg = cleanText(customerMessage, 500) || "Requested customer support (/support)";
    const opsMessageLines = [
      "🆘 <b>Customer Support Request</b>",
      "",
      `👤 <b>Telegram User ID:</b> <code>${telegramUserId}</code>`,
      ...(extra?.customerName ? [`👤 <b>Customer Name:</b> ${extra.customerName}`] : []),
      ...(extra?.orderCode ? [`📦 <b>Order Code:</b> <code>${extra.orderCode}</code>`] : []),
      `💬 <b>Inquiry:</b> ${cleanMsg}`,
      "",
      "⚡️ Please check /alerts in admin or contact customer directly.",
    ];

    await sendTelegramOpsMessage(opsMessageLines.join("\n"), {
      parse_mode: "HTML",
    }).catch((err) => {
      console.error("[sendTelegramOpsMessage support error]", err);
    });
  } catch (error) {
    console.error("[MH OP sales handoff]", error);
  }
}
