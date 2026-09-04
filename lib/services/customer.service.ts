import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, orders } from "@/db/schema";
import { getOrders } from "./order.service";

export interface CustomerSummary {
  id: string;
  name: string;
  phone: string;
  telegramUserId: string | null;
  primaryAddress: string | null;
  source: string;
  orders: number;
  lifetime: number;
  last: string;
}

export async function getCustomers(): Promise<CustomerSummary[]> {
  if (!db) {
    const source = await getOrders();
    const grouped = new Map<string, CustomerSummary>();
    for (const order of source) {
      const key = order.phone || order.customer;
      const current = grouped.get(key) || {
        id: `demo-${key}`,
        name: order.customer,
        phone: order.phone || "—",
        telegramUserId: null,
        primaryAddress: order.address || null,
        source: order.channel,
        orders: 0,
        lifetime: 0,
        last: order.created,
      };
      current.orders++;
      current.lifetime += order.amount;
      grouped.set(key, current);
    }
    return [...grouped.values()].sort((a, b) => b.lifetime - a.lifetime);
  }

  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      telegramUserId: customers.telegramUserId,
      primaryAddress: customers.primaryAddress,
      source: sql<string>`case when ${customers.telegramUserId} is not null then 'Telegram' else 'Web' end`,
      orders: sql<number>`count(${orders.id})`,
      lifetime: sql<string>`coalesce(sum(case when ${orders.paymentStatus}='verified' then ${orders.totalAmount} else 0 end), 0)`,
      last: sql<Date | null>`max(${orders.createdAt})`,
    })
    .from(customers)
    .leftJoin(orders, eq(orders.customerId, customers.id))
    .where(eq(customers.isActive, true))
    .groupBy(
      customers.id,
      customers.name,
      customers.phone,
      customers.telegramUserId,
    )
    .orderBy(desc(sql`max(${orders.createdAt})`));

  return rows.map((row) => ({
    name: row.name,
    id: row.id,
    phone: row.phone,
    telegramUserId: row.telegramUserId,
    primaryAddress: row.primaryAddress,
    source: row.source,
    orders: Number(row.orders),
    lifetime: Number(row.lifetime),
    last: row.last
      ? new Date(row.last).toLocaleString("en-US", {
          timeZone: "Asia/Yangon",
        })
      : "—",
  }));
}
