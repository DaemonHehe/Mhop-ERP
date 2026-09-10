"use server";

import { revalidatePath } from "next/cache";
import { authorizeStaff } from "@/lib/auth/authorize";
import {
  getBotMessageTemplates,
  saveBotMessageTemplate,
  resetBotMessageTemplate,
  type BotTemplateItem,
} from "@/lib/services/bot-settings.service";
import { audit } from "@/lib/services/audit.service";

export async function getBotTemplatesAction(): Promise<BotTemplateItem[]> {
  return getBotMessageTemplates();
}

export async function saveBotTemplateAction(
  key: string,
  content: string,
): Promise<{ ok: boolean; error?: string }> {
  const staff = await authorizeStaff(["admin", "staff"]);
  if (!staff) {
    return { ok: false, error: "Unauthorized: Staff or admin access required." };
  }

  const result = await saveBotMessageTemplate(key, content, staff.name || staff.email);
  if (result.ok) {
    try {
      await audit("bot.template_updated", key, `Updated template copy for ${key}`);
    } catch {
      // Audit failure should not block template save
    }
    revalidatePath("/bot");
  }
  return result;
}

export async function resetBotTemplateAction(
  key: string,
): Promise<{ ok: boolean; error?: string }> {
  const staff = await authorizeStaff(["admin"]);
  if (!staff) {
    return { ok: false, error: "Unauthorized: Admin access required to reset templates." };
  }

  const result = await resetBotMessageTemplate(key, staff.name || staff.email);
  if (result.ok) {
    try {
      await audit("bot.template_reset", key, `Reset template copy to defaults for ${key}`);
    } catch {
      // Ignore audit failure
    }
    revalidatePath("/bot");
  }
  return result;
}

export async function testSalesAgentAction(question: string): Promise<{
  ok: boolean;
  reply?: string;
  mode?: "openai" | "safe_fallback";
  needsHuman?: boolean;
  error?: string;
}> {
  const staff = await authorizeStaff(["admin", "staff"]);
  if (!staff) {
    return { ok: false, error: "Unauthorized: Staff or admin access required." };
  }
  const clean = question.trim().slice(0, 1000);
  if (!clean) {
    return { ok: false, error: "Please enter a test question." };
  }
  try {
    const { answerSalesQuestion } = await import("@/lib/ai/sales-agent");
    const result = await answerSalesQuestion({
      question: clean,
      customerId: "admin-playground-tester",
    });
    return {
      ok: true,
      reply: result.reply,
      mode: result.mode,
      needsHuman: result.needsHuman,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to test AI response",
    };
  }
}

