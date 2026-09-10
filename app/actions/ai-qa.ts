"use server";

import { revalidatePath } from "next/cache";
import { authorizeStaff } from "@/lib/auth/authorize";
import {
  getAiSalesQaList,
  createAiSalesQa,
  updateAiSalesQa,
  deleteAiSalesQa,
  type AiSalesQaItem,
} from "@/lib/services/ai-qa.service";
import { audit } from "@/lib/services/audit.service";

export async function getAiSalesQaAction(): Promise<AiSalesQaItem[]> {
  return getAiSalesQaList();
}

export async function createAiSalesQaAction(input: {
  question: string;
  answer: string;
  category?: string;
}): Promise<{ ok: boolean; item?: AiSalesQaItem; error?: string }> {
  const staff = await authorizeStaff(["admin", "staff"]);
  if (!staff) {
    return { ok: false, error: "Unauthorized: Staff or admin access required." };
  }

  try {
    const item = await createAiSalesQa(input, staff.name || staff.email);
    try {
      await audit(
        "bot.qa_created",
        item.id,
        `Added Q&A entry: "${item.question.slice(0, 40)}..."`,
      );
    } catch {}
    revalidatePath("/bot");
    return { ok: true, item };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create Q&A entry",
    };
  }
}

export async function updateAiSalesQaAction(
  id: string,
  input: Partial<{
    question: string;
    answer: string;
    category: string;
    isActive: boolean;
  }>,
): Promise<{ ok: boolean; item?: AiSalesQaItem; error?: string }> {
  const staff = await authorizeStaff(["admin", "staff"]);
  if (!staff) {
    return { ok: false, error: "Unauthorized: Staff or admin access required." };
  }

  try {
    const item = await updateAiSalesQa(id, input, staff.name || staff.email);
    try {
      await audit("bot.qa_updated", id, `Updated Q&A entry: "${item.question.slice(0, 40)}..."`);
    } catch {}
    revalidatePath("/bot");
    return { ok: true, item };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update Q&A entry",
    };
  }
}

export async function deleteAiSalesQaAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const staff = await authorizeStaff(["admin"]);
  if (!staff) {
    return { ok: false, error: "Unauthorized: Admin access required to delete Q&A." };
  }

  try {
    await deleteAiSalesQa(id);
    try {
      await audit("bot.qa_deleted", id, `Deleted Q&A entry ${id}`);
    } catch {}
    revalidatePath("/bot");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete Q&A entry",
    };
  }
}
