import { describe, expect, it } from "vitest";
import { catalogItemSchema } from "@/lib/validation/schemas";
import { canPurchaseListing } from "@/lib/listing-rules";
import { CANONICAL_SUBCATEGORIES } from "@/lib/data";

describe("Preorder Items Support", () => {
  describe("catalogItemSchema for Preorder Items", () => {
    it("accepts valid preorder item with waiting time and 0 stock", () => {
      const parsed = catalogItemSchema.safeParse({
        name: "PlayStation Portal Remote Player (Japan Ver)",
        brand: "Sony",
        category: "Preorder Items",
        subcategory: "Upcoming Releases",
        sku: "PS-PORTAL-JP",
        price: 680000,
        costPrice: 590000,
        stockQuantity: 0,
        lowStockThreshold: 0,
        warrantyMonths: 1,
        color: "White",
        description: "Official Japan stock, eta 7-10 business days upon confirmation.",
        waitingTime: "7-10 business days",
        imageUrl: "https://example.com/ps-portal.jpg",
        imageUrls: ["https://example.com/ps-portal.jpg"],
      });

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.category).toBe("Preorder Items");
        expect(parsed.data.waitingTime).toBe("7-10 business days");
        expect(parsed.data.stockQuantity).toBe(0);
      }
    });

    it("rejects preorder item if stock quantity is greater than zero", () => {
      const parsed = catalogItemSchema.safeParse({
        name: "Steam Deck OLED 1TB",
        brand: "Valve",
        category: "Preorder Items",
        subcategory: "Preorder Gadgets",
        sku: "VALVE-OLED-1TB",
        price: 2450000,
        costPrice: 2150000,
        stockQuantity: 5, // Invalid for Preorder Items
        lowStockThreshold: 0,
        warrantyMonths: 3,
        waitingTime: "2-3 weeks",
        imageUrl: "https://example.com/deck.jpg",
      });

      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain("do not hold stock");
      }
    });

    it("rejects waiting time exceeding 80 characters", () => {
      const parsed = catalogItemSchema.safeParse({
        name: "Custom Edition Controller",
        brand: "MH OP",
        category: "Preorder Items",
        subcategory: "Custom Orders",
        sku: "MH-CUSTOM-01",
        price: 350000,
        costPrice: 250000,
        stockQuantity: 0,
        lowStockThreshold: 0,
        warrantyMonths: 1,
        waitingTime: "A".repeat(81),
        imageUrl: "https://example.com/custom.jpg",
      });

      expect(parsed.success).toBe(false);
    });
  });

  describe("canPurchaseListing for Preorder Items", () => {
    it("allows ordering any positive quantity of preorder items regardless of 0 stock", () => {
      const preorderListing = {
        category: "Preorder Items" as const,
        stock: 0,
        listingStatus: "available" as const,
      };

      expect(canPurchaseListing(preorderListing, 1)).toBe(true);
      expect(canPurchaseListing(preorderListing, 5)).toBe(true);
      expect(canPurchaseListing(preorderListing, 50)).toBe(true);
    });

    it("blocks preorder purchasing if listing is withdrawn", () => {
      const withdrawnPreorder = {
        category: "Preorder Items" as const,
        stock: 0,
        listingStatus: "withdrawn" as const,
      };

      expect(canPurchaseListing(withdrawnPreorder, 1)).toBe(false);
    });

    it("blocks preorder purchasing for non-positive or non-integer quantities", () => {
      const preorderListing = {
        category: "Preorder Items" as const,
        stock: 0,
        listingStatus: "available" as const,
      };

      expect(canPurchaseListing(preorderListing, 0)).toBe(false);
      expect(canPurchaseListing(preorderListing, -1)).toBe(false);
      expect(canPurchaseListing(preorderListing, 2.5)).toBe(false);
    });
  });

  describe("Canonical Subcategories", () => {
    it("defines standard preorder subcategories", () => {
      expect(CANONICAL_SUBCATEGORIES["Preorder Items"]).toEqual([
        "Upcoming Releases",
        "Preorder Gadgets",
        "Special Editions",
        "Custom Orders",
      ]);
    });
  });
});
