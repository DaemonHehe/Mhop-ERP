"use server";

import { revalidatePath } from "next/cache";
import { authorizeStaff, requireStaff } from "@/lib/auth/authorize";
import {
  getPaymentAccounts,
  createPaymentAccount,
  updatePaymentAccount,
  deletePaymentAccount,
  togglePaymentAccount,
  type PaymentAccount,
  type PaymentAccountDraft,
} from "@/lib/services/payment-account.service";

export type { PaymentAccount, PaymentAccountDraft };

export async function getPaymentAccountsAction(): Promise<PaymentAccount[]> {
  await requireStaff(["admin", "staff"]);
  return getPaymentAccounts();
}

export async function createPaymentAccountAction(draft: PaymentAccountDraft) {
  if (!(await authorizeStaff(["admin", "staff"]))) {
    return { ok: false as const, error: "Unauthorized" };
  }
  const result = await createPaymentAccount(draft);
  if (result.ok) {
    revalidatePath("/receipts");
    revalidatePath("/shop/checkout");
  }
  return result;
}

export async function updatePaymentAccountAction(
  id: string,
  draft: Partial<PaymentAccountDraft>
) {
  if (!(await authorizeStaff(["admin", "staff"]))) {
    return { ok: false as const, error: "Unauthorized" };
  }
  const result = await updatePaymentAccount(id, draft);
  if (result.ok) {
    revalidatePath("/receipts");
    revalidatePath("/shop/checkout");
  }
  return result;
}

export async function deletePaymentAccountAction(id: string) {
  if (!(await authorizeStaff(["admin", "staff"]))) {
    return { ok: false as const, error: "Unauthorized" };
  }
  const result = await deletePaymentAccount(id);
  if (result.ok) {
    revalidatePath("/receipts");
    revalidatePath("/shop/checkout");
  }
  return result;
}

export async function togglePaymentAccountAction(id: string, isActive: boolean) {
  if (!(await authorizeStaff(["admin", "staff"]))) {
    return { ok: false as const, error: "Unauthorized" };
  }
  const result = await togglePaymentAccount(id, isActive);
  if (result.ok) {
    revalidatePath("/receipts");
    revalidatePath("/shop/checkout");
  }
  return result;
}
