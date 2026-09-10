import { NextRequest, NextResponse } from "next/server";
import {
  getDashboardSnapshot,
  getInventory,
} from "@/lib/services/stock.service";
import { getOrders } from "@/lib/services/order.service";
import { authorizeInternal } from "@/lib/api/internal-auth";
import {
  formatManagerMorningBriefing,
  formatManagerFinancialDigest,
} from "@/lib/services/bot-settings.service";

export async function GET(request: NextRequest) {
  if (!authorizeInternal(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [stats, orders, inventory] = await Promise.all([
    getDashboardSnapshot(),
    getOrders(),
    getInventory(),
  ]);

  const unshipped = orders.filter(
    (o) => !["delivered", "cancelled"].includes(o.fulfillment.toLowerCase()),
  ).length;
  const pendingSlips = orders.filter(
    (o) => o.payment.toLowerCase() === "pending",
  ).length;
  const lowStock = inventory.filter((p) => p.stock <= 3);
  const lowStockList = lowStock.length
    ? lowStock
        .slice(0, 8)
        .map((p) => `• ${p.name} (${p.sku}): ${p.stock}`)
        .join("\n")
    : "No low-stock listings.";

  const morningMessage = await formatManagerMorningBriefing({
    unshipped,
    pendingSlips,
    revenue: stats.revenue,
    lowStockCount: lowStock.length,
    lowStockList,
  });

  const nightMessage = await formatManagerFinancialDigest({
    unshipped,
    pendingSlips,
    revenue: stats.revenue,
    grossProfit: stats.grossProfit,
  });

  return NextResponse.json({
    revenue: stats.revenue,
    gross_profit: stats.grossProfit,
    unshipped,
    pending_slips: pendingSlips,
    low_stock: lowStock.map((p) => ({ sku: p.sku, name: p.name, stock: p.stock })),
    morning_message: morningMessage,
    night_message: nightMessage,
  });
}
