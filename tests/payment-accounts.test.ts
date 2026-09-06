import { describe, expect, it } from "vitest";
import {
  formatBankAccountsTelegramMessage,
  getPaymentAccounts,
  getActivePaymentAccounts,
} from "@/lib/services/payment-account.service";

describe("Payment Accounts Service", () => {
  it("provides default fallback accounts when db is not connected", async () => {
    const accounts = await getPaymentAccounts();
    expect(accounts.length).toBeGreaterThanOrEqual(3);

    const kpay = accounts.find((a) => a.bankName.includes("KBZPay"));
    expect(kpay).toBeDefined();
    expect(kpay?.accountNumber).toBe("09798888123");
    expect(kpay?.accountHolder).toBe("Ko Ko Kyaw");
  });

  it("getActivePaymentAccounts returns active accounts", async () => {
    const active = await getActivePaymentAccounts();
    expect(active.length).toBeGreaterThan(0);
    expect(active.every((a) => a.isActive)).toBe(true);
  });

  it("formats Telegram bank accounts message with monospace codes for tap-to-copy", async () => {
    const message = await formatBankAccountsTelegramMessage();
    expect(message).toContain("ငွေလွှဲရန် အကောင့်အချက်အလက်များ");
    expect(message).toContain("KBZPay");
    expect(message).toContain("<code>09798888123</code>");
    expect(message).toContain("WavePay");
    expect(message).toContain("KBZ Bank");
    expect(message).toContain("<code>0123456789012</code>");
    expect(message).toContain("Payment Slip");
  });

  it("prioritizes chosen payment method in Telegram message", async () => {
    const message = await formatBankAccountsTelegramMessage("wavepay");
    expect(message).toContain("လူကြီးမင်း ရွေးချယ်ထားသော စနစ်");
    expect(message).toContain("WavePay");
  });
});
