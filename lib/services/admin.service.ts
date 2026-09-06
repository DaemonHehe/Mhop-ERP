import bcrypt from "bcryptjs";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { adminUsers, staffAlerts } from "@/db/schema";
import { staffSchema } from "@/lib/validation/schemas";
import { audit } from "./audit.service";
import type { ActionResult } from "./stock.service";

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}
export interface StaffAlert {
  id: string;
  type: string;
  title: string;
  body: string;
  targetCode: string | null;
  isRead: boolean;
  createdAt: Date;
}
const errorOf = (error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unexpected operation failure";
  return message.includes("unique")
    ? "That email is already assigned to another staff member."
    : message;
};

export async function getStaff(): Promise<StaffMember[]> {
  if (!db)
    return [
      {
        id: "demo-admin",
        name: "MH OP Administrator",
        email: "admin@decantos.com",
        role: "admin",
        isActive: true,
      },
    ];
  return db
    .select({
      id: adminUsers.id,
      name: adminUsers.name,
      email: adminUsers.email,
      role: adminUsers.role,
      isActive: adminUsers.isActive,
    })
    .from(adminUsers)
    .orderBy(adminUsers.name);
}
export async function createStaff(input: unknown): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };
    const parsed = staffSchema.safeParse(input);
    if (!parsed.success)
      return {
        ok: false,
        error: parsed.error.issues[0]?.message || "Invalid staff member",
      };
    if (!parsed.data.password)
      return { ok: false, error: "A password is required for new staff." };
    const [created] = await db
      .insert(adminUsers)
      .values({
        ...parsed.data,
        passwordHash: await bcrypt.hash(parsed.data.password, 12),
      })
      .returning({ id: adminUsers.id });
    await audit(
      "staff.created",
      created.id,
      `${parsed.data.email} · ${parsed.data.role}`,
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorOf(error) };
  }
}
export async function updateStaff(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };
    const parsed = staffSchema.safeParse(input);
    if (!parsed.success)
      return {
        ok: false,
        error: parsed.error.issues[0]?.message || "Invalid staff member",
      };
    const { password, ...profile } = parsed.data;
    const [updated] = await db
      .update(adminUsers)
      .set(
        password
          ? { ...profile, passwordHash: await bcrypt.hash(password, 12) }
          : profile,
      )
      .where(eq(adminUsers.id, id))
      .returning({ id: adminUsers.id });
    if (!updated) return { ok: false, error: "Staff member not found" };
    await audit(
      "staff.updated",
      id,
      `${profile.email} · ${profile.role}${password ? " · password reset" : ""}`,
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorOf(error) };
  }
}
export async function setStaffActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };
    const [target] = await db
      .select({
        role: adminUsers.role,
        isActive: adminUsers.isActive,
        email: adminUsers.email,
      })
      .from(adminUsers)
      .where(eq(adminUsers.id, id))
      .limit(1);
    if (!target) return { ok: false, error: "Staff member not found" };
    if (!isActive && target.role === "admin" && target.isActive) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(adminUsers)
        .where(sql`${adminUsers.role}='admin' and ${adminUsers.isActive}=true`);
      if (count <= 1)
        return {
          ok: false,
          error: "The last active administrator cannot be deactivated.",
        };
    }
    await db.update(adminUsers).set({ isActive }).where(eq(adminUsers.id, id));
    await audit(
      isActive ? "staff.activated" : "staff.deactivated",
      id,
      target.email,
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorOf(error) };
  }
}

export async function getAlerts(): Promise<StaffAlert[]> {
  if (!db)
    return [
      {
        id: "demo-alert",
        type: "preview",
        title: "Preview mode",
        body: "Connect PostgreSQL to receive live order, payment, and low-stock alerts.",
        targetCode: null,
        isRead: false,
        createdAt: new Date(),
      },
    ];
  return db
    .select()
    .from(staffAlerts)
    .orderBy(desc(staffAlerts.createdAt))
    .limit(100);
}
export async function markAlertRead(id: string): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };
    const [updated] = await db
      .update(staffAlerts)
      .set({ isRead: true })
      .where(eq(staffAlerts.id, id))
      .returning({ id: staffAlerts.id });
    if (!updated) return { ok: false, error: "Alert not found" };
    await audit("system.alert_read", updated.id, "Staff alert marked as read");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorOf(error) };
  }
}
export async function markAllAlertsRead(): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };
    const updated = await db
      .update(staffAlerts)
      .set({ isRead: true })
      .where(eq(staffAlerts.isRead, false))
      .returning({ id: staffAlerts.id });
    await audit(
      "system.alerts_read",
      undefined,
      `${updated.length} staff alerts marked as read`,
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorOf(error) };
  }
}
