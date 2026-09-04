"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { authorizeStaff, requireStaff } from "@/lib/auth/authorize";
import * as erp from "@/lib/services/erp.service";
export type {
  SupplierRecord,
  PurchaseRecord,
  ExpenseRecord,
  ErpSnapshot,
  SupplierInput,
  PurchaseInput,
  ExpenseInput,
} from "@/lib/services/erp.service";

export async function getErpDataAction() {
  await requireStaff(["admin", "staff"]);
  const [snapshot, suppliers, purchases, expenses] = await Promise.all([
    erp.getErpSnapshot(),
    erp.getSuppliers(),
    erp.getPurchases(),
    erp.getExpenses(),
  ]);
  return { snapshot, suppliers, purchases, expenses };
}
const refresh = () => {
  revalidateTag("public-commerce");
  revalidatePath("/erp");
  revalidatePath("/dashboard");
  revalidatePath("/inventory");
  revalidatePath("/shop");
};
async function allowed(adminOnly = false) {
  return authorizeStaff(adminOnly ? ["admin"] : ["admin", "staff"]);
}
export async function createSupplierAction(input: erp.SupplierInput) {
  if (!(await allowed())) return { ok: false as const, error: "Unauthorized" };
  const result = await erp.createSupplier(input);
  if (result.ok) refresh();
  return result;
}
export async function updateSupplierAction(
  id: string,
  input: erp.SupplierInput,
) {
  if (!(await allowed())) return { ok: false as const, error: "Unauthorized" };
  const result = await erp.updateSupplier(id, input);
  if (result.ok) refresh();
  return result;
}
export async function deleteSupplierAction(id: string) {
  if (!(await allowed(true)))
    return { ok: false as const, error: "Administrator access is required." };
  const result = await erp.deleteSupplier(id);
  if (result.ok) refresh();
  return result;
}
export async function createPurchaseAction(input: erp.PurchaseInput) {
  if (!(await allowed())) return { ok: false as const, error: "Unauthorized" };
  const result = await erp.createPurchase(input);
  if (result.ok) refresh();
  return result;
}
export async function receivePurchaseAction(id: string) {
  if (!(await allowed())) return { ok: false as const, error: "Unauthorized" };
  const result = await erp.receivePurchase(id);
  if (result.ok) refresh();
  return result;
}
export async function cancelPurchaseAction(id: string) {
  if (!(await allowed())) return { ok: false as const, error: "Unauthorized" };
  const result = await erp.cancelPurchase(id);
  if (result.ok) refresh();
  return result;
}
export async function createExpenseAction(input: erp.ExpenseInput) {
  if (!(await allowed())) return { ok: false as const, error: "Unauthorized" };
  const result = await erp.createExpense(input);
  if (result.ok) refresh();
  return result;
}
export async function updateExpenseAction(id: string, input: erp.ExpenseInput) {
  if (!(await allowed())) return { ok: false as const, error: "Unauthorized" };
  const result = await erp.updateExpense(id, input);
  if (result.ok) refresh();
  return result;
}
export async function deleteExpenseAction(id: string) {
  if (!(await allowed(true)))
    return { ok: false as const, error: "Administrator access is required." };
  const result = await erp.deleteExpense(id);
  if (result.ok) refresh();
  return result;
}
