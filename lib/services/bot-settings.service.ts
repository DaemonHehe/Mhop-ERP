import { db } from "@/db";
import { botMessageTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { clientConfig } from "@/lib/client-config";

export type BotTemplateItem = {
  id?: string;
  key: string;
  label: string;
  description: string;
  triggerSource: string;
  content: string;
  placeholders: string[];
  channel?: "customer" | "staff";
  updatedAt?: Date;
  updatedBy?: string | null;
  isCustomized?: boolean;
};

export const DEFAULT_BOT_TEMPLATES: Record<string, Omit<BotTemplateItem, "id" | "updatedAt" | "updatedBy">> = {
  // Customer Sales Bot
  welcome: {
    key: "welcome",
    label: "Telegram Bot Welcome Greeting (/start)",
    description: "Delivered immediately when a customer opens the Telegram bot or sends /start command.",
    triggerSource: "telegram_bot_start",
    channel: "customer",
    content: clientConfig.telegram.welcome,
    placeholders: [],
  },
  cart_recovery_unpaid: {
    key: "cart_recovery_unpaid",
    label: "Cart Recovery: Unpaid Order Reminder (15 Min)",
    description: "Sent automatically to customers who generated an order code but have not submitted a transfer slip after 15 minutes.",
    triggerSource: "n8n_cart_recovery",
    channel: "customer",
    content: "မင်္ဂလာပါခင်ဗျာ။ MH OP မှ {order_code} အတွက် ဝယ်ယူမှု မပြီးဆုံးသေးပါ။ ဝယ်ယူမှုဆက်လက်လုပ်ဆောင်ရန် သို့မဟုတ် အကူအညီလိုပါက ဒီ bot ကို စာပြန်ပေးနိုင်ပါတယ်။ ငွေလွှဲပြီးပါက payment slip ပေးပို့ပေးပါခင်ဗျာ။",
    placeholders: ["{customer}", "{order_code}"],
  },
  cart_recovery_browsing: {
    key: "cart_recovery_browsing",
    label: "Lead Recovery: Catalog Inquirer (15 Min)",
    description: "Sent to customers who browsed the catalog or sales options in Telegram without placing an order.",
    triggerSource: "n8n_cart_recovery",
    channel: "customer",
    content: "မင်္ဂလာပါခင်ဗျာ။ MH OP မှာ ကြည့်ရှုထားတဲ့ ပစ္စည်းများကို စိတ်ဝင်စားသေးပါသလား။ /catalog ဖြင့် ပြန်ကြည့်နိုင်ပြီး ဝယ်ယူရန် အကူအညီလိုပါက ဒီ bot ကို စာပြန်ပေးနိုင်ပါတယ်ခင်ဗျာ။",
    placeholders: ["{customer}"],
  },
  slip_acknowledgment: {
    key: "slip_acknowledgment",
    label: "Payment Slip Review Acknowledgment",
    description: "Delivered immediately after a customer sends a bank transfer receipt or payment screenshot.",
    triggerSource: "telegram_slip_upload",
    channel: "customer",
    content: clientConfig.telegram.slipAcknowledgment,
    placeholders: ["{order_code}"],
  },

  // Manager & Operations Bot (Staff Group)
  manager_morning_briefing: {
    key: "manager_morning_briefing",
    label: "Morning Operations Briefing (08:30)",
    description: "Sent by n8n at 08:30 to the Manager & Staff group summarizing orders, pending payments, revenue, and stock.",
    triggerSource: "n8n_daily_briefing",
    channel: "staff",
    content: "GOOD MORNING · MH OP\nUnshipped orders: {unshipped}\nPending payments: {pending_slips}\nCumulative verified revenue: {revenue} MMK\nLow-stock listings: {low_stock_count}\n\n{low_stock_list}",
    placeholders: ["{unshipped}", "{pending_slips}", "{revenue}", "{low_stock_count}"],
  },
  manager_financial_digest: {
    key: "manager_financial_digest",
    label: "Nightly Financial Digest (22:00)",
    description: "Sent by n8n at 22:00 to the Manager & Staff group summarizing verified revenue, gross profit, and pending fulfillment.",
    triggerSource: "n8n_financial_digest",
    channel: "staff",
    content: "NIGHTLY SNAPSHOT · MH OP\nCumulative verified revenue: {revenue} MMK\nCumulative gross profit: {gross_profit} MMK\nOpen fulfillment: {unshipped}\nPending payments: {pending_slips}",
    placeholders: ["{revenue}", "{gross_profit}", "{unshipped}", "{pending_slips}"],
  },
  manager_staff_alert: {
    key: "manager_staff_alert",
    label: "Real-Time Operational Alert",
    description: "Instant notification sent to the Manager & Staff group when orders, verified payments, low stock, or tickets occur.",
    triggerSource: "n8n_event_alert",
    channel: "staff",
    content: "MH OP · {title}\n{body}\nReference: {target_code}\n{timestamp}",
    placeholders: ["{title}", "{body}", "{target_code}", "{timestamp}"],
  },
};

/**
 * Replaces `{token}` with corresponding variable string.
 */
export function interpolateVariables(
  template: string,
  vars: Record<string, string | number | null | undefined>,
): string {
  if (!template) return "";
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, token) => {
    const val = vars[token];
    if (val === undefined || val === null) {
      return match;
    }
    return String(val);
  });
}

/**
 * Retrieves all templates, merging DB records with factory defaults.
 */
export async function getBotMessageTemplates(): Promise<BotTemplateItem[]> {
  const defaults = Object.values(DEFAULT_BOT_TEMPLATES);
  if (!db) {
    return defaults.map((d) => ({ ...d, isCustomized: false }));
  }

  try {
    const rows = await db.select().from(botMessageTemplates);
    const dbMap = new Map(rows.map((r) => [r.key, r]));

    return defaults.map((def) => {
      const dbRow = dbMap.get(def.key);
      if (dbRow) {
        return {
          id: dbRow.id,
          key: dbRow.key,
          label: dbRow.label || def.label,
          description: dbRow.description || def.description,
          triggerSource: dbRow.triggerSource || def.triggerSource,
          channel: def.channel,
          content: dbRow.content,
          placeholders: (dbRow.placeholders as string[]) || def.placeholders,
          updatedAt: dbRow.updatedAt,
          updatedBy: dbRow.updatedBy,
          isCustomized: dbRow.content.trim() !== def.content.trim(),
        };
      }
      return {
        ...def,
        isCustomized: false,
      };
    });
  } catch {
    return defaults.map((d) => ({ ...d, isCustomized: false }));
  }
}

/**
 * Retrieves a single template string by key with fallback.
 */
export async function getBotMessageTemplate(key: string): Promise<string> {
  const def = DEFAULT_BOT_TEMPLATES[key]?.content || "";
  if (!db) return def;

  try {
    const rows = await db
      .select()
      .from(botMessageTemplates)
      .where(eq(botMessageTemplates.key, key))
      .limit(1);
    return rows[0]?.content || def;
  } catch {
    return def;
  }
}

/**
 * Saves/upserts a template.
 */
export async function saveBotMessageTemplate(
  key: string,
  content: string,
  updatedBy = "admin",
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = content.trim();
  if (!trimmed) {
    return { ok: false, error: "Template content cannot be empty." };
  }
  const meta = DEFAULT_BOT_TEMPLATES[key];
  if (!meta) {
    return { ok: false, error: `Invalid template key: ${key}` };
  }
  if (!db) {
    return { ok: false, error: "Database connection not available." };
  }

  try {
    const existing = await db
      .select()
      .from(botMessageTemplates)
      .where(eq(botMessageTemplates.key, key))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(botMessageTemplates)
        .set({
          content: trimmed,
          updatedAt: new Date(),
          updatedBy,
        })
        .where(eq(botMessageTemplates.key, key));
    } else {
      await db.insert(botMessageTemplates).values({
        key,
        label: meta.label,
        description: meta.description,
        triggerSource: meta.triggerSource,
        content: trimmed,
        placeholders: meta.placeholders,
        updatedBy,
      });
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to save template",
    };
  }
}

/**
 * Resets a template back to factory defaults.
 */
export async function resetBotMessageTemplate(
  key: string,
  updatedBy = "admin",
): Promise<{ ok: boolean; error?: string }> {
  const meta = DEFAULT_BOT_TEMPLATES[key];
  if (!meta) return { ok: false, error: `Invalid template key: ${key}` };
  return saveBotMessageTemplate(key, meta.content, updatedBy);
}

/**
 * High-level helpers for formatting automated customer messages.
 */

export async function formatRecoveryReminder(params: {
  stage: "unpaid" | "browsing";
  orderCode?: string;
  customer?: string;
}): Promise<string> {
  const key =
    params.stage === "unpaid"
      ? "cart_recovery_unpaid"
      : "cart_recovery_browsing";
  const raw = await getBotMessageTemplate(key);
  return interpolateVariables(raw, {
    customer: params.customer || "အကို/အမ",
    order_code: params.orderCode || "",
  });
}

export async function formatWelcomeMessage(): Promise<string> {
  return getBotMessageTemplate("welcome");
}

export async function formatSlipAcknowledgment(params?: {
  orderCode?: string;
}): Promise<string> {
  const raw = await getBotMessageTemplate("slip_acknowledgment");
  return interpolateVariables(raw, {
    order_code: params?.orderCode || "",
  });
}

export async function formatManagerMorningBriefing(params: {
  unshipped: number;
  pendingSlips: number;
  revenue: string | number;
  lowStockCount: number;
  lowStockList?: string;
}): Promise<string> {
  const raw = await getBotMessageTemplate("manager_morning_briefing");
  return interpolateVariables(raw, {
    unshipped: params.unshipped,
    pending_slips: params.pendingSlips,
    revenue: typeof params.revenue === "number" ? params.revenue.toLocaleString() : params.revenue,
    low_stock_count: params.lowStockCount,
    low_stock_list: params.lowStockList || "No low-stock listings.",
  });
}

export async function formatManagerFinancialDigest(params: {
  revenue: string | number;
  grossProfit: string | number;
  unshipped: number;
  pendingSlips: number;
}): Promise<string> {
  const raw = await getBotMessageTemplate("manager_financial_digest");
  return interpolateVariables(raw, {
    revenue: typeof params.revenue === "number" ? params.revenue.toLocaleString() : params.revenue,
    gross_profit: typeof params.grossProfit === "number" ? params.grossProfit.toLocaleString() : params.grossProfit,
    unshipped: params.unshipped,
    pending_slips: params.pendingSlips,
  });
}

export async function formatManagerStaffAlert(params: {
  title: string;
  body: string;
  targetCode: string;
  timestamp?: string;
}): Promise<string> {
  const raw = await getBotMessageTemplate("manager_staff_alert");
  return interpolateVariables(raw, {
    title: params.title,
    body: params.body,
    target_code: params.targetCode,
    timestamp: params.timestamp || new Date().toISOString(),
  });
}
