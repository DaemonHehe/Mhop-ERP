import { NextRequest, NextResponse } from "next/server";
import {
  getDashboardSnapshot,
  getInventory,
} from "@/lib/services/stock.service";
import { getOrders } from "@/lib/services/order.service";
import { authorizeInternal } from "@/lib/api/internal-auth";
export async function GET(request: NextRequest) {
  if (!authorizeInternal(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [stats, orders, inventory] = await Promise.all([
    getDashboardSnapshot(),
    getOrders(),
    getInventory(),
  ]);
  return NextResponse.json({
    revenue: stats.revenue,
    gross_profit: stats.grossProfit,
    unshipped: orders.filter(
      (o) => !["delivered", "cancelled"].includes(o.fulfillment.toLowerCase()),
    ).length,
    pending_slips: orders.filter((o) => o.payment.toLowerCase() === "pending")
      .length,
    low_stock: inventory
      .filter((p) => p.stock <= 3)
      .map((p) => ({ sku: p.sku, name: p.name, stock: p.stock })),
  });
}
