import { NextRequest, NextResponse } from "next/server";
import { getOrders } from "@/lib/services/order.service";
import { authorizeInternal } from "@/lib/api/internal-auth";
import { clientConfig } from "@/lib/client-config";
export async function GET(request: NextRequest) {
  if (!authorizeInternal(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const minDays = Math.min(
    89,
    Math.max(1, Number(request.nextUrl.searchParams.get("minDays") || 21)),
  );
  const maxDays = Math.min(
    90,
    Math.max(minDays + 1, Number(request.nextUrl.searchParams.get("maxDays") || 30)),
  );
  const now = Date.now();
  const oldestEligible = now - maxDays * 86400000;
  const newestEligible = now - minDays * 86400000;
  const orders = (await getOrders()).filter(
    (o) =>
      o.channel === "Telegram" &&
      o.payment.toLowerCase() === "verified" &&
      !!o.telegramUserId &&
      !!o.createdAt &&
      o.createdAt.getTime() >= oldestEligible &&
      o.createdAt.getTime() <= newestEligible,
  );
  return NextResponse.json(
    orders.map((o) => ({
      customer: o.customer,
      telegram_user_id: "telegramUserId" in o ? o.telegramUserId : null,
      order_code: "orderCode" in o ? o.orderCode : o.id,
      voucher: `MHOP${clientConfig.automation.discountPercent}-${o.id.slice(-4)}`,
      follow_up_window_days: clientConfig.automation.followUpDays,
      eligible_window: {
        min_days: minDays,
        max_days: maxDays,
      },
    })),
  );
}
