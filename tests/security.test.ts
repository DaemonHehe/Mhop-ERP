import { beforeEach, describe, expect, it } from "vitest";
import {
  clearRateLimitsForTests,
  consumeRateLimit,
  resetRateLimit,
} from "@/lib/security/rate-limit";
import {
  toPublicCatalogItem,
  type InventoryItem,
} from "@/lib/services/stock.service";
import { toPublicBundle, type BundleSet } from "@/lib/services/bundle.service";

describe("public commerce data", () => {
  const inventory: InventoryItem = {
    id: "product",
    variantId: "variant",
    name: "Headset",
    brand: "Brand",
    category: "Gaming Gadgets",
    subcategory: "Gaming Headphones",
    image: "/placeholder.svg",
    sku: "TEST-SKU",
    color: "Black",
    storage: null,
    ram: null,
    condition: "Brand New Sealed",
    price: 200,
    cost: 100,
    stock: 2,
    warranty: 6,
    tagline: "Test",
    specs: [],
    description: "Test",
    lowStockThreshold: 3,
  };

  it("removes internal cost, condition, and exact stock", () => {
    const result = toPublicCatalogItem(inventory);
    expect(result.availability).toBe("low");
    expect(result).not.toHaveProperty("cost");
    expect(result).not.toHaveProperty("stock");
    expect(result).not.toHaveProperty("condition");
    expect(result).not.toHaveProperty("lowStockThreshold");
  });

  it("removes exact bundle and item quantities", () => {
    const bundle: BundleSet = {
      id: "bundle",
      name: "Set",
      description: "Test",
      bundlePrice: 180,
      retailValue: 200,
      savings: 20,
      available: 1,
      items: [
        {
          sku: "TEST-SKU",
          name: "Headset",
          quantity: 1,
          unitPrice: 200,
          stock: 8,
          image: "/placeholder.svg",
        },
      ],
    };
    const result = toPublicBundle(bundle);
    expect(result.availability).toBe("low");
    expect(result).not.toHaveProperty("available");
    expect(result.items[0]).not.toHaveProperty("stock");
  });
});

describe("rate limiting", () => {
  beforeEach(clearRateLimitsForTests);

  it("allows the configured burst and blocks the next request", () => {
    expect(consumeRateLimit("login:test", 2, 1_000, 0)).toBe(true);
    expect(consumeRateLimit("login:test", 2, 1_000, 1)).toBe(true);
    expect(consumeRateLimit("login:test", 2, 1_000, 2)).toBe(false);
  });

  it("opens a fresh bucket after the window", () => {
    expect(consumeRateLimit("lookup:test", 1, 1_000, 0)).toBe(true);
    expect(consumeRateLimit("lookup:test", 1, 1_000, 999)).toBe(false);
    expect(consumeRateLimit("lookup:test", 1, 1_000, 1_000)).toBe(true);
  });

  it("clears a failure bucket after successful authentication", () => {
    expect(consumeRateLimit("login:account", 1, 1_000, 0)).toBe(true);
    expect(consumeRateLimit("login:account", 1, 1_000, 1)).toBe(false);
    resetRateLimit("login:account");
    expect(consumeRateLimit("login:account", 1, 1_000, 2)).toBe(true);
  });
});
