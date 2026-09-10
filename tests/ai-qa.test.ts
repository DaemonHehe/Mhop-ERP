import { describe, expect, it } from "vitest";
import {
  DEFAULT_AI_QA_ITEMS,
  getAiSalesQaList,
  getActiveAiSalesQa,
  createAiSalesQa,
  updateAiSalesQa,
  deleteAiSalesQa,
  formatQaForPrompt,
  findMatchingQa,
} from "@/lib/services/ai-qa.service";

describe("ai-qa.service", () => {
  describe("default store Q&A knowledge", () => {
    it("provides 5 default high-utility store Q&As", async () => {
      const items = await getAiSalesQaList();
      expect(items.length).toBeGreaterThanOrEqual(5);

      const categories = items.map((x) => x.category);
      expect(categories).toContain("gaming_gadgets");
      expect(categories).toContain("pubg_accounts");
      expect(categories).toContain("delivery");
      expect(categories).toContain("payment");
      expect(categories).toContain("warranty");
    });

    it("returns active items only with getActiveAiSalesQa", async () => {
      const active = await getActiveAiSalesQa();
      expect(active.every((x) => x.isActive)).toBe(true);
    });
  });

  describe("formatQaForPrompt", () => {
    it("formats Q&A pairs into clear prompt markdown", () => {
      const formatted = formatQaForPrompt(DEFAULT_AI_QA_ITEMS);
      expect(formatted).toContain("[Q&A 1] (GAMING_GADGETS)");
      expect(formatted).toContain("iPhone");
      expect(formatted).toContain("PUBG Mobile account");
      expect(formatted).toContain("Royal Express");
    });

    it("handles empty lists gracefully", () => {
      expect(formatQaForPrompt([])).toBe("No custom Q&A fed yet.");
    });
  });

  describe("findMatchingQa", () => {
    it("matches inquiries about coolers to the gaming gadgets Q&A", () => {
      const match = findMatchingQa("iPhone 15 cooler ဘာသုံးရမလဲ", DEFAULT_AI_QA_ITEMS);
      expect(match).not.toBeNull();
      expect(match?.category).toBe("gaming_gadgets");
      expect(match?.answer).toContain("MagSafe");
    });

    it("matches inquiries about PUBG accounts", () => {
      const match = findMatchingQa("PUBG Mobile account ဘယ်လို လွှဲပေးလဲ", DEFAULT_AI_QA_ITEMS);
      expect(match).not.toBeNull();
      expect(match?.category).toBe("pubg_accounts");
      expect(match?.answer).toContain("rebind");
    });

    it("matches delivery inquiries", () => {
      const match = findMatchingQa("Royal Express ပစ္စည်းရောက်ဖို့ ဘယ်နှစ်ရက် ကြာမလဲ", DEFAULT_AI_QA_ITEMS);
      expect(match).not.toBeNull();
      expect(match?.category).toBe("delivery");
      expect(match?.answer).toContain("Yangon");
    });

    it("matches payment and deposit inquiries", () => {
      const match = findMatchingQa("Deposit ငွေ ဘယ်လောက် လွှဲရမလဲ KBZPay", DEFAULT_AI_QA_ITEMS);
      expect(match).not.toBeNull();
      expect(match?.category).toBe("payment");
      expect(match?.answer).toContain("10,000 MMK");
    });

    it("returns null for completely unrelated queries", () => {
      const match = findMatchingQa("spaceship flying to mars tomorrow", DEFAULT_AI_QA_ITEMS);
      expect(match).toBeNull();
    });
  });

  describe("CRUD operations", () => {
    it("validates empty question and answer", async () => {
      await expect(
        createAiSalesQa({ question: "", answer: "Some answer" }),
      ).rejects.toThrow("Question and Answer cannot be empty");

      await expect(
        createAiSalesQa({ question: "Some question?", answer: "   " }),
      ).rejects.toThrow("Question and Answer cannot be empty");
    });

    it("creates, updates, and deletes a custom Q&A item", async () => {
      const created = await createAiSalesQa(
        {
          question: "Can I test games at your physical store?",
          answer: "Yes, you can test headsets and phone coolers at our Yangon store.",
          category: "general",
        },
        "test_admin",
      );

      expect(created.id).toBeTruthy();
      expect(created.question).toBe("Can I test games at your physical store?");
      expect(created.isActive).toBe(true);

      const updated = await updateAiSalesQa(created.id, {
        answer: "Yes, gaming test stations are open daily 9 AM to 6 PM.",
      });
      expect(updated.answer).toBe("Yes, gaming test stations are open daily 9 AM to 6 PM.");

      const deleted = await deleteAiSalesQa(created.id);
      expect(deleted).toBe(true);

      const listAfter = await getAiSalesQaList();
      expect(listAfter.find((x) => x.id === created.id)).toBeUndefined();
    });
  });
});
