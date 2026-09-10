export interface TelegramSendOptions {
  reply_markup?: Record<string, unknown>;
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
}

export interface TelegramPhotoOptions {
  caption?: string;
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
  filename?: string;
  reply_markup?: Record<string, unknown>;
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

/** Send an in-memory PNG or JPEG through the customer bot as a Telegram photo. */

/**
 * Resolves a Telegram file_id to its direct download URL using the customer bot token.
 */
export async function getTelegramFileDownloadUrl(fileId: string): Promise<string | null> {
  const token = process.env.TELEGRAM_CUSTOMER_BOT_TOKEN;
  if (!token) return null;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`,
      { signal: AbortSignal.timeout(15_000) }
    );
    if (!res.ok) return null;

    const json = await res.json().catch(() => null);
    if (!json?.ok || !json.result?.file_path) return null;

    return `https://api.telegram.org/file/bot${token}/${json.result.file_path}`;
  } catch (err) {
    console.error("[getTelegramFileDownloadUrl error]", err);
    return null;
  }
}

export async function sendTelegramPhoto(
  chatId: number | string,
  photo: Uint8Array,
  extra: TelegramPhotoOptions = {},
) {
  const token = process.env.TELEGRAM_CUSTOMER_BOT_TOKEN;
  if (!token)
    return {
      delivered: false,
      reason: "TELEGRAM_CUSTOMER_BOT_TOKEN is not configured",
    };

  const form = new FormData();
  form.set("chat_id", String(chatId));
  form.set(
    "photo",
    new Blob([new Uint8Array(photo)], { type: "image/png" }),
    extra.filename || "mhop-receipt.png",
  );
  if (extra.caption) form.set("caption", extra.caption);
  if (extra.parse_mode) form.set("parse_mode", extra.parse_mode);
  if (extra.reply_markup) {
    form.set("reply_markup", JSON.stringify(extra.reply_markup));
  }

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendPhoto`,
    {
      method: "POST",
      signal: AbortSignal.timeout(20_000),
      body: form,
    },
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Telegram sendPhoto failed (${response.status}): ${detail.slice(0, 200)}`,
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
