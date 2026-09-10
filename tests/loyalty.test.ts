import { describe, expect, it } from "vitest";
import {
  calculatePointsFromAmount,
  calculateTierPerks,
  getTierForPoints,
  getTierProgress,
} from "@/lib/loyalty";
import { getSalesPolicy } from "@/lib/ai/sales-agent";

describe("Customer Loyalty Point & Tier System", () => {
  describe("Point Calculation (1000 MMK = 1 point)", () => {
    it("converts MMK spend to points correctly with floor division", () => {
      expect(calculatePointsFromAmount(0)).toBe(0);
      expect(calculatePointsFromAmount(500)).toBe(0);
      expect(calculatePointsFromAmount(999)).toBe(0);
      expect(calculatePointsFromAmount(1000)).toBe(1);
      expect(calculatePointsFromAmount(1999)).toBe(1);
      expect(calculatePointsFromAmount(2000)).toBe(2);
      expect(calculatePointsFromAmount(150000)).toBe(150);
      expect(calculatePointsFromAmount(523450)).toBe(523);
      expect(calculatePointsFromAmount(1200000)).toBe(1200);
    });

    it("handles negative and null amounts gracefully", () => {
      expect(calculatePointsFromAmount(-5000)).toBe(0);
      expect(calculatePointsFromAmount(Number.NaN)).toBe(0);
    });
  });

  describe("Tier Thresholds", () => {
    it("assigns Member tier for 0 to 199 points", () => {
      expect(getTierForPoints(0)).toBe("member");
      expect(getTierForPoints(50)).toBe("member");
      expect(getTierForPoints(199)).toBe("member");
    });

    it("assigns Silver tier for 200 to 499 points", () => {
      expect(getTierForPoints(200)).toBe("silver");
      expect(getTierForPoints(350)).toBe("silver");
      expect(getTierForPoints(499)).toBe("silver");
    });

    it("assigns Gold tier for 500 to 1000 points", () => {
      expect(getTierForPoints(500)).toBe("gold");
      expect(getTierForPoints(750)).toBe("gold");
      expect(getTierForPoints(1000)).toBe("gold");
    });

    it("assigns Platinum tier for 1001+ points", () => {
      expect(getTierForPoints(1001)).toBe("platinum");
      expect(getTierForPoints(1500)).toBe("platinum");
      expect(getTierForPoints(10000)).toBe("platinum");
    });
  });

  describe("Tier Perks & Checkout Calculations", () => {
    const subtotal = 100000;
    const deliveryFee = 4050;

    it("applies standard rates for Member tier (0% discount, full delivery)", () => {
      const perks = calculateTierPerks("member", subtotal, deliveryFee);
      expect(perks.tier).toBe("member");
      expect(perks.discountPercent).toBe(0);
      expect(perks.productDiscountAmount).toBe(0);
      expect(perks.netProductSubtotal).toBe(100000);
      expect(perks.isFreeDelivery).toBe(false);
      expect(perks.deliveryDiscountAmount).toBe(0);
      expect(perks.netDeliveryFee).toBe(4050);
      expect(perks.finalTotal).toBe(104050);
      expect(perks.pointsToEarn).toBe(104);
    });

    it("applies Free Delivery for Silver tier with 0% product discount", () => {
      const perks = calculateTierPerks("silver", subtotal, deliveryFee);
      expect(perks.tier).toBe("silver");
      expect(perks.discountPercent).toBe(0);
      expect(perks.productDiscountAmount).toBe(0);
      expect(perks.netProductSubtotal).toBe(100000);
      expect(perks.isFreeDelivery).toBe(true);
      expect(perks.deliveryDiscountAmount).toBe(4050);
      expect(perks.netDeliveryFee).toBe(0);
      expect(perks.finalTotal).toBe(100000);
      expect(perks.pointsToEarn).toBe(100);
    });

    it("applies Free Delivery + 5% product discount for Gold tier", () => {
      const perks = calculateTierPerks("gold", subtotal, deliveryFee);
      expect(perks.tier).toBe("gold");
      expect(perks.discountPercent).toBe(5);
      expect(perks.productDiscountAmount).toBe(5000); // 5% of 100,000
      expect(perks.netProductSubtotal).toBe(95000);
      expect(perks.isFreeDelivery).toBe(true);
      expect(perks.deliveryDiscountAmount).toBe(4050);
      expect(perks.netDeliveryFee).toBe(0);
      expect(perks.finalTotal).toBe(95000);
      expect(perks.pointsToEarn).toBe(95);
    });

    it("applies Free Delivery + 10% product discount for Platinum tier", () => {
      const perks = calculateTierPerks("platinum", subtotal, deliveryFee);
      expect(perks.tier).toBe("platinum");
      expect(perks.discountPercent).toBe(10);
      expect(perks.productDiscountAmount).toBe(10000); // 10% of 100,000
      expect(perks.netProductSubtotal).toBe(90000);
      expect(perks.isFreeDelivery).toBe(true);
      expect(perks.deliveryDiscountAmount).toBe(4050);
      expect(perks.netDeliveryFee).toBe(0);
      expect(perks.finalTotal).toBe(90000);
      expect(perks.pointsToEarn).toBe(90);
    });
  });

  describe("Tier Progression Tracking", () => {
    it("calculates gap to Silver for Member", () => {
      const progress = getTierProgress(75);
      expect(progress.currentTier).toBe("member");
      expect(progress.nextTier).toBe("silver");
      expect(progress.pointsNeeded).toBe(125); // 200 - 75
    });

    it("calculates gap to Gold for Silver", () => {
      const progress = getTierProgress(250);
      expect(progress.currentTier).toBe("silver");
      expect(progress.nextTier).toBe("gold");
      expect(progress.pointsNeeded).toBe(250); // 500 - 250
    });

    it("calculates gap to Platinum for Gold", () => {
      const progress = getTierProgress(750);
      expect(progress.currentTier).toBe("gold");
      expect(progress.nextTier).toBe("platinum");
      expect(progress.pointsNeeded).toBe(251); // 1001 - 750
    });

    it("shows max tier for Platinum", () => {
      const progress = getTierProgress(1500);
      expect(progress.currentTier).toBe("platinum");
      expect(progress.nextTier).toBeNull();
      expect(progress.pointsNeeded).toBe(0);
      expect(progress.percentToNext).toBe(100);
    });
  });

  describe("AI Sales Agent Store Policy", () => {
    it("returns accurate loyalty policy data", () => {
      const policy = getSalesPolicy("loyalty") as {
        earning_rate: string;
        tiers: Array<{ tier: string; points: string; perk: string }>;
        command: string;
      };

      expect(policy.earning_rate).toBe("1000 MMK = 1 point");
      expect(policy.tiers).toHaveLength(4);
      expect(policy.command).toBe("/points");

      const silver = policy.tiers.find((t) => t.tier === "Silver");
      const gold = policy.tiers.find((t) => t.tier === "Gold");
      const platinum = policy.tiers.find((t) => t.tier === "Platinum");

      expect(silver?.perk).toContain("Free Delivery");
      expect(gold?.perk).toContain("5%");
      expect(platinum?.perk).toContain("10%");
    });
  });
});
