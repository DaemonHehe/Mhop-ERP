import { describe, expect, it } from "vitest";
import { catalogItemSchema } from "@/lib/validation/schemas";
import { CANONICAL_SUBCATEGORIES } from "@/lib/data";

describe("Inventory Subcategory CRUD & Filtering", () => {
  const baseGadget = {
    name: "RedMagic Cooler 5 Pro",
    brand: "RedMagic",
    category: "Gaming Gadgets" as const,
    subcategory: "Cooling Fans",
    sku: "RM-COOL-05",
    price: "85000",
    costPrice: "60000",
    warrantyMonths: "6",
    stockQuantity: "8",
    lowStockThreshold: "2",
  };

  const baseAccount = {
    name: "Conqueror S19 Account",
    brand: "PUBG Mobile",
    category: "PUBG Accounts" as const,
    subcategory: "Competitive Accounts",
    sku: "PUBG-CONQ-S19",
    price: "350000",
    costPrice: "300000",
    warrantyMonths: "0",
    stockQuantity: "0",
    lowStockThreshold: "0",
  };

  describe("Canonical Subcategories Alignment", () => {
    it("defines canonical subcategories for Gaming Gadgets and PUBG Accounts", () => {
      expect(CANONICAL_SUBCATEGORIES["Gaming Gadgets"]).toEqual([
        "Gaming Headphones",
        "Cooling Fans",
        "Controllers",
        "Charging Gear",
        "Gaming Earbuds",
      ]);

      expect(CANONICAL_SUBCATEGORIES["PUBG Accounts"]).toEqual([
        "Starter Accounts",
        "Competitive Accounts",
        "Collector Accounts",
      ]);
    });

    it("validates all canonical Gaming Gadget subcategories through catalogItemSchema", () => {
      for (const subcategory of CANONICAL_SUBCATEGORIES["Gaming Gadgets"]) {
        const parsed = catalogItemSchema.safeParse({
          ...baseGadget,
          subcategory,
        });
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data.subcategory).toBe(subcategory);
        }
      }
    });

    it("validates all canonical PUBG Account subcategories through catalogItemSchema", () => {
      for (const subcategory of CANONICAL_SUBCATEGORIES["PUBG Accounts"]) {
        const parsed = catalogItemSchema.safeParse({
          ...baseAccount,
          subcategory,
        });
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data.subcategory).toBe(subcategory);
        }
      }
    });
  });

  describe("Subcategory Update and Custom Values", () => {
    it("allows updating an existing gadget listing to a different subcategory", () => {
      // Admin changes product from Cooling Fans to Controllers
      const updatedInput = {
        ...baseGadget,
        subcategory: "Controllers",
        price: "95000",
      };
      const parsed = catalogItemSchema.parse(updatedInput);
      expect(parsed.subcategory).toBe("Controllers");
      expect(parsed.price).toBe(95000);
    });

    it("allows custom subcategories when staff define non-canonical equipment", () => {
      const customInput = {
        ...baseGadget,
        subcategory: "Gaming Trigger Grips",
      };
      const parsed = catalogItemSchema.parse(customInput);
      expect(parsed.subcategory).toBe("Gaming Trigger Grips");
    });

    it("trims whitespace from subcategories during validation", () => {
      const paddedInput = {
        ...baseGadget,
        subcategory: "  Gaming Earbuds  ",
      };
      const parsed = catalogItemSchema.parse(paddedInput);
      expect(parsed.subcategory).toBe("Gaming Earbuds");
    });
  });

  describe("Subcategory Filtering Logic", () => {
    const mockInventory = [
      { id: "1", name: "Razer BlackShark V2", category: "Gaming Gadgets", subcategory: "Gaming Headphones" },
      { id: "2", name: "Black Shark FunCooler", category: "Gaming Gadgets", subcategory: "Cooling Fans" },
      { id: "3", name: "Flydigi Apex 4", category: "Gaming Gadgets", subcategory: "Controllers" },
      { id: "4", name: "Custom VR Stand", category: "Gaming Gadgets", subcategory: "Custom Equipment" },
      { id: "5", name: "Starter Lvl 30", category: "PUBG Accounts", subcategory: "Starter Accounts" },
      { id: "6", name: "M416 Glacier Max", category: "PUBG Accounts", subcategory: "Collector Accounts" },
    ];

    it("returns all items in category when subcategory filter is 'All'", () => {
      const filter: string = "All";
      const category = "Gaming Gadgets";
      const results = mockInventory.filter(
        (item) => item.category === category && (filter === "All" || item.subcategory === filter),
      );
      expect(results).toHaveLength(4);
    });

    it("filters items by specific canonical subcategory", () => {
      const filter: string = "Cooling Fans";
      const category = "Gaming Gadgets";
      const results = mockInventory.filter(
        (item) => item.category === category && (filter === "All" || item.subcategory === filter),
      );
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Black Shark FunCooler");
    });

    it("filters items by custom subcategory", () => {
      const filter: string = "Custom Equipment";
      const category = "Gaming Gadgets";
      const results = mockInventory.filter(
        (item) => item.category === category && (filter === "All" || item.subcategory === filter),
      );
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Custom VR Stand");
    });
  });
});
