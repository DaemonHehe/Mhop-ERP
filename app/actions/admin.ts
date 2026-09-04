"use server";
import { revalidatePath } from "next/cache";
import { authorizeStaff, requireStaff } from "@/lib/auth/authorize";
import * as adminService from "@/lib/services/admin.service";
export type { StaffMember, StaffAlert } from "@/lib/services/admin.service";
export async function getStaffAction() {
  await requireStaff(["admin"]);
  return adminService.getStaff();
}
export async function createStaffAction(input: unknown) {
  if (!(await authorizeStaff(["admin"])))
    return { ok: false as const, error: "Administrator access is required." };
  const result = await adminService.createStaff(input);
  if (result.ok) revalidatePath("/staff");
  return result;
}
export async function updateStaffAction(id: string, input: unknown) {
  if (!(await authorizeStaff(["admin"])))
    return { ok: false as const, error: "Administrator access is required." };
  const result = await adminService.updateStaff(id, input);
  if (result.ok) revalidatePath("/staff");
  return result;
}
export async function setStaffActiveAction(id: string, isActive: boolean) {
  const current = await authorizeStaff(["admin"]);
  if (!current)
    return { ok: false as const, error: "Administrator access is required." };
  if (current.id === id && !isActive)
    return {
      ok: false as const,
      error: "You cannot deactivate your own signed-in account.",
    };
  const result = await adminService.setStaffActive(id, isActive);
  if (result.ok) revalidatePath("/staff");
  return result;
}
export async function getAlertsAction() {
  if (!(await authorizeStaff(["admin", "staff"]))) return [];
  return adminService.getAlerts();
}
export async function markAlertReadAction(id: string) {
  if (!(await authorizeStaff(["admin", "staff"])))
    return { ok: false as const, error: "Unauthorized" };
  const result = await adminService.markAlertRead(id);
  if (result.ok) revalidatePath("/alerts");
  return result;
}
export async function markAllAlertsReadAction() {
  if (!(await authorizeStaff(["admin", "staff"])))
    return { ok: false as const, error: "Unauthorized" };
  const result = await adminService.markAllAlertsRead();
  if (result.ok) revalidatePath("/alerts");
  return result;
}
