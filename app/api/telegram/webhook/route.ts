import { NextRequest, NextResponse } from "next/server";
import { getPublicCatalog } from "@/lib/services/stock.service";
import {
  getLatestPendingOrderByTelegramUser,
  getLatestOrderByTelegramUser,
  recordTelegramPaymentSlip,
} from "@/lib/services/order.service";
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
      parse_mode: extra.parse_mode as "HTML" | "Markdown" | "MarkdownV2" | undefined,
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
    let orderCode = text.match(/MHOP-\d{6}-[A-Z0-9]{4}/i)?.[0];
    let autoResolved = false;

    if (!orderCode) {
      const pendingOrder = await getLatestPendingOrderByTelegramUser(telegramUserId);
      if (pendingOrder) {
        orderCode = pendingOrder.orderCode;
        autoResolved = true;
      }
    }

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

    const confirmationText = autoResolved
      ? `✅ Order <b>${orderCode}</b> အတွက် Payment Slip ကို ချိတ်ဆက်လက်ခံရရှိပါသည်ခင်ဗျာ။\n\n${clientConfig.telegram.slipAcknowledgment}`
      : `✅ Order <b>${orderCode}</b>\n\n${clientConfig.telegram.slipAcknowledgment}`;

    return reply(
      chatId,
      stored.ok
        ? confirmationText
        : `Payment Slip ကို ချိတ်ဆက်၍မရပါခင်ဗျာ။ ${stored.error}`,
      { order_code: orderCode, stored: stored.ok, parse_mode: "HTML" },
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
    const supportQuery = text.replace(/^\/support(@\w+)?\s*/i, "").trim();
    let orderCode = supportQuery.match(/MHOP-\d{6}-[A-Z0-9]{4}/i)?.[0];
    const latestOrder = await getLatestOrderByTelegramUser(telegramUserId);

    if (!orderCode && latestOrder) {
      orderCode = latestOrder.orderCode;
    }

    await createSalesHandoffAlert(
      telegramUserId,
      supportQuery || "Customer requested support (/support)",
      { orderCode },
    );

    const adminUsername = clientConfig.receipt.telegram.replace(/^@/, "");
    const adminChatUrl = `https://t.me/${adminUsername}`;
    const viberPhone = clientConfig.receipt.viber;

    let orderInfoText = "";
    if (latestOrder) {
      const statusLabels: Record<string, string> = {
        new: "အော်ဒါအသစ် (New)",
        confirmed: "အတည်ပြုပြီး (Confirmed)",
        packing: "ပစ္စည်းထုပ်ပိုးဆဲ (Packing)",
        packed: "ထုပ်ပိုးပြီး (Packed)",
        dispatched: "ပို့ဆောင်ရေးသို့ လွှဲပြောင်းထားပြီး (Dispatched)",
        delivered: "ပို့ဆောင်ပြီး (Delivered)",
        cancelled: "ပယ်ဖျက်ထားသည် (Cancelled)",
      };
      const fulfillmentText =
        statusLabels[latestOrder.fulfillmentStatus] ||
        latestOrder.fulfillmentStatus;
      const paymentText =
        latestOrder.paymentStatus === "pending"
          ? "ငွေလွှဲစစ်ဆေးဆဲ (Pending)"
          : "ငွေပေးချေပြီး (Paid)";

      orderInfoText = [
        "📦 <b>လူကြီးမင်း၏ နောက်ဆုံး အော်ဒါ:</b>",
        `• Order Code: <code>${latestOrder.orderCode}</code>`,
        `• ငွေပေးချေမှု: ${paymentText}`,
        `• ပို့ဆောင်မှု: ${fulfillmentText}`,
        ...(latestOrder.trackingNumber
          ? [`• Tracking No: <code>${latestOrder.trackingNumber}</code>`]
          : []),
        "",
      ].join("\n");
    }

    const messageLines = [
      "🤝 <b>MH OP Customer Support</b>",
      "",
      supportQuery
        ? "လူကြီးမင်း ပေးပို့ထားသော မေးမြန်းချက်/ပြဿနာကို Customer Support Team ထံ လွှဲပြောင်းပေးထားပါပြီခင်ဗျာ။ Admin မှ မကြာမီ ပြန်လည်ဆက်သွယ်ပေးပါမည်။"
        : "ကြုံတွေ့နေသော ပြဿနာ သို့မဟုတ် မေးမြန်းလိုသည်များကို စာတိုပေးပို့ထားနိုင်ပါသည်ခင်ဗျာ။ Support Team မှ အမြန်ဆုံး စစ်ဆေးပေးပါမည်။",
      "",
      ...(orderInfoText ? [orderInfoText] : []),
      "📞 <b>တိုက်ရိုက် ဆက်သွယ်ရန် လိုင်းများ:</b>",
      `• Telegram Admin: ${clientConfig.receipt.telegram}`,
      `• Viber / Phone: <code>${viberPhone}</code>`,
      "• ဝန်ဆောင်မှုအချိန်: 9:00 AM – 8:00 PM",
    ];

    return reply(chatId, messageLines.join("\n"), {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "💬 Chat with Admin",
              url: adminChatUrl,
            },
            {
              text: "🛍️ MH OP Store",
              web_app: { url: shopMiniAppUrl },
            },
          ],
          [
            {
              text: "🛡️ Check Warranty",
              callback_data: "/warranty",
            },
          ],
        ],
      },
    });
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
