"use server";

import { revalidatePath } from "next/cache";
import { authorizeStaff, requireStaff } from "@/lib/auth/authorize";
import {
  getTelegramBroadcastAudience,
  sendTelegramBroadcast,
  type BroadcastAudience,
  type BroadcastResult,
} from "@/lib/services/broadcast.service";

export type { BroadcastAudience, BroadcastResult };

export async function getBroadcastAudienceAction(): Promise<BroadcastAudience> {
  await requireStaff(["admin", "staff"]);
  return getTelegramBroadcastAudience();
}

export async function sendTelegramBroadcastAction(
  message: string,
): Promise<BroadcastResult> {
  const staff = await authorizeStaff(["admin", "staff"]);
  if (!staff) {
    return {
      ok: false,
      total: 0,
      sent: 0,
      blocked: 0,
      unreachable: 0,
      failed: 0,
      error: "Unauthorized: Sign in with staff credentials to send broadcasts.",
    };
  }

  const actor = `${staff.name} (${staff.email})`;
  const result = await sendTelegramBroadcast(message, actor);
  revalidatePath("/customers");
  revalidatePath("/logs");
  return result;
}
