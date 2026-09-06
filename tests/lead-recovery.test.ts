import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), send: vi.fn(), limit: vi.fn(), audit: vi.fn() }));
vi.mock("@/db", () => ({ db: { select: () => ({ from: mocks.from }) } }));
vi.mock("@/lib/telegram/bot", () => ({ sendTelegramMessage: mocks.send }));
vi.mock("@/lib/security/rate-limit", () => ({ consumeRateLimit: mocks.limit }));
vi.mock("@/lib/services/audit.service", () => ({ audit: mocks.audit }));
import { getRecoveryLeads, sendRecoveryReminder, isAutomationRecoveryLead } from "@/lib/services/lead-recovery.service";
const order = { id: "one", customerId: "person", customerName: "Buyer", phone: "09123", telegramUserId: "123", orderCode: "MHOP-test", paymentStatus: "pending", fulfillmentStatus: "new", paymentSlipUrl: null, createdAt: new Date("2026-09-05") };
function data(purchases: unknown[] = [], sessions: unknown[] = []) {
  mocks.from.mockResolvedValueOnce(sessions).mockResolvedValueOnce(purchases).mockResolvedValueOnce([]);
}
beforeEach(() => { vi.resetAllMocks(); mocks.limit.mockReturnValue(true); });
describe("purchase recovery", () => {
  it("excludes paid, cancelled, rejected and payment-review orders", async () => {
    data([order, { ...order, id: "paid", paymentStatus: "verified" }, { ...order, id: "cancelled", fulfillmentStatus: "cancelled" }, { ...order, id: "review", paymentSlipUrl: "slip" }, { ...order, id: "rejected", paymentStatus: "rejected" }]);
    expect((await getRecoveryLeads()).map((l) => l.id)).toEqual(["order:one"]);
  });
  it("includes identified catalog inquiry and removes it after purchase", async () => {
    const session = { id: "session", telegramUserId: "123", stateJson: { shoppingAt: "2026-09-04", privateChatId: 123 } };
    data([], [session]);
    expect((await getRecoveryLeads())[0].stage).toBe("browsing");
    data([{ ...order, paymentStatus: "verified" }], [session]);
    expect(await getRecoveryLeads()).toEqual([]);
  });
  it("rechecks eligibility before sending", async () => {
    data([{ ...order, paymentStatus: "verified" }]);
    expect((await sendRecoveryReminder("order:one")).ok).toBe(false);
    expect(mocks.send).not.toHaveBeenCalled();
    data([{ ...order, paymentStatus: "rejected" }]);
    expect((await sendRecoveryReminder("order:one")).ok).toBe(false);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("reports missing bot configuration without a successful audit", async () => {
    data([order]); mocks.send.mockResolvedValue({ delivered: false });
    expect((await sendRecoveryReminder("order:one")).ok).toBe(false);
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("sends through the customer bot and records delivery", async () => {
    data([order]); mocks.send.mockResolvedValue({ delivered: true });
    expect((await sendRecoveryReminder("order:one")).ok).toBe(true);
    expect(mocks.send).toHaveBeenCalledWith(123, expect.stringContaining("MHOP-test"));
    expect(mocks.audit).toHaveBeenCalled();
  });
});

it("scheduled recovery waits for inactivity and a private Telegram recipient", () => {
  const lead = { id: "x", customerName: "Buyer", phone: null, telegramUserId: "123", stage: "unpaid" as const, detail: "", activityAt: new Date(1000000) };
  expect(isAutomationRecoveryLead(lead, 1000000 + 899999)).toBe(false);
  expect(isAutomationRecoveryLead(lead, 1000000 + 900000)).toBe(true);
  expect(isAutomationRecoveryLead({ ...lead, telegramUserId: null }, 9999999)).toBe(false);
});
it("skips a scheduled reminder when purchase or activity changed after the scan", async () => {
  data([{ ...order, paymentStatus: "verified" }]);
  expect(await sendRecoveryReminder("order:one", "2026-09-05T00:00:00.000Z")).toMatchObject({ ok: true, skipped: true });
  data([order]);
  expect(await sendRecoveryReminder("order:one", "2026-09-04T00:00:00.000Z")).toMatchObject({ ok: true, skipped: true });
  expect(mocks.send).not.toHaveBeenCalled();
});
