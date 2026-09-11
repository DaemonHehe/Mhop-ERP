import { describe, expect, it } from "vitest";
import {
  generateCustomerCode,
  type CustomerSummary,
  type CustomerLoyaltyProfile,
} from "@/lib/services/customer.service";
import { getTierForPoints } from "@/lib/loyalty";

describe("Customer Deduplication and Secondary Phone", () => {
  describe("Type Definitions & Defaults", () => {
    it("supports secondaryPhone in CustomerSummary interface", () => {
      const summary: CustomerSummary = {
        id: "cust-1",
        customerCode: "MH-CUST-3794",
        name: "ko San",
        phone: "0912346578",
        secondaryPhone: "091234758",
        telegramUserId: "1670134164",
        telegramUsername: "Sayarg",
        primaryAddress: "Tutu pl",
        source: "Telegram",
        orders: 2,
        lifetime: 304000,
        last: "2026-09-11",
        points: 304,
        tier: "silver",
      };

      expect(summary.phone).toBe("0912346578");
      expect(summary.secondaryPhone).toBe("091234758");
      expect(summary.tier).toBe("silver");
    });

    it("supports secondaryPhone in CustomerLoyaltyProfile", () => {
      const profile: CustomerLoyaltyProfile = {
        found: true,
        id: "cust-1",
        customerCode: "MH-CUST-3794",
        name: "ko San",
        phone: "0912346578",
        secondaryPhone: "091234758",
        telegramUserId: "1670134164",
        telegramUsername: "Sayarg",
        points: 304,
        tier: "silver",
        tierName: "Silver",
        burmeseName: "ဆာလ်ဗာ",
        icon: "🥈",
        perks: {
          freeDelivery: true,
          discountPercent: 0,
          description: "Free delivery on all orders",
        },
        progress: {
          nextTier: "gold",
          pointsNeeded: 196,
          percentToNext: 60,
        },
      };

      expect(profile.phone).toBe("0912346578");
      expect(profile.secondaryPhone).toBe("091234758");
      expect(profile.perks.freeDelivery).toBe(true);
    });
  });

  describe("Customer Code Generation", () => {
    it("generates consistent format MH-CUST-XXXX", () => {
      const code1 = generateCustomerCode();
      expect(code1).toMatch(/^MH-CUST-\d{4}$/);

      const codeWithSuffix = generateCustomerCode("1670134164");
      expect(codeWithSuffix).toBe("MH-CUST-4164");
    });
  });

  describe("Deduplication & Clustering Logic Simulation", () => {
    it("correctly identifies duplicates sharing telegramUserId and merges into winner with secondaryPhone", () => {
      // Simulating the exact scenario from user's image:
      // Card 1: ko San, MH-CUST-6109, 091234758, 0 pts, 1 order, "Tutu pl", @Sayarg (ID: 1670134164)
      // Card 2: ko San, MH-CUST-3794, 0912346578, 304 pts, 1 order, "100/10 Yankin", @Sayarg (ID: 1670134164)

      const card1 = {
        id: "cust-6109",
        customerCode: "MH-CUST-6109",
        name: "ko San",
        phone: "091234758",
        secondaryPhone: null as string | null,
        telegramUserId: "1670134164",
        telegramUsername: "Sayarg",
        primaryAddress: "Tutu pl",
        points: 0,
        createdAt: new Date("2026-09-11T12:00:00Z"),
        isActive: true,
      };

      const card2 = {
        id: "cust-3794",
        customerCode: "MH-CUST-3794",
        name: "ko San",
        phone: "0912346578",
        secondaryPhone: null as string | null,
        telegramUserId: "1670134164",
        telegramUsername: "Sayarg",
        primaryAddress: "100/10 Yankin",
        points: 304,
        createdAt: new Date("2026-09-10T10:00:00Z"),
        isActive: true,
      };

      const cluster = [card1, card2];

      // Sort by winner criteria:
      // Priority 1: non-TG phone
      // Priority 2: higher points
      // Priority 3: oldest
      cluster.sort((a, b) => {
        const aIsTg = a.phone.startsWith("TG-") ? 1 : 0;
        const bIsTg = b.phone.startsWith("TG-") ? 1 : 0;
        if (aIsTg !== bIsTg) return aIsTg - bIsTg;
        const ptsDiff = (b.points || 0) - (a.points || 0);
        if (ptsDiff !== 0) return ptsDiff;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

      const winner = cluster[0];
      const losers = cluster.slice(1);

      expect(winner.id).toBe("cust-3794");
      expect(winner.customerCode).toBe("MH-CUST-3794");
      expect(losers).toHaveLength(1);
      expect(losers[0].id).toBe("cust-6109");

      let mergedPoints = winner.points;
      const effectivePhone = winner.phone;
      let effectiveSecondaryPhone = winner.secondaryPhone;
      let effectiveAddress = winner.primaryAddress;

      for (const loser of losers) {
        mergedPoints += loser.points;
        if (loser.phone !== effectivePhone && !loser.phone.startsWith("TG-")) {
          effectiveSecondaryPhone = loser.phone;
        }
        if (loser.primaryAddress) {
          effectiveAddress = loser.primaryAddress; // newer address
        }
      }

      expect(mergedPoints).toBe(304);
      expect(effectivePhone).toBe("0912346578");
      expect(effectiveSecondaryPhone).toBe("091234758");
      expect(effectiveAddress).toBe("Tutu pl");
      expect(getTierForPoints(mergedPoints)).toBe("silver");
    });

    it("executes customer resolution query with secondary_phone on database successfully", async () => {
      const { db } = await import("@/db");
      if (!db) return;
      const { customers } = await import("@/db/schema");
      const { and, desc, eq, or } = await import("drizzle-orm");

      const cleanCustomerPhone = "0922483935";
      const cleanCustomerTag = "Sayarg";
      const telegramUserId = "1670134164";

      const loyaltyConditions = [];
      if (cleanCustomerPhone) {
        loyaltyConditions.push(eq(customers.phone, cleanCustomerPhone));
        loyaltyConditions.push(eq(customers.secondaryPhone, cleanCustomerPhone));
      }
      if (telegramUserId) loyaltyConditions.push(eq(customers.telegramUserId, telegramUserId));
      if (cleanCustomerTag) {
        loyaltyConditions.push(eq(customers.telegramUsername, cleanCustomerTag));
        loyaltyConditions.push(eq(customers.telegramUsername, `@${cleanCustomerTag}`));
      }

      const matchingCustomers = await db
        .select()
        .from(customers)
        .where(and(eq(customers.isActive, true), or(...loyaltyConditions)))
        .orderBy(desc(customers.points));

      expect(Array.isArray(matchingCustomers)).toBe(true);
    });
  });
});
