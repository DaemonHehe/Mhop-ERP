export async function sendTelegramMessage(chatId: number, text: string) {
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
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
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
