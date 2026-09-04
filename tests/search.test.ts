import { describe, expect, it } from "vitest";
import { searchBusiness } from "@/lib/services/search.service";

describe("global business search", () => {
  it("finds products by product name and SKU", async () => {
    const byName = await searchBusiness("BlackShark");
    const bySku = await searchBusiness("RZR-BSV2X");

    expect(byName).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "Product", label: "BlackShark V2 X" }),
      ]),
    );
    expect(bySku.some((result) => result.type === "Product")).toBe(true);
  });

  it("finds orders and their derived customers", async () => {
    const orderResults = await searchBusiness("1042");
    const customerResults = await searchBusiness("Thiri");

    expect(orderResults.some((result) => result.type === "Order")).toBe(true);
    expect(customerResults.some((result) => result.type === "Customer")).toBe(
      true,
    );
  });

  it("does not search incomplete queries", async () => {
    await expect(searchBusiness("a")).resolves.toEqual([]);
  });
});
