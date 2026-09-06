import { NextRequest, NextResponse } from "next/server";
import { getPublicCatalog } from "@/lib/services/stock.service";
import { recordTelegramPaymentSlip } from "@/lib/services/order.service";
import {
  createSalesHandoffAlert,
  getBotSessionState,
  saveBotConversationTurn,
  updateBotSessionActivity,
} from "@/lib/services/bot-session.service";
import { clientConfig } from "@/lib/client-config";
import { sendTelegramMessage } from "@/lib/telegram/bot";
import { telegramUpdateSchema } from "@/lib/validation/schemas";
import { answerSalesQuestion } from "@/lib/ai/sales-agent";
import { allowRequest } from "@/lib/security/rate-limit";

function authorized(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("x-telegram-bot-api-secret-token") === secret;
}
async function reply(
  chatId: number,
  text: string,
  extra: Record<string, unknown> = {},
) {
  try {
    const delivery = await sendTelegramMessage(chatId, text, {
      reply_markup: extra.reply_markup as Record<string, unknown> | undefined,
    });
    return NextResponse.json({
      ok: true,
      action: "send_message",
      chat_id: chatId,
      text,
      ...extra,
      ...delivery,
    });
  } catch (error) {
    console.error(
      "[MH OP Telegram]",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { ok: false, error: "Telegram delivery failed" },
      { status: 502 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!authorized(request))
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  const parsed = telegramUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, error: "Invalid Telegram update" },
      { status: 400 },
    );
  const message = parsed.data.message;
  const callback = parsed.data.callback_query;
  const chatId = message?.chat.id || callback?.message?.chat.id;
  const userId = message?.from?.id || callback?.from.id;
  if (!chatId || !userId)
    return NextResponse.json({ ok: true, status: "ignored" });
  const text = (
    message?.text ||
    message?.caption ||
    callback?.data ||
    ""
  ).trim();
  const telegramUserId = String(userId);
  await updateBotSessionActivity(telegramUserId, {
    lastCommand: text,
    lastSeenAt: new Date().toISOString(),
    ...(chatId === userId && !message?.photo?.length &&
      (text.startsWith("/catalog") || text.startsWith("/shop") || (text && !text.startsWith("/")))
      ? { shoppingAt: new Date().toISOString(), privateChatId: chatId }
      : {}),
  });

  if (message?.photo?.length) {
    const orderCode = text.match(/MHOP-\d{6}-[A-Z0-9]{4}/i)?.[0];
    if (!orderCode)
      return reply(
        chatId,
        "Payment Slip ပုံ၏ caption တွင် Order Code (ဥပမာ MHOP-260829-AB12) ကို ထည့်ပေးပါခင်ဗျာ။",
      );
    const fileId = message.photo.at(-1)?.file_id || "";
    const stored = await recordTelegramPaymentSlip(
      orderCode,
      fileId,
      String(userId),
    );
    return reply(
      chatId,
      stored.ok
        ? clientConfig.telegram.slipAcknowledgment
        : `Payment Slip ကို ချိတ်ဆက်၍မရပါခင်ဗျာ။ ${stored.error}`,
      { order_code: orderCode, stored: stored.ok },
    );
  }
  if (message?.voice)
    return reply(
      chatId,
      "Voice ordering မဖွင့်ရသေးပါခင်ဗျာ။ စာသားဖြင့် ပစ္စည်းအမည် သို့မဟုတ် မေးခွန်းကို ပေးပို့နိုင်ပါတယ်။",
    );
  const appBaseUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  const shopMiniAppUrl = `${appBaseUrl}/shop`;

  if (text.startsWith("/start"))
    return reply(chatId, clientConfig.telegram.welcome, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🛍️ Open MH OP Store",
              web_app: { url: shopMiniAppUrl },
            },
          ],
        ],
      },
    });
  if (text.startsWith("/catalog")) {
    const stock = (await getPublicCatalog())
      .filter((p) => p.availability !== "sold_out")
      .slice(0, 12);
    return reply(
      chatId,
      [
        "MH OP · ရရှိနိုင်သော Gaming Gadgets & PUBG Accounts",
        ...stock.map((p) => `• ${p.name} — ${p.price.toLocaleString()} MMK`),
      ].join("\n"),
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🛒 Open Catalog Mini App",
                web_app: { url: shopMiniAppUrl },
              },
            ],
          ],
        },
      },
    );
  }
  if (text.startsWith("/shop"))
    return reply(
      chatId,
      `MH OP Store ပစ္စည်းများ ကြည့်ရှုဝယ်ယူရန် အောက်ပါ ခလုတ်ကို နှိပ်၍ Mini App ဖွင့်နိုင်ပါသည်ခင်ဗျာ။`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🛍️ Open MH OP Store (Mini App)",
                web_app: { url: shopMiniAppUrl },
              },
            ],
          ],
        },
      },
    );
  if (text.startsWith("/warranty"))
    return reply(
      chatId,
      "Order code နှင့် ဝယ်ယူစဉ်သုံးခဲ့သော ဖုန်းနံပါတ်ကို ပေးပို့ပါခင်ဗျာ။ Warranty record ကို စစ်ဆေးပေးပါမယ်။",
    );
  if (text.startsWith("/support")) {
    await createSalesHandoffAlert(telegramUserId, text || "Support command");
    return reply(
      chatId,
      "ကြုံတွေ့နေသော ပြဿနာနှင့် order code ကို ပေးပို့ပါခင်ဗျာ။ Admin Team က ဆက်သွယ်ပေးပါမယ်။",
    );
  }
  if (!text)
    return reply(chatId, "မေးလိုသည့် ပစ္စည်း သို့မဟုတ် budget ကို စာသားဖြင့် ပေးပို့ပါခင်ဗျာ။");
  if (!(await allowRequest("telegram-sales-agent", 20, 5 * 60_000, telegramUserId)))
    return reply(
      chatId,
      "မေးခွန်းများ ဆက်တိုက်များနေပါသဖြင့် ခဏစောင့်ပြီး ထပ်မေးပေးပါခင်ဗျာ။ /catalog ကိုလည်း ကြည့်နိုင်ပါတယ်။",
    );

  const state = await getBotSessionState(telegramUserId);
  const result = await answerSalesQuestion({
    question: text,
    customerId: telegramUserId,
    history: state.history,
  });
  await saveBotConversationTurn(
    telegramUserId,
    text,
    result.reply,
    result.mode,
    result.needsHuman,
  );
  if (result.needsHuman) {
    await createSalesHandoffAlert(telegramUserId, text);
  }
  return reply(chatId, result.reply, {
    advisor_mode: result.mode,
    human_handoff: result.needsHuman,
  });
}
