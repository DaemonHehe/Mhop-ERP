import { db } from "@/db";
import { paymentAccounts } from "@/db/schema";
import { clientConfig } from "@/lib/client-config";
import { asc, eq, sql } from "drizzle-orm";
import { audit } from "./audit.service";

export interface PaymentAccount {
  id: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  instructions: string | null;
  qrCodeUrl: string | null;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentAccountDraft = {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  instructions?: string | null;
  qrCodeUrl?: string | null;
  isActive?: boolean;
  displayOrder?: number;
};

const DEFAULT_FALLBACK_ACCOUNTS: PaymentAccount[] = [
  {
    id: "default-kpay",
    bankName: clientConfig.payments.kbzPay.label,
    accountHolder: clientConfig.payments.kbzPay.holder,
    accountNumber: clientConfig.payments.kbzPay.account,
    instructions: "ငွေလွှဲပြီးပါက slip ကို Telegram သို့ ပေးပို့ပါခင်ဗျာ။",
    qrCodeUrl: null,
    isActive: true,
    displayOrder: 1,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
  {
    id: "default-wavepay",
    bankName: clientConfig.payments.wavePay.label,
    accountHolder: clientConfig.payments.wavePay.holder,
    accountNumber: clientConfig.payments.wavePay.account,
    instructions: "ငွေလွှဲပြီးပါက slip ကို Telegram သို့ ပေးပို့ပါခင်ဗျာ။",
    qrCodeUrl: null,
    isActive: true,
    displayOrder: 2,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
  {
    id: "default-bank",
    bankName: clientConfig.payments.bank.label,
    accountHolder: clientConfig.payments.bank.holder,
    accountNumber: clientConfig.payments.bank.account,
    instructions: "ငွေလွှဲပြီးပါက slip ကို Telegram သို့ ပေးပို့ပါခင်ဗျာ။",
    qrCodeUrl: null,
    isActive: true,
    displayOrder: 3,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
];

let tableInitialized = false;

async function ensureTableAndSeed() {
  if (!db || tableInitialized) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS payment_accounts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        bank_name varchar(120) NOT NULL,
        account_holder varchar(120) NOT NULL,
        account_number varchar(120) NOT NULL,
        instructions text,
        qr_code_url text,
        is_active boolean NOT NULL DEFAULT true,
        display_order integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS payment_accounts_active_idx ON payment_accounts(is_active);
      CREATE INDEX IF NOT EXISTS payment_accounts_order_idx ON payment_accounts(display_order);
    `);

    // Check if table has records; if empty, seed defaults
    const existing = await db.select({ id: paymentAccounts.id }).from(paymentAccounts).limit(1);
    if (!existing.length) {
      for (const item of DEFAULT_FALLBACK_ACCOUNTS) {
        await db.insert(paymentAccounts).values({
          bankName: item.bankName,
          accountHolder: item.accountHolder,
          accountNumber: item.accountNumber,
          instructions: item.instructions,
          qrCodeUrl: item.qrCodeUrl,
          isActive: item.isActive,
          displayOrder: item.displayOrder,
        });
      }
    }
    tableInitialized = true;
  } catch (err) {
    console.error("[PaymentAccountService ensureTableAndSeed error]", err);
  }
}

export async function getPaymentAccounts(): Promise<PaymentAccount[]> {
  if (!db) return DEFAULT_FALLBACK_ACCOUNTS;
  await ensureTableAndSeed();
  try {
    const rows = await db
      .select()
      .from(paymentAccounts)
      .orderBy(asc(paymentAccounts.displayOrder), asc(paymentAccounts.createdAt));

    if (!rows.length) return DEFAULT_FALLBACK_ACCOUNTS;

    return rows.map((r) => ({
      id: r.id,
      bankName: r.bankName,
      accountHolder: r.accountHolder,
      accountNumber: r.accountNumber,
      instructions: r.instructions,
      qrCodeUrl: r.qrCodeUrl,
      isActive: r.isActive,
      displayOrder: r.displayOrder,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  } catch (err) {
    console.error("[getPaymentAccounts error, using fallbacks]", err);
    return DEFAULT_FALLBACK_ACCOUNTS;
  }
}

export async function getActivePaymentAccounts(): Promise<PaymentAccount[]> {
  const all = await getPaymentAccounts();
  const active = all.filter((a) => a.isActive);
  return active.length ? active : all;
}

export async function createPaymentAccount(draft: PaymentAccountDraft) {
  if (!db) return { ok: false, error: "Database not configured." };
  await ensureTableAndSeed();

  const bankName = draft.bankName.trim();
  const accountHolder = draft.accountHolder.trim();
  const accountNumber = draft.accountNumber.trim();

  if (!bankName) return { ok: false, error: "Bank / Provider name is required." };
  if (!accountHolder) return { ok: false, error: "Account holder name is required." };
  if (!accountNumber) return { ok: false, error: "Account number is required." };

  try {
    const [inserted] = await db
      .insert(paymentAccounts)
      .values({
        bankName,
        accountHolder,
        accountNumber,
        instructions: draft.instructions?.trim() || null,
        qrCodeUrl: draft.qrCodeUrl?.trim() || null,
        isActive: draft.isActive !== undefined ? draft.isActive : true,
        displayOrder: draft.displayOrder ?? 0,
      })
      .returning();

    await audit(
      "payment_account.create",
      inserted.id,
      `Created payment account: ${bankName} (${accountNumber})`
    );

    return { ok: true, data: inserted };
  } catch (error) {
    console.error("[createPaymentAccount error]", error);
    return { ok: false, error: "Failed to create payment account." };
  }
}

export async function updatePaymentAccount(id: string, draft: Partial<PaymentAccountDraft>) {
  if (!db) return { ok: false, error: "Database not configured." };
  await ensureTableAndSeed();

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (draft.bankName !== undefined) {
    const v = draft.bankName.trim();
    if (!v) return { ok: false, error: "Bank / Provider name cannot be empty." };
    updates.bankName = v;
  }
  if (draft.accountHolder !== undefined) {
    const v = draft.accountHolder.trim();
    if (!v) return { ok: false, error: "Account holder name cannot be empty." };
    updates.accountHolder = v;
  }
  if (draft.accountNumber !== undefined) {
    const v = draft.accountNumber.trim();
    if (!v) return { ok: false, error: "Account number cannot be empty." };
    updates.accountNumber = v;
  }
  if (draft.instructions !== undefined) updates.instructions = draft.instructions?.trim() || null;
  if (draft.qrCodeUrl !== undefined) updates.qrCodeUrl = draft.qrCodeUrl?.trim() || null;
  if (draft.isActive !== undefined) updates.isActive = draft.isActive;
  if (draft.displayOrder !== undefined) updates.displayOrder = draft.displayOrder;

  try {
    const [updated] = await db
      .update(paymentAccounts)
      .set(updates)
      .where(eq(paymentAccounts.id, id))
      .returning();

    if (!updated) return { ok: false, error: "Payment account not found." };

    await audit(
      "payment_account.update",
      id,
      `Updated payment account: ${updated.bankName} (${updated.accountNumber})`
    );

    return { ok: true, data: updated };
  } catch (error) {
    console.error("[updatePaymentAccount error]", error);
    return { ok: false, error: "Failed to update payment account." };
  }
}

export async function deletePaymentAccount(id: string) {
  if (!db) return { ok: false, error: "Database not configured." };
  await ensureTableAndSeed();

  try {
    const [deleted] = await db
      .delete(paymentAccounts)
      .where(eq(paymentAccounts.id, id))
      .returning();

    if (!deleted) return { ok: false, error: "Payment account not found." };

    await audit(
      "payment_account.delete",
      id,
      `Deleted payment account: ${deleted.bankName} (${deleted.accountNumber})`
    );

    return { ok: true };
  } catch (error) {
    console.error("[deletePaymentAccount error]", error);
    return { ok: false, error: "Failed to delete payment account." };
  }
}

export async function togglePaymentAccount(id: string, isActive: boolean) {
  return updatePaymentAccount(id, { isActive });
}

/**
 * Formats active payment accounts into a Telegram-friendly HTML message.
 * Account numbers are rendered in <code> tags for one-tap copying in Telegram.
 */
export async function formatBankAccountsTelegramMessage(selectedMethod?: string): Promise<string> {
  const accounts = await getActivePaymentAccounts();

  // If a specific method was chosen, try to match it or put it first
  const normalizedMethod = (selectedMethod || "").toLowerCase().trim();
  const prioritized = [...accounts];
  if (normalizedMethod) {
    prioritized.sort((a, b) => {
      const aMatch = a.bankName.toLowerCase().includes(normalizedMethod) || normalizedMethod.includes(a.bankName.toLowerCase());
      const bMatch = b.bankName.toLowerCase().includes(normalizedMethod) || normalizedMethod.includes(b.bankName.toLowerCase());
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      return 0;
    });
  }

  const lines: string[] = [
    "💳 <b>ငွေလွှဲရန် အကောင့်အချက်အလက်များ</b>\n",
  ];

  if (normalizedMethod) {
    const match = prioritized.find(
      (a) =>
        a.bankName.toLowerCase().includes(normalizedMethod) ||
        normalizedMethod.includes(a.bankName.toLowerCase())
    );
    if (match) {
      lines.push(`✨ <i>လူကြီးမင်း ရွေးချယ်ထားသော စနစ်: <b>${match.bankName}</b></i>\n`);
    }
  }

  for (const acc of prioritized) {
    lines.push(`• <b>${acc.bankName}</b>`);
    lines.push(`  အကောင့်အမည်: <code>${acc.accountHolder}</code>`);
    lines.push(`  အကောင့်နံပါတ်: <code>${acc.accountNumber}</code> (နှိပ်၍ copy ကူးနိုင်ပါသည်)`);
    if (acc.instructions) {
      lines.push(`  မှတ်ချက်: ${acc.instructions}`);
    }
    lines.push("");
  }

  lines.push("⚠️ <b>ငွေလွှဲပြီးပါက Payment Slip ပုံကို ဤ Bot သို့ ပေးပို့ပေးပါခင်ဗျာ။</b>");

  return lines.join("\n").trim();
}
