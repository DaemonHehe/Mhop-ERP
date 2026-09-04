import { describe, expect, it } from "vitest";
import { getSalesPolicy, searchSalesCatalog } from "@/lib/ai/sales-agent";
import type { PublicCatalogItem } from "@/lib/services/stock.service";

const product: PublicCatalogItem = {
  id: "product-1",
  variantId: "variant-1",
  name: "Cloud Earbuds 2",
  brand: "HyperX",
  category: "Gaming Gadgets",
  subcategory: "Gaming Earbuds",
  image: "/earbuds.png",
  sku: "HX-EB2",
  color: "Black",
  storage: null,
  ram: null,
  price: 129000,
  warranty: 6,
  tagline: "HyperX Gaming Gadgets",
  specs: [],
  description: "Low-latency USB-C earbuds",
  availability: "available",
};

describe("customer sales agent tools", () => {
  it("returns customer-safe catalog data without internal stock or cost", () => {
    const result = searchSalesCatalog(
      { products: [product], bundles: [] },
      { query: "earbuds", category: "gadgets", max_price: 150000 },
    );

    expect(result.products).toHaveLength(1);
    expect(result.products[0]).toMatchObject({
      name: "Cloud Earbuds 2",
      price_mmk: 129000,
      availability: "available",
    });
    expect(result.products[0]).not.toHaveProperty("stock");
    expect(result.products[0]).not.toHaveProperty("cost");
  });

  it("filters products outside the customer budget", () => {
    const result = searchSalesCatalog(
      { products: [product], bundles: [] },
      { query: "earbuds", category: "all", max_price: 100000 },
    );
    expect(result.products).toEqual([]);
  });

  it("states that PUBG digital assets never carry delivery fees", () => {
    const policy = getSalesPolicy("shipping");
    expect(policy).toHaveProperty(
      "important",
      "PUBG accounts are digital assets: no delivery fee or courier delivery applies.",
    );
  });
});
