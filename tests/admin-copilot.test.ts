import { describe, it, expect } from "vitest";
import {
  searchInternalOrders,
  searchInternalCustomers,
  lookupInternalWarranty,
  checkInternalInventory,
  getInternalBusinessSnapshot,
  synthesizePatternResponse,
  askAdminCopilot,
} from "@/lib/ai/admin-copilot";
import { getGeminiConfig, getOpenRouterConfig } from "@/lib/services/settings.service";

describe("Admin Copilot Internal Query Engine", () => {
  it("should search orders by keyword and status", async () => {
    const orders = await searchInternalOrders({ limit: 5 });
    expect(Array.isArray(orders)).toBe(true);
    expect(orders.length).toBeGreaterThan(0);

    const first = orders[0];
    expect(first).toHaveProperty("orderCode");
    expect(first).toHaveProperty("customer");
    expect(first).toHaveProperty("amount");
    expect(first).toHaveProperty("paymentStatus");
    expect(first).toHaveProperty("fulfillmentStatus");
  });

  it("should search customers", async () => {
    const customers = await searchInternalCustomers({ limit: 5 });
    expect(Array.isArray(customers)).toBe(true);
    expect(customers.length).toBeGreaterThan(0);

    const first = customers[0];
    expect(first).toHaveProperty("name");
    expect(first).toHaveProperty("phone");
    expect(first).toHaveProperty("totalOrders");
    expect(first).toHaveProperty("lifetimeSpend");
  });

  it("should check inventory stock levels and low stock filter", async () => {
    const inventory = await checkInternalInventory({ limit: 10 });
    expect(Array.isArray(inventory)).toBe(true);
    expect(inventory.length).toBeGreaterThan(0);

    const lowStock = await checkInternalInventory({ lowStockOnly: true });
    expect(Array.isArray(lowStock)).toBe(true);
    for (const item of lowStock) {
      expect(item.stock).toBeLessThanOrEqual(item.lowStockThreshold);
    }
  });

  it("should calculate real-time internal business snapshot", async () => {
    const snapshot = await getInternalBusinessSnapshot();
    expect(snapshot).toHaveProperty("totalOrdersCount");
    expect(snapshot).toHaveProperty("totalVerifiedRevenue");
    expect(snapshot).toHaveProperty("pendingPaymentSlipsCount");
    expect(snapshot).toHaveProperty("lowStockItemsCount");
  });

  it("should lookup warranty details for known order", async () => {
    const orders = await searchInternalOrders({ limit: 1 });
    if (orders.length > 0) {
      const o = orders[0];
      const warranty = await lookupInternalWarranty({
        orderCode: o.orderCode,
        phone: o.phone,
      });

      expect(warranty).not.toBeNull();
      if (warranty) {
        expect(warranty.orderCode).toBe(o.orderCode);
        expect(Array.isArray(warranty.items)).toBe(true);
        expect(warranty.items[0]).toHaveProperty("coverageStatus");
      }
    }
  });

  it("should synthesize pattern responses for order status queries", async () => {
    const orders = await searchInternalOrders({ limit: 1 });
    if (orders.length > 0) {
      const code = orders[0].orderCode;
      const res = await synthesizePatternResponse(`What is the status of ${code}?`);
      expect(res.mode).toBe("pattern_fallback");
      expect(res.answer).toContain(code);
      expect(res.toolCalls.length).toBeGreaterThan(0);
    }
  });

  it("should synthesize Burmese pattern response for inventory inquiries", async () => {
    const res = await synthesizePatternResponse("လက်ကျန်နည်းနေသော ပစ္စည်းများ ပြပေးပါ");
    expect(res.mode).toBe("pattern_fallback");
    expect(res.answer).toContain("လက်ကျန်");
    expect(res.toolCalls.some((tc) => tc.name === "check_inventory")).toBe(true);
  });

  it("should synthesize business summary for revenue inquiries", async () => {
    const res = await synthesizePatternResponse("Show me today's revenue and pending orders");
    expect(res.mode).toBe("pattern_fallback");
    expect(res.answer).toMatch(/(Revenue|Snapshot|Orders)/i);
    expect(res.toolCalls.some((tc) => tc.name === "get_business_summary")).toBe(true);
  });

  it("should run askAdminCopilot seamlessly without crashing in zero-key environment", async () => {
    const res = await askAdminCopilot({
      question: "Hello, what can you do?",
    });
    expect(res).toHaveProperty("answer");
    expect(res).toHaveProperty("mode");
    expect(res.answer.length).toBeGreaterThan(10);
  });

  it("should read gemini config with default model", async () => {
    const config = await getGeminiConfig();
    expect(config.model).toBe("gemini-2.5-flash");
    expect(config).toHaveProperty("isConfigured");
    expect(config).toHaveProperty("source");
  });

  it("should read openrouter config with default google/gemini-2.0-flash-exp:free model", async () => {
    const config = await getOpenRouterConfig();
    expect(config.model).toBe("google/gemini-2.0-flash-exp:free");
    expect(config).toHaveProperty("isConfigured");
    expect(config).toHaveProperty("source");
  });
});
