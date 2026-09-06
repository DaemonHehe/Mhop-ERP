export interface TelegramSendOptions {
  reply_markup?: Record<string, unknown>;
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
}

/**
 * Send a message via the Telegram Customer Bot to a private customer chat or group.
 */
export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  extra?: TelegramSendOptions,
) {
  const token = process.env.TELEGRAM_CUSTOMER_BOT_TOKEN;
  if (!token)
    return {
      delivered: false,
      reason: "TELEGRAM_CUSTOMER_BOT_TOKEN is not configured",
    };
  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
        ...(extra?.parse_mode ? { parse_mode: extra.parse_mode } : {}),
        ...(extra?.reply_markup ? { reply_markup: extra.reply_markup } : {}),
      }),
    },
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Telegram sendMessage failed (${response.status}): ${detail.slice(0, 200)}`,
    );
  }
  return { delivered: true };
}

/**
 * Send an operations notification message via the Telegram Manager/Ops Bot into the staff group.
 */
export async function sendTelegramOpsMessage(
  text: string,
  extra?: TelegramSendOptions,
) {
  const token = process.env.TELEGRAM_OPS_BOT_TOKEN || process.env.TELEGRAM_CUSTOMER_BOT_TOKEN;
  const staffChatId = process.env.TELEGRAM_STAFF_CHAT_ID;

  if (!token || !staffChatId) {
    return {
      delivered: false,
      reason: "TELEGRAM_OPS_BOT_TOKEN or TELEGRAM_STAFF_CHAT_ID is not configured",
    };
  }

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: staffChatId,
        text,
        disable_web_page_preview: true,
        ...(extra?.parse_mode ? { parse_mode: extra.parse_mode } : {}),
        ...(extra?.reply_markup ? { reply_markup: extra.reply_markup } : {}),
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Telegram Ops sendMessage failed (${response.status}): ${detail.slice(0, 200)}`,
    );
  }

  return { delivered: true };
}
