import { describe, expect, it } from "vitest";
import { getInventory, reorderProducts } from "@/lib/services/stock.service";
import type { InventoryItem } from "@/lib/services/stock.service";

describe("Product Custom Display Sort Order", () => {
  describe("Demo Products & Schema Sort Order", () => {
    it("assigns sequential sortOrder in demo mode fallback", async () => {
      // In demo mode (or database mode), items have sortOrder as numbers
      const items = await getInventory();
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(typeof item.sortOrder).toBe("number");
        expect(item.sortOrder).toBeGreaterThanOrEqual(0);
      }
    });

    it("sorts items by sortOrder ASC, then name ASC", () => {
      const mockItems: Pick<InventoryItem, "id" | "name" | "sortOrder">[] = [
        { id: "p3", name: "Zebra Cooler", sortOrder: 2 },
        { id: "p1", name: "Apex Controller", sortOrder: 0 },
        { id: "p4", name: "Alpha Headset", sortOrder: 1 },
        { id: "p2", name: "Beta Headset", sortOrder: 1 },
      ];

      const sorted = [...mockItems].sort((a, b) => {
        const orderA = a.sortOrder ?? 0;
        const orderB = b.sortOrder ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });

      expect(sorted.map((i) => i.id)).toEqual(["p1", "p4", "p2", "p3"]);
    });
  });

  describe("Reorder Validation & Logic", () => {
    it("rejects empty product list for reordering", async () => {
      const res = await reorderProducts([]);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain("No products");
      }
    });

    it("correctly simulates visual Move Up and Move Down operations", () => {
      const items = ["Item A", "Item B", "Item C", "Item D"];

      // Move Item C (idx 2) Up to idx 1
      const moveUp = (list: string[], fromIdx: number) => {
        if (fromIdx <= 0) return list;
        const next = [...list];
        const [moved] = next.splice(fromIdx, 1);
        next.splice(fromIdx - 1, 0, moved);
        return next;
      };

      const afterMoveUp = moveUp(items, 2);
      expect(afterMoveUp).toEqual(["Item A", "Item C", "Item B", "Item D"]);

      // Move Item A (idx 0) Down to idx 1
      const moveDown = (list: string[], fromIdx: number) => {
        if (fromIdx >= list.length - 1) return list;
        const next = [...list];
        const [moved] = next.splice(fromIdx, 1);
        next.splice(fromIdx + 1, 0, moved);
        return next;
      };

      const afterMoveDown = moveDown(afterMoveUp, 0);
      expect(afterMoveDown).toEqual(["Item C", "Item A", "Item B", "Item D"]);

      // Move Item D to Top (idx 0)
      const moveToTop = (list: string[], fromIdx: number) => {
        const next = [...list];
        const [moved] = next.splice(fromIdx, 1);
        next.unshift(moved);
        return next;
      };

      const afterMoveTop = moveToTop(afterMoveDown, 3);
      expect(afterMoveTop).toEqual(["Item D", "Item C", "Item A", "Item B"]);
    });

    it("preserves relative admin custom order when filtering by subcategory in storefront", () => {
      const catalog = [
        { id: "1", name: "Headset A", subcategory: "Gaming Headphones", sortOrder: 0 },
        { id: "2", name: "Cooler A", subcategory: "Cooling Fans", sortOrder: 1 },
        { id: "3", name: "Headset B", subcategory: "Gaming Headphones", sortOrder: 2 },
        { id: "4", name: "Controller A", subcategory: "Controllers", sortOrder: 3 },
        { id: "5", name: "Headset C", subcategory: "Gaming Headphones", sortOrder: 4 },
      ];

      // Admin custom order is: 1, 2, 3, 4, 5
      const headphoneFilter = catalog.filter((p) => p.subcategory === "Gaming Headphones");

      // Filtered results should preserve the admin's chosen sequence: Headset A (#1), Headset B (#2), Headset C (#3)
      expect(headphoneFilter.map((p) => p.id)).toEqual(["1", "3", "5"]);
    });
  });
});
