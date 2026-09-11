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
import {
  linkCustomerTelegram,
  getOrCreateTelegramCustomer,
  generateCustomerCode,
} from "@/lib/services/customer.service";
import { clientConfig } from "@/lib/client-config";
import { sendTelegramMessage, sendTelegramPhoto } from "@/lib/telegram/bot";
import { telegramUpdateSchema } from "@/lib/validation/schemas";
import { answerSalesQuestion } from "@/lib/ai/sales-agent";
import { allowRequest } from "@/lib/security/rate-limit";
import {
  formatWelcomeMessage,
  formatSlipAcknowledgment,
} from "@/lib/services/bot-settings.service";
import { renderMemberCardImage } from "@/lib/services/member-card-image";
import { getCardTier, TIERS } from "@/lib/loyalty";

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

async function replyPhoto(
  chatId: number,
  photo: Uint8Array,
  caption: string,
  extra: Record<string, unknown> = {},
) {
  try {
    const delivery = await sendTelegramPhoto(chatId, photo, {
      caption,
      parse_mode: (extra.parse_mode as "HTML" | "Markdown" | "MarkdownV2") || "HTML",
      filename: (extra.filename as string) || "mhop-vip-member-card.png",
      reply_markup: extra.reply_markup as Record<string, unknown> | undefined,
    });
    if (!delivery.delivered && delivery.reason) {
      // Fallback gracefully to text if photo delivery cannot be made
      return reply(chatId, caption, extra);
    }
    return NextResponse.json({
      ok: true,
      action: "send_photo",
      chat_id: chatId,
      caption,
      ...extra,
      ...delivery,
    });
  } catch (error) {
    console.error(
      "[MH OP Telegram Photo Delivery Failed]",
      error instanceof Error ? error.message : error,
    );
    return reply(chatId, caption, extra);
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

    const slipAck = await formatSlipAcknowledgment({ orderCode });
    const confirmationText = autoResolved
      ? `✅ Order <b>${orderCode}</b> အတွက် Payment Slip ကို ချိတ်ဆက်လက်ခံရရှိပါသည်ခင်ဗျာ။\n\n${slipAck}`
      : `✅ Order <b>${orderCode}</b>\n\n${slipAck}`;

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

  if (text.startsWith("/start")) {
    const telegramUsername =
      message?.from?.username || callback?.from?.username || null;
    const telegramName =
      [message?.from?.first_name, message?.from?.last_name]
        .filter(Boolean)
        .join(" ") ||
      (telegramUsername ? `@${telegramUsername}` : null) ||
      callback?.from?.first_name ||
      "Valued Customer";

    await getOrCreateTelegramCustomer({
      telegramUserId,
      telegramUsername,
      displayName: telegramName,
    });

    const welcomeText = await formatWelcomeMessage();
    return reply(chatId, welcomeText, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🛍️ Open MH OP Store",
              web_app: { url: shopMiniAppUrl },
            },
            {
              text: "👑 VIP Member Card",
              callback_data: "cmd:member",
            },
          ],
        ],
      },
    });
  }
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
  if (callback?.data === "cmd:tier_perks") {
    return reply(
      chatId,
      [
        "💎 <b>MH OP VIP Privilege Club · Tiers & Perks</b>",
        "",
        "ဝယ်ယူသုံးစွဲမှု 1,000 MMK တိုင်းအတွက် 1 Point ရရှိပါမည်။",
        "",
        "• 👤 <b>CLASSIC (0–199 pts)</b>",
        "  — ပုံမှန် အသင်းဝင်နှုန်းထား",
        "",
        "• 🥈 <b>SILVER VIP (200–499 pts)</b>",
        "  — မြန်မာတစ်နိုင်ငံလုံး ပို့ဆောင်ခ အခမဲ့ (Free Delivery)",
        "",
        "• 🥇 <b>GOLD VIP (500–1,000 pts)</b>",
        "  — Free Delivery + ပစ္စည်းတန်ဖိုး <b>5% VIP Discount</b>",
        "",
        "• 💎 <b>PLATINUM VIP (1,001+ pts)</b>",
        "  — Free Delivery + ပစ္စည်းတန်ဖိုး <b>10% VIP Discount</b>",
        "",
        "လူကြီးမင်း၏ VIP Card ကို ကြည့်ရှုရန် အောက်ပါ ခလုတ်ကို နှိပ်ပါခင်ဗျာ။",
      ].join("\n"),
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "👑 My VIP Card", callback_data: "cmd:member" },
              { text: "🛍️ Open MH OP Store", web_app: { url: shopMiniAppUrl } },
            ],
          ],
        },
      },
    );
  }

  if (callback?.data === "cmd:link_phone") {
    return reply(
      chatId,
      [
        "📱 <b>MH OP Account & Points ချိတ်ဆက်ခြင်း</b>",
        "",
        "ယခင်က MH OP တွင် ဝယ်ယူစဉ် အသုံးပြုခဲ့သော ဖုန်းနံပါတ် (ဥပမာ <code>09123456789</code>) ကို ဤ Chat ထဲသို့ ပေးပို့ပေးပါခင်ဗျာ။",
        "",
        "စနစ်မှ လူကြီးမင်း၏ ဖုန်းနံပါတ်ဖြင့် ဝယ်ယူမှုမှတ်တမ်းများနှင့် Point များကို Telegram အကောင့်နှင့် ချိတ်ဆက်ပေးပြီး VIP Member Card အသစ်ကို ထုတ်ပေးပါမည်။",
      ].join("\n"),
      { parse_mode: "HTML" },
    );
  }

  // Handle direct phone number input to link account
  const rawPhoneMatch = text.replace(/[\s\-()]/g, "").match(/^(09|\+?959)\d{7,9}$/);
  const phoneCandidate = message?.contact?.phone_number || (rawPhoneMatch ? rawPhoneMatch[0] : null);
  if (phoneCandidate) {
    const telegramUsername =
      message?.from?.username || callback?.from?.username || null;
    const telegramName =
      [message?.from?.first_name, message?.from?.last_name]
        .filter(Boolean)
        .join(" ") ||
      (telegramUsername ? `@${telegramUsername}` : null) ||
      "VIP Member";

    const linkResult = await linkCustomerTelegram(
      phoneCandidate,
      telegramUserId,
      telegramUsername,
      telegramName,
    );

    if (linkResult.success) {
      const customerCode =
        linkResult.profile.customerCode || generateCustomerCode(telegramUserId.slice(-4));
      const cardBuffer = await renderMemberCardImage({
        customerName: linkResult.profile.name || telegramName,
        memberId: customerCode,
        phone: linkResult.profile.phone,
        tier: linkResult.profile.tier,
        points: linkResult.profile.points,
      });

      return replyPhoto(
        chatId,
        cardBuffer,
        [
          `✅ <b>ဖုန်းနံပါတ် ချိတ်ဆက်မှု အောင်မြင်ပါသည်!</b>`,
          ``,
          `ဖုန်းနံပါတ် <code>${phoneCandidate}</code> ကို လူကြီးမင်း၏ Telegram အကောင့်နှင့် အောင်မြင်စွာ ချိတ်ဆက်ပြီးပါပြီခင်ဗျာ။`,
          ``,
          `• Customer ID: <code>${customerCode}</code>`,
          `• အသင်းဝင်: <b>${linkResult.profile.name || telegramName}</b>`,
          ...(telegramUsername ? [`• Telegram Tag: <b>@${telegramUsername.replace(/^@/, "")}</b>`] : []),
          `• စုစုပေါင်း Point: <b>${linkResult.profile.points.toLocaleString()} PTS</b>`,
          `• လက်ရှိအဆင့်: <b>${linkResult.profile.tierName} (${linkResult.profile.burmeseName})</b>`,
        ].join("\n"),
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "🛍️ Open MH OP Store", web_app: { url: shopMiniAppUrl } },
                { text: "👑 My VIP Card", callback_data: "cmd:member" },
              ],
            ],
          },
        },
      );
    }
  }

  // Handle /member, /card, /vip, /points, /tier commands
  if (
    text.startsWith("/member") ||
    text.startsWith("/card") ||
    text.startsWith("/vip") ||
    text.startsWith("/points") ||
    text.startsWith("/tier") ||
    callback?.data === "cmd:member" ||
    callback?.data === "cmd:refresh_card"
  ) {
    const telegramUsername =
      message?.from?.username || callback?.from?.username || null;
    const telegramName =
      [message?.from?.first_name, message?.from?.last_name]
        .filter(Boolean)
        .join(" ") ||
      (telegramUsername ? `@${telegramUsername}` : null) ||
      callback?.from?.first_name ||
      "Valued Member";

    // Auto-resolve or create customer record storing unique customerCode & telegram tag
    const loyalty = await getOrCreateTelegramCustomer({
      telegramUserId,
      telegramUsername,
      displayName: telegramName,
    });

    const customerName = loyalty.name || telegramName;
    const customerCode =
      loyalty.customerCode || generateCustomerCode(telegramUserId.slice(-4));
    const currentPoints = loyalty.points || 0;
    const currentTier = loyalty.tier || "member";
    const tierDef = TIERS[currentTier] || TIERS.member;
    const cardTier = getCardTier(currentTier, currentPoints);
    const isPhoneLinked = Boolean(loyalty.phone && !loyalty.phone.startsWith("TG-"));

    const cardBuffer = await renderMemberCardImage({
      customerName,
      memberId: customerCode,
      phone: loyalty.phone,
      tier: cardTier,
      points: currentPoints,
    });

    const percent = loyalty.progress.percentToNext || 0;
    const filledBars = Math.min(10, Math.max(0, Math.round(percent / 10)));
    const emptyBars = 10 - filledBars;
    const progressBar = `[${"▓".repeat(filledBars)}${"░".repeat(emptyBars)}] ${percent}%`;

    const nextTierText = loyalty.progress.nextTier
      ? `🚀 နောက်တစ်ဆင့် (<b>${loyalty.progress.nextTier.toUpperCase()} VIP</b>) သို့ ရောက်ရှိရန် <b>${loyalty.progress.pointsNeeded.toLocaleString()} pts</b> လိုအပ်ပါသည်ခင်ဗျာ။\n${progressBar}`
      : "🏆 <b>ဂုဏ်ယူပါတယ်!</b> လူကြီးမင်းသည် အမြင့်ဆုံး VIP အဆင့်သို့ ရောက်ရှိပြီးဖြစ်ပါသည်ခင်ဗျာ။";

    const caption = [
      `👑 <b>MH OP VIP MEMBERSHIP CARD</b>`,
      ``,
      `• Customer ID: <code>${customerCode}</code>`,
      `• အသင်းဝင်: <b>${customerName}</b>`,
      ...(loyalty.telegramUsername ? [`• Telegram Tag: <b>@${loyalty.telegramUsername.replace(/^@/, "")}</b>`] : []),
      ...(isPhoneLinked && loyalty.phone ? [`• ဖုန်းနံပါတ်: <code>${loyalty.phone}</code>`] : []),
      `• လက်ရှိအဆင့်: ${tierDef.icon} <b>${tierDef.cardTitle} (${tierDef.burmeseName})</b>`,
      `• စုစုပေါင်း Point: <b>${currentPoints.toLocaleString()} PTS</b>`,
      ``,
      `✨ <b>ခံစားခွင့်များ:</b>`,
      loyalty.perks.freeDelivery
        ? `✅ ပို့ဆောင်ခ အခမဲ့ (Free Delivery across Myanmar)`
        : `• ပုံမှန် ပို့ဆောင်ခနှုန်းထား`,
      loyalty.perks.discountPercent > 0
        ? `✅ ပစ္စည်းတန်ဖိုး ${loyalty.perks.discountPercent}% VIP လျှော့စျေး`
        : ``,
      ``,
      nextTierText,
      ``,
      `<i>(1,000 MMK သုံးစွဲတိုင်း 1 Point ရရှိပါမည်)</i>`,
    ]
      .filter(Boolean)
      .join("\n");

    const inlineKeyboard = [
      [
        {
          text: "🛍️ Open MH OP Store",
          web_app: { url: shopMiniAppUrl },
        },
        {
          text: "🔄 Refresh Card",
          callback_data: "cmd:refresh_card",
        },
      ],
      [
        ...(!isPhoneLinked
          ? [
              {
                text: "📱 Link Phone (Claim Points)",
                callback_data: "cmd:link_phone",
              },
            ]
          : []),
        {
          text: "💎 View Tier Privileges",
          callback_data: "cmd:tier_perks",
        },
      ],
    ];

    return replyPhoto(chatId, cardBuffer, caption, {
      reply_markup: { inline_keyboard: inlineKeyboard },
    });
  }
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
