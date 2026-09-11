import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { systemAuditLogs } from "@/db/schema";
import { emitSystemEvent } from "@/lib/events/event-emitter";

export type AuditCategory =
  | "orders"
  | "inventory"
  | "finance"
  | "warranty"
  | "crm"
  | "access"
  | "automation"
  | "system";

export function auditCategory(event: string): AuditCategory {
  const prefix = event.toLowerCase().split(".")[0];
  if (["order", "payment"].includes(prefix)) return "orders";
  if (["catalog", "inventory", "device", "account", "bundle"].includes(prefix))
    return "inventory";
  if (["supplier", "purchase", "expense"].includes(prefix)) return "finance";
  if (["ticket", "warranty"].includes(prefix)) return "warranty";
  if (prefix === "customer") return "crm";
  if (["staff", "auth", "security"].includes(prefix)) return "access";
  if (["bot", "telegram", "n8n"].includes(prefix)) return "automation";
  return "system";
}

export async function audit(
  event: string,
  targetCode: string | undefined,
  details: string,
  actor = "staff",
) {
  const category = auditCategory(event);
  let resolvedActor = actor.slice(0, 120);
  if (actor === "staff") {
    try {
      const { getStaffSession } = await import("@/lib/auth/authorize");
      const staff = await getStaffSession();
      if (staff) resolvedActor = `${staff.name} (${staff.email})`.slice(0, 120);
    } catch {
      resolvedActor = actor.slice(0, 120);
    }
  }
  if (db)
    await db.insert(systemAuditLogs).values({
      category,
      event,
      targetCode,
      details,
      actor: resolvedActor,
    });
  emitSystemEvent(event, {
    category,
    targetCode,
    details,
    actor: resolvedActor,
  });
}

export async function getAuditLogs(before?: { createdAt: string; id: string }) {
  if (!db) {
    const now = new Date();
    const monday = new Date(now.getTime() + 420 * 60_000);
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    return [
      {
        id: "demo-1",
        category: "orders",
        event: "order.payment_approved",
        actor: "MH OP Admin",
        targetCode: "MHOP-260828-1038",
        details: "Payment slip matched 4,590,000 MMK",
        createdAt: now,
        weekStart: monday.toISOString().slice(0, 10),
      },
      {
        id: "demo-2",
        category: "inventory",
        event: "inventory.low_stock",
        actor: "system",
        targetCode: "SNY-XM5-BLK",
        details: "Stock reached safety threshold",
        createdAt: new Date(Date.now() - 12 * 60000),
        weekStart: monday.toISOString().slice(0, 10),
      },
    ];
  }
  return db
    .select({
      id: systemAuditLogs.id,
      category: systemAuditLogs.category,
      event: systemAuditLogs.event,
      actor: systemAuditLogs.actor,
      targetCode: systemAuditLogs.targetCode,
      details: systemAuditLogs.details,
      createdAt: systemAuditLogs.createdAt,
      weekStart: sql<string>`to_char(date_trunc('week', timezone('Asia/Bangkok', ${systemAuditLogs.createdAt})), 'YYYY-MM-DD')`,
    })
    .from(systemAuditLogs)
    .where(
      before
        ? sql`(${systemAuditLogs.createdAt}, ${systemAuditLogs.id}) < (${new Date(before.createdAt)}, ${before.id}::uuid)`
        : undefined,
    )
    .orderBy(desc(systemAuditLogs.createdAt), desc(systemAuditLogs.id))
    .limit(200);
}
