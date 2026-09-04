import { describe, expect, it } from "vitest";
import { evaluateWarrantyPolicy } from "@/lib/warranty-policy";

const delivered = {
  paymentStatus: "verified",
  fulfillmentStatus: "delivered",
  deliveredAt: new Date("2026-01-15T00:00:00Z"),
  orderCreatedAt: new Date("2026-01-10T00:00:00Z"),
};

describe("warranty policy", () => {
  it("starts active coverage from delivery", () => {
    const result = evaluateWarrantyPolicy({
      ...delivered,
      warrantyMonths: 6,
      now: new Date("2026-04-01T00:00:00Z"),
    });
    expect(result.eligible).toBe(true);
    expect(result.startAt).toEqual(delivered.deliveredAt);
    expect(result.status).toBe("Active");
  });

  it("rejects unpaid, undelivered, expired, and uncovered claims", () => {
    expect(
      evaluateWarrantyPolicy({
        ...delivered,
        paymentStatus: "pending",
        warrantyMonths: 6,
      }).eligible,
    ).toBe(false);
    expect(
      evaluateWarrantyPolicy({
        ...delivered,
        fulfillmentStatus: "packing",
        warrantyMonths: 6,
      }).status,
    ).toBe("Pending delivery");
    expect(
      evaluateWarrantyPolicy({ ...delivered, warrantyMonths: 0 }).status,
    ).toBe("Not covered");
    expect(
      evaluateWarrantyPolicy({
        ...delivered,
        warrantyMonths: 1,
        now: new Date("2026-03-01T00:00:00Z"),
      }).status,
    ).toBe("Expired");
  });
});
