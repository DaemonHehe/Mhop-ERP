import { describe, expect, it } from "vitest";
import { calculateOrderShipping, calculateShipping } from "@/lib/client-config";
import {
  bundleSchema,
  catalogItemSchema,
  expenseSchema,
  leadSchema,
  orderSchema,
  purchaseSchema,
  supplierSchema,
  warrantyLookupSchema,
} from "@/lib/validation/schemas";
import { allocateDiscountedUnits } from "@/lib/order-pricing";

describe("MH OP commerce rules", () => {
  it("applies each delivery threshold exactly", () => {
    expect(calculateShipping(49_999, "yangonInner")).toBe(4_500);
    expect(calculateShipping(50_000, "yangonInner")).toBe(0);
    expect(calculateShipping(59_999, "yangonOuter")).toBe(5_000);
    expect(calculateShipping(60_000, "yangonOuter")).toBe(0);
    expect(calculateShipping(69_999, "otherCities")).toBe(5_000);
    expect(calculateShipping(70_000, "otherCities")).toBe(0);
  });

  it("never charges delivery for a digital-only PUBG account order", () => {
    expect(calculateOrderShipping(10_000, "yangonInner", true)).toBe(0);
    expect(calculateOrderShipping(2_450_000, "otherCities", true)).toBe(0);
    expect(calculateOrderShipping(10_000, "yangonInner", false)).toBe(4_500);
  });

  it("validates checkout identity and payment inputs without trusting a posted total", () => {
    const parsed = orderSchema.parse({
      customerName: "Ko Min",
      phone: "09700000000",
      shippingZone: "yangonInner",
      paymentMethod: "kbzpay",
      totalAmount: 1,
    });
    expect(parsed).not.toHaveProperty("totalAmount");
  });

  it("requires the public warranty order-code format", () => {
    expect(
      warrantyLookupSchema.safeParse({
        orderCode: "MHOP-260829-AB12",
        phone: "09700000000",
      }).success,
    ).toBe(true);
    expect(
      warrantyLookupSchema.safeParse({ orderCode: "bad", phone: "09700000000" })
        .success,
    ).toBe(false);
  });

  it("validates catalog money, SKU, and safe image rules", () => {
    const base = {
      name: "Phone Cooler",
      brand: "MEMO",
      category: "Gaming Gadgets",
      subcategory: "Cooling Fans",
      description: "",
      imageUrl: "https://example.com/item.jpg",
      sku: "memo-dl05",
      color: "Black",
      price: "65000",
      costPrice: "42000",
      warrantyMonths: "3",
      stockQuantity: "4",
      lowStockThreshold: "2",
    };
    const parsed = catalogItemSchema.parse(base);
    expect(parsed.sku).toBe("MEMO-DL05");
    expect(parsed.price).toBe(65000);
    expect(
      catalogItemSchema.safeParse({ ...base, imageUrl: "javascript:alert(1)" })
        .success,
    ).toBe(false);
    expect(
      catalogItemSchema.safeParse({ ...base, costPrice: "70000" }).success,
    ).toBe(false);
  });

  it("validates ERP supplier, purchase and expense inputs", () => {
    expect(
      supplierSchema.safeParse({
        name: "Official Distributor",
        phone: "09700000000",
        email: "sales@example.com",
        address: "Yangon",
        notes: "",
      }).success,
    ).toBe(true);
    expect(
      purchaseSchema.safeParse({
        supplierId: "30000000-0000-4000-8000-000000000001",
        variantId: "20000000-0000-4000-8000-000000000001",
        quantity: "5",
        unitCost: "1000",
        notes: "",
      }).success,
    ).toBe(true);
    expect(
      purchaseSchema.safeParse({
        supplierId: "bad",
        variantId: "bad",
        quantity: "0",
        unitCost: "-1",
        notes: "",
      }).success,
    ).toBe(false);
    expect(
      expenseSchema.safeParse({
        category: "Marketing",
        description: "Campaign",
        amount: "250000",
        paymentMethod: "KBZPay",
        expenseDate: "2026-08-29",
      }).success,
    ).toBe(true);
  });

  it("requires a reachable contact for manually managed leads", () => {
    const lead = {
      customerName: "Ko Min",
      phone: "09700000000",
      telegramUserId: "",
      interestedIn: "Gaming earbuds under 100,000 MMK",
      stage: "new",
      reserveExpiresAt: "",
    };
    expect(leadSchema.safeParse(lead).success).toBe(true);
    expect(
      leadSchema.safeParse({ ...lead, phone: "", telegramUserId: "" }).success,
    ).toBe(false);
  });

  it("validates unique multi-product bundle sets", () => {
    const bundle = {
      name: "Rank Push",
      description: "Set",
      bundlePrice: "350000",
      items: [
        { sku: "GMS-G8", quantity: "1" },
        { sku: "MEMO-DL05", quantity: "2" },
      ],
    };
    expect(bundleSchema.safeParse(bundle).success).toBe(true);
    expect(
      bundleSchema.safeParse({
        ...bundle,
        items: [
          { sku: "GMS-G8", quantity: 1 },
          { sku: "GMS-G8", quantity: 2 },
        ],
      }).success,
    ).toBe(false);
  });

  it("allocates a bundle discount exactly across stored order units", () => {
    const units = allocateDiscountedUnits(
      [
        { key: "A", retailPrice: 100, quantity: 2 },
        { key: "B", retailPrice: 75, quantity: 1 },
      ],
      230,
    );
    expect(units).toHaveLength(3);
    expect(units.reduce((sum, item) => sum + item.unitPrice, 0)).toBe(230);
  });
});
