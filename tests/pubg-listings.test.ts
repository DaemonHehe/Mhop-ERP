import { describe, expect, it } from "vitest";
import { catalogItemSchema } from "@/lib/validation/schemas";
import { toPublicCatalogItem, type InventoryItem } from "@/lib/services/stock.service";
import { canPurchaseListing } from "@/lib/listing-rules";
const input = { name: "Player account", brand: "PUBG", category: "PUBG Accounts", subcategory: "Starter Accounts", sku: "PLAYER-1", price: 100000, costPrice: 90000, warrantyMonths: 0, lowStockThreshold: 0 };
describe("PUBG resale listings", () => {
  it("creates a normal resale listing without stock or seller details", () => {
    expect(catalogItemSchema.parse(input).stockQuantity).toBe(0);
    expect(catalogItemSchema.safeParse({ ...input, stockQuantity: 1 }).success).toBe(false);
    expect(catalogItemSchema.safeParse({ ...input, listingStatus: "in_stock" }).success).toBe(false);
  });
  it("offers one available account independent of stock and blocks reserved or sold accounts", () => {
    const item = { category: "PUBG Accounts", stock: 0, listingStatus: "available" };
    expect(canPurchaseListing(item, 1)).toBe(true);
    expect(canPurchaseListing(item, 2)).toBe(false);
    for (const listingStatus of ["reserved", "sold", "withdrawn"])
      expect(canPurchaseListing({ ...item, stock: 99, listingStatus }, 1)).toBe(false);
    expect(canPurchaseListing({ category: "Gaming Gadgets", stock: 2 }, 2)).toBe(true);
    expect(canPurchaseListing({ category: "Gaming Gadgets", stock: 2 }, 3)).toBe(false);
  });
  it("keeps purchase cost out of public catalog data", () => {
    const item = { ...input, stock: 0, cost: 90000, lowStockThreshold: 0, listingStatus: "available" } as unknown as InventoryItem;
    const result = toPublicCatalogItem(item);
    expect(result.availability).toBe("available");
    expect(result).not.toHaveProperty("cost");
    expect(result).not.toHaveProperty("stock");
    expect(toPublicCatalogItem({ ...item, listingStatus: "reserved" }).availability).toBe("sold_out");
  });
});
