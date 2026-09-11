import { describe, expect, it } from "vitest";
import { canPurchaseListing } from "@/lib/listing-rules";
import { calculateRequiredDeposit } from "@/lib/shipping/royal-rates";

describe("Cart & Multiple Quantity Support", () => {
  describe("Listing purchase rules for gadgets vs accounts", () => {
    it("allows purchasing multiple units of physical gaming gadgets up to available stock", () => {
      const gadget = { category: "Gaming Gadgets", stock: 10 };
      expect(canPurchaseListing(gadget, 1)).toBe(true);
      expect(canPurchaseListing(gadget, 2)).toBe(true);
      expect(canPurchaseListing(gadget, 3)).toBe(true);
      expect(canPurchaseListing(gadget, 5)).toBe(true);
      expect(canPurchaseListing(gadget, 10)).toBe(true);
      // Beyond stock should be disallowed
      expect(canPurchaseListing(gadget, 11)).toBe(false);
    });

    it("restricts PUBG Accounts to exactly 1 unique item per listing", () => {
      const account = {
        category: "PUBG Accounts",
        stock: 0,
        listingStatus: "available",
      };
      expect(canPurchaseListing(account, 1)).toBe(true);
      expect(canPurchaseListing(account, 2)).toBe(false);
      expect(canPurchaseListing(account, 3)).toBe(false);
    });

    it("disallows non-integer or zero/negative quantities", () => {
      const gadget = { category: "Gaming Gadgets", stock: 10 };
      expect(canPurchaseListing(gadget, 0)).toBe(false);
      expect(canPurchaseListing(gadget, -1)).toBe(false);
      expect(canPurchaseListing(gadget, 1.5)).toBe(false);
    });
  });

  describe("SKU and Quantity Parsing", () => {
    function parseCartSkus(rawSkus: string[]) {
      const individualQuantities = new Map<string, number>();
      for (const raw of rawSkus) {
        const [sku, qtyStr] = raw.split(":");
        const cleanSku = (sku || "").trim();
        if (!cleanSku) continue;
        const count = qtyStr ? Math.max(1, parseInt(qtyStr, 10) || 1) : 1;
        individualQuantities.set(
          cleanSku,
          (individualQuantities.get(cleanSku) || 0) + count,
        );
      }
      return individualQuantities;
    }

    it("parses modern SKU:qty syntax correctly", () => {
      const input = ["MEMO-DL05-RGB:3", "GMS-G8-GALILEO:2"];
      const result = parseCartSkus(input);
      expect(result.get("MEMO-DL05-RGB")).toBe(3);
      expect(result.get("GMS-G8-GALILEO")).toBe(2);
    });

    it("parses repeated comma-separated SKUs correctly for backwards compatibility", () => {
      const input = [
        "MEMO-DL05-RGB",
        "MEMO-DL05-RGB",
        "MEMO-DL05-RGB",
        "MD-CHU2-DSP",
      ];
      const result = parseCartSkus(input);
      expect(result.get("MEMO-DL05-RGB")).toBe(3);
      expect(result.get("MD-CHU2-DSP")).toBe(1);
    });

    it("combines both SKU:qty and repeated SKUs gracefully", () => {
      const input = ["MEMO-DL05-RGB:2", "MEMO-DL05-RGB:1"];
      const result = parseCartSkus(input);
      expect(result.get("MEMO-DL05-RGB")).toBe(3);
    });
  });

  describe("Order Subtotal & Financial Matrix for Multi-Item Carts", () => {
    it("calculates correct subtotal, deposit, and COD for multiple gadgets", () => {
      const itemPrice = 35_000;
      const quantity = 3;
      const itemsSubtotal = itemPrice * quantity; // 105,000 MMK
      const deliveryFee = 3_500; // Yangon delivery
      const orderTotal = itemsSubtotal + deliveryFee; // 108,500 MMK

      // Standard physical item deposit is 10,000 MMK
      const requiredDeposit = calculateRequiredDeposit(orderTotal, false);
      expect(requiredDeposit).toBe(10_000);

      // Remaining COD to pay courier on delivery
      const codAmount = orderTotal - requiredDeposit;
      expect(codAmount).toBe(98_500);
    });
  });
});