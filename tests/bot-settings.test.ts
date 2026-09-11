import { describe, expect, it } from "vitest";
import {
  interpolateVariables,
  getBotMessageTemplates,
  formatWelcomeMessage,
  formatSlipAcknowledgment,
  formatManagerMorningBriefing,
  formatManagerFinancialDigest,
  formatManagerStaffAlert,
} from "@/lib/services/bot-settings.service";

describe("bot-settings.service", () => {
  describe("interpolateVariables", () => {
    it("replaces defined placeholder variables", () => {
      const template = "Hello {customer}, your order {order_code} has voucher {voucher}!";
      const result = interpolateVariables(template, {
        customer: "Ko Ko Kyaw",
        order_code: "MHOP-001",
        voucher: "MHOP10-001",
      });
      expect(result).toBe("Hello Ko Ko Kyaw, your order MHOP-001 has voucher MHOP10-001!");
    });

    it("leaves unknown or undefined tokens intact without crashing", () => {
      const template = "Hello {customer}, token {unknown_var} is here.";
      const result = interpolateVariables(template, {
        customer: "Thant",
      });
      expect(result).toBe("Hello Thant, token {unknown_var} is here.");
    });

    it("handles empty or falsy templates safely", () => {
      expect(interpolateVariables("", {})).toBe("");
    });
  });

  describe("getBotMessageTemplates defaults", () => {
    it("returns all 5 active automation message templates with proper metadata", async () => {
      const templates = await getBotMessageTemplates();
      expect(templates.length).toBe(5);

      const keys = templates.map((t) => t.key);
      expect(keys).not.toContain("ai_sales_agent");
      expect(keys).toContain("welcome");
      expect(keys).not.toContain("accessory_follow_up");
      expect(keys).toContain("slip_acknowledgment");
      expect(keys).toContain("manager_morning_briefing");
      expect(keys).toContain("manager_financial_digest");
      expect(keys).toContain("manager_staff_alert");

      for (const t of templates) {
        expect(t.label).toBeTruthy();
        expect(t.description).toBeTruthy();
        expect(t.triggerSource).toBeTruthy();
        expect(t.content).toBeTruthy();
        expect(Array.isArray(t.placeholders)).toBe(true);
      }
    });
  });

  describe("getSalesAgentInstructions", () => {
    it("returns active AI Sales Agent instructions mentioning Mh Op and fed store Q&A knowledge", async () => {
      const { getSalesAgentInstructions } = await import("@/lib/ai/sales-agent");
      const instructions = await getSalesAgentInstructions();
      expect(instructions).toContain("Mh Op");
      expect(instructions).toContain("PUBG");
      expect(instructions).toContain("STORE KNOWLEDGE BASE");
    });
  });

  describe("formatWelcomeMessage and formatSlipAcknowledgment", () => {
    it("formats welcome message", async () => {
      const text = await formatWelcomeMessage();
      expect(text).toContain("MH OP");
      expect(text).toContain("/catalog");
    });

    it("formats payment slip review acknowledgment", async () => {
      const text = await formatSlipAcknowledgment({ orderCode: "MHOP-1234" });
      expect(text).toContain("Payment Slip");
      expect(text).toContain("Admin Team");
    });
  });

  describe("Manager Bot formatters", () => {
    it("formats morning briefing with orders, revenue, and stock count", async () => {
      const text = await formatManagerMorningBriefing({
        unshipped: 4,
        pendingSlips: 2,
        revenue: "2,500,000",
        lowStockCount: 1,
        lowStockList: "• Phone Cooler (COOL-01): 2",
      });
      expect(text).toContain("GOOD MORNING");
      expect(text).toContain("Unshipped orders: 4");
      expect(text).toContain("Pending payments: 2");
      expect(text).toContain("2,500,000 MMK");
      expect(text).toContain("Phone Cooler");
    });

    it("formats nightly financial digest with revenue and gross profit", async () => {
      const text = await formatManagerFinancialDigest({
        unshipped: 2,
        pendingSlips: 0,
        revenue: "1,800,000",
        grossProfit: "450,000",
      });
      expect(text).toContain("NIGHTLY SNAPSHOT");
      expect(text).toContain("1,800,000 MMK");
      expect(text).toContain("450,000 MMK");
    });

    it("formats operational event alert", async () => {
      const text = await formatManagerStaffAlert({
        title: "Payment verified",
        body: "Slip confirmed for order",
        targetCode: "MHOP-260830-TEST",
        timestamp: "2026-09-09 15:30:00",
      });
      expect(text).toContain("Payment verified");
      expect(text).toContain("MHOP-260830-TEST");
    });
  });
});
