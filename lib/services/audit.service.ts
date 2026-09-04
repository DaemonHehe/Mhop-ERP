import { desc } from "drizzle-orm";
import { db } from "@/db";
import { systemAuditLogs } from "@/db/schema";
import { emitSystemEvent } from "@/lib/events/event-emitter";

export async function audit(
  event: string,
  targetCode: string | undefined,
  details: string,
  actor = "staff",
) {
  if (db) {
    await db
      .insert(systemAuditLogs)
      .values({ event, targetCode, details, actor });
  }
  emitSystemEvent(event, { targetCode, details, actor });
}

export async function getAuditLogs() {
  if (!db) {
    return [
      {
        id: "demo-1",
        event: "order.payment_approved",
        actor: "MH OP Admin",
        targetCode: "MHOP-260828-1038",
        details: "Payment slip matched 4,590,000 MMK",
        createdAt: new Date(),
      },
      {
        id: "demo-2",
        event: "inventory.low_stock",
        actor: "system",
        targetCode: "SNY-XM5-BLK",
        details: "Stock reached safety threshold",
        createdAt: new Date(Date.now() - 12 * 60000),
      },
    ];
  }
  return db
    .select()
    .from(systemAuditLogs)
    .orderBy(desc(systemAuditLogs.createdAt))
    .limit(200);
}
