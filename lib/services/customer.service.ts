import { and, desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, orders } from "@/db/schema";
import { getOrders } from "./order.service";
import {
  type CustomerTier,
  getTierForPoints,
  getTierProgress,
  TIERS,
  calculatePointsFromAmount,
} from "@/lib/loyalty";

export interface CustomerSummary {
  id: string;
  customerCode?: string | null;
  name: string;
  phone: string;
  secondaryPhone?: string | null;
  telegramUserId: string | null;
  telegramUsername?: string | null;
  primaryAddress: string | null;
  source: string;
  orders: number;
  lifetime: number;
  last: string;
  points: number;
  tier: CustomerTier;
}

export interface CustomerLoyaltyProfile {
  found: boolean;
  id?: string;
  customerCode?: string | null;
  name?: string;
  phone?: string;
  secondaryPhone?: string | null;
  telegramUserId?: string | null;
  telegramUsername?: string | null;
  points: number;
  tier: CustomerTier;
  tierName: string;
  burmeseName: string;
  icon: string;
  perks: {
    freeDelivery: boolean;
    discountPercent: number;
    description: string;
  };
  progress: {
    nextTier: CustomerTier | null;
    pointsNeeded: number;
    percentToNext: number;
  };
}

/**
 * Generates a clean, unique customer code (e.g. MH-CUST-1042)
 */
export function generateCustomerCode(suffix?: string | number): string {
  if (suffix) {
    const clean = String(suffix).toUpperCase().replace(/[^A-Z0-9]/g, "");
    return `MH-CUST-${clean.slice(-4).padStart(4, "0")}`;
  }
  const random4 = Math.floor(1000 + Math.random() * 9000);
  return `MH-CUST-${random4}`;
}

export async function getCustomers(): Promise<CustomerSummary[]> {
  const fallbackFromOrders = async (): Promise<CustomerSummary[]> => {
    const source = await getOrders();
    const grouped = new Map<string, CustomerSummary>();
    for (const order of source) {
      const key = order.phone || order.customer;
      const current = grouped.get(key) || {
        id: `demo-${key}`,
        customerCode: `MH-CUST-${Math.floor(1000 + Math.random() * 9000)}`,
        name: order.customer,
        phone: order.phone || "—",
        secondaryPhone: null,
        telegramUserId: null,
        telegramUsername: null,
        primaryAddress: order.address || null,
        source: order.channel,
        orders: 0,
        lifetime: 0,
        last: order.created,
        points: 0,
        tier: "member" as CustomerTier,
      };
      current.orders++;
      current.lifetime += order.amount;
      current.points = calculatePointsFromAmount(current.lifetime);
      current.tier = getTierForPoints(current.points);
      grouped.set(key, current);
    }
    return [...grouped.values()].sort((a, b) => b.lifetime - a.lifetime);
  };

  if (!db) {
    return fallbackFromOrders();
  }

  try {
    await reconcileDuplicateCustomers();
    const rows = await db
      .select({
        id: customers.id,
        customerCode: customers.customerCode,
        name: customers.name,
        phone: customers.phone,
        secondaryPhone: customers.secondaryPhone,
        telegramUserId: customers.telegramUserId,
        telegramUsername: customers.telegramUsername,
        primaryAddress: customers.primaryAddress,
        points: customers.points,
        tier: customers.tier,
        source: sql<string>`case when ${customers.telegramUserId} is not null then 'Telegram' else 'Web' end`,
        orders: sql<number>`count(${orders.id})`,
        lifetime: sql<string>`coalesce(sum(case when ${orders.paymentStatus}='verified' then ${orders.totalAmount} else 0 end), 0)`,
        last: sql<Date | null>`max(${orders.createdAt})`,
      })
      .from(customers)
      .leftJoin(orders, eq(orders.customerId, customers.id))
      .where(eq(customers.isActive, true))
      .groupBy(
        customers.id,
        customers.customerCode,
        customers.name,
        customers.phone,
        customers.secondaryPhone,
        customers.telegramUserId,
        customers.telegramUsername,
        customers.primaryAddress,
        customers.points,
        customers.tier,
      )
      .orderBy(desc(sql`max(${orders.createdAt})`));

    return rows.map((row) => {
      const calculatedPoints = Math.max(
        row.points || 0,
        calculatePointsFromAmount(Number(row.lifetime || 0)),
      );
      const tier = (row.tier as CustomerTier) || getTierForPoints(calculatedPoints);

      return {
        name: row.name,
        id: row.id,
        customerCode: row.customerCode || generateCustomerCode(row.id.slice(0, 4)),
        phone: row.phone,
        secondaryPhone: row.secondaryPhone || null,
        telegramUserId: row.telegramUserId,
        telegramUsername: row.telegramUsername,
        primaryAddress: row.primaryAddress,
        source: row.source,
        orders: Number(row.orders),
        lifetime: Number(row.lifetime),
        last: row.last
          ? new Date(row.last).toLocaleString("en-US", {
              timeZone: "Asia/Yangon",
            })
          : "—",
        points: calculatedPoints,
        tier,
      };
    });
  } catch (error) {
    console.error("[getCustomers] Database query failed, falling back to orders:", error);
    return fallbackFromOrders();
  }
}

/**
 * Look up a customer's loyalty profile by phone number or Telegram user ID.
 */
export async function lookupCustomerLoyalty(query: {
  phone?: string | null;
  telegramUserId?: string | null;
  telegramUsername?: string | null;
  customerCode?: string | null;
}): Promise<CustomerLoyaltyProfile> {
  const cleanPhone = (query.phone || "").trim().replace(/[^\d+]/g, "");
  const cleanTelegram = (query.telegramUserId || "").trim();
  const cleanTag = (query.telegramUsername || "").trim().replace(/^@/, "");
  const cleanCode = (query.customerCode || "").trim().toUpperCase();

  const defaultProfile: CustomerLoyaltyProfile = {
    found: false,
    customerCode: cleanCode || (cleanTelegram ? generateCustomerCode(cleanTelegram.slice(-4)) : generateCustomerCode()),
    points: 0,
    tier: "member",
    tierName: TIERS.member.name,
    burmeseName: TIERS.member.burmeseName,
    icon: TIERS.member.icon,
    perks: {
      freeDelivery: TIERS.member.freeDelivery,
      discountPercent: TIERS.member.discountPercent,
      description: TIERS.member.description,
    },
    progress: getTierProgress(0),
  };

  if (!db || (!cleanPhone && !cleanTelegram && !cleanTag && !cleanCode)) {
    return defaultProfile;
  }

  const conditions = [];
  if (cleanPhone) {
    conditions.push(or(eq(customers.phone, cleanPhone), eq(customers.secondaryPhone, cleanPhone)));
  }
  if (cleanTelegram) conditions.push(eq(customers.telegramUserId, cleanTelegram));
  if (cleanTag) conditions.push(eq(customers.telegramUsername, cleanTag));
  if (cleanCode) conditions.push(eq(customers.customerCode, cleanCode));

  if (!conditions.length) return defaultProfile;

  try {
    const [customer] = await db
      .select({
        id: customers.id,
        customerCode: customers.customerCode,
        name: customers.name,
        phone: customers.phone,
        secondaryPhone: customers.secondaryPhone,
        telegramUserId: customers.telegramUserId,
        telegramUsername: customers.telegramUsername,
        points: customers.points,
        tier: customers.tier,
      })
      .from(customers)
      .where(and(eq(customers.isActive, true), or(...conditions)))
      .orderBy(desc(customers.points))
      .limit(1);

    if (!customer) {
      return defaultProfile;
    }

    const tier = getTierForPoints(customer.points || 0);
    const def = TIERS[tier];

    return {
      found: true,
      id: customer.id,
      customerCode: customer.customerCode || generateCustomerCode(customer.id.slice(0, 4)),
      name: customer.name,
      phone: customer.phone,
      secondaryPhone: customer.secondaryPhone,
      telegramUserId: customer.telegramUserId,
      telegramUsername: customer.telegramUsername,
      points: customer.points || 0,
      tier,
      tierName: def.name,
      burmeseName: def.burmeseName,
      icon: def.icon,
      perks: {
        freeDelivery: def.freeDelivery,
        discountPercent: def.discountPercent,
        description: def.description,
      },
      progress: getTierProgress(customer.points || 0),
    };
  } catch (error) {
    console.error("[lookupCustomerLoyalty error]", error);
    return defaultProfile;
  }
}

/**
 * Award loyalty points to a customer and upgrade/update their tier accordingly.
 */
export async function awardCustomerPoints(
  tx: Parameters<Parameters<NonNullable<typeof db>["transaction"]>[0]>[0],
  customerId: string,
  pointsEarned: number,
): Promise<{ newPoints: number; newTier: CustomerTier } | null> {
  if (!pointsEarned || pointsEarned <= 0) return null;

  const [existing] = await tx
    .select({ id: customers.id, points: customers.points, tier: customers.tier })
    .from(customers)
    .where(eq(customers.id, customerId))
    .for("update");

  if (!existing) return null;

  const newPoints = (existing.points || 0) + pointsEarned;
  const newTier = getTierForPoints(newPoints);

  await tx
    .update(customers)
    .set({
      points: newPoints,
      tier: newTier,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, customerId));

  return { newPoints, newTier };
}

/**
 * Recalculate customer's total loyalty points and tier from verified orders.
 */
export async function recalculateCustomerLoyalty(
  tx: Parameters<Parameters<NonNullable<typeof db>["transaction"]>[0]>[0],
  customerId: string,
): Promise<{ points: number; tier: CustomerTier } | null> {
  const [stats] = await tx
    .select({
      totalVerified: sql<string>`coalesce(sum(${orders.totalAmount}), 0)`,
      sumEarned: sql<string>`coalesce(sum(${orders.pointsEarned}), 0)`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.customerId, customerId),
        eq(orders.paymentStatus, "verified"),
      ),
    );

  const pointsFromSpend = calculatePointsFromAmount(Number(stats?.totalVerified || 0));
  const pointsFromEarned = Number(stats?.sumEarned || 0);
  const finalPoints = Math.max(pointsFromSpend, pointsFromEarned);
  const finalTier = getTierForPoints(finalPoints);

  await tx
    .update(customers)
    .set({
      points: finalPoints,
      tier: finalTier,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, customerId));

  return { points: finalPoints, tier: finalTier };
}

/**
 * Reconciles and merges any temporary TG- placeholder accounts with their corresponding
 * real-phone customer accounts when they share a Telegram user ID or Telegram tag.
 */
export async function reconcileDuplicateCustomers() {
  if (!db) return;
  try {
    const activeCustomers = await db
      .select()
      .from(customers)
      .where(eq(customers.isActive, true));

    if (!activeCustomers || activeCustomers.length <= 1) return;

    // Group customers into clusters of identical human identity
    const visited = new Set<string>();
    const clusters: Array<typeof activeCustomers> = [];

    for (let i = 0; i < activeCustomers.length; i++) {
      const c1 = activeCustomers[i];
      if (visited.has(c1.id)) continue;

      const cluster = [c1];
      visited.add(c1.id);

      for (let j = i + 1; j < activeCustomers.length; j++) {
        const c2 = activeCustomers[j];
        if (visited.has(c2.id)) continue;

        const sameTgId = Boolean(
          c1.telegramUserId &&
          c2.telegramUserId &&
          c1.telegramUserId === c2.telegramUserId,
        );
        const sameTgTag = Boolean(
          c1.telegramUsername &&
          c2.telegramUsername &&
          c1.telegramUsername.toLowerCase().replace(/^@/, "") ===
            c2.telegramUsername.toLowerCase().replace(/^@/, ""),
        );
        const samePhone = Boolean(
          c1.phone &&
          !c1.phone.startsWith("TG-") &&
          (c1.phone === c2.phone || (c2.secondaryPhone && c1.phone === c2.secondaryPhone)),
        );
        const sameSecPhone = Boolean(
          c1.secondaryPhone &&
          (c1.secondaryPhone === c2.phone || (c2.secondaryPhone && c1.secondaryPhone === c2.secondaryPhone)),
        );

        if (sameTgId || sameTgTag || samePhone || sameSecPhone) {
          cluster.push(c2);
          visited.add(c2.id);
        }
      }

      if (cluster.length > 1) {
        clusters.push(cluster);
      }
    }

    for (const cluster of clusters) {
      // Sort to find the primary (winner) customer record:
      // Priority 1: Real phone (non-TG) over TG- placeholder
      // Priority 2: Most loyalty points
      // Priority 3: Oldest record
      cluster.sort((a, b) => {
        const aIsTg = a.phone.startsWith("TG-") ? 1 : 0;
        const bIsTg = b.phone.startsWith("TG-") ? 1 : 0;
        if (aIsTg !== bIsTg) return aIsTg - bIsTg;
        const ptsDiff = (b.points || 0) - (a.points || 0);
        if (ptsDiff !== 0) return ptsDiff;
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return aTime - bTime;
      });

      const winner = cluster[0];
      const losers = cluster.slice(1);

      let mergedPoints = winner.points || 0;
      let effectivePhone = winner.phone;
      let effectiveSecondaryPhone = winner.secondaryPhone;
      let effectiveAddress = winner.primaryAddress;
      let effectiveTgUserId = winner.telegramUserId;
      let effectiveTgUsername = winner.telegramUsername;
      let effectiveName = winner.name;
      let effectiveCode = winner.customerCode;

      for (const loser of losers) {
        mergedPoints += (loser.points || 0);

        if (!effectiveCode && loser.customerCode) {
          effectiveCode = loser.customerCode;
        }
        if (loser.telegramUserId && !effectiveTgUserId) {
          effectiveTgUserId = loser.telegramUserId;
        }
        if (loser.telegramUsername && !effectiveTgUsername) {
          effectiveTgUsername = loser.telegramUsername;
        }
        if (loser.primaryAddress && (!effectiveAddress || effectiveAddress === "Not recorded")) {
          effectiveAddress = loser.primaryAddress;
        }
        if (loser.name && (!effectiveName || effectiveName === "Customer" || effectiveName.startsWith("Telegram @"))) {
          effectiveName = loser.name;
        }

        // Phone consolidation:
        if (effectivePhone.startsWith("TG-") && !loser.phone.startsWith("TG-")) {
          effectivePhone = loser.phone;
        } else if (!effectivePhone.startsWith("TG-") && !loser.phone.startsWith("TG-") && loser.phone !== effectivePhone) {
          if (!effectiveSecondaryPhone) {
            effectiveSecondaryPhone = loser.phone;
          }
        }
        if (loser.secondaryPhone && loser.secondaryPhone !== effectivePhone && !effectiveSecondaryPhone) {
          effectiveSecondaryPhone = loser.secondaryPhone;
        }

        // Reassign orders
        await db
          .update(orders)
          .set({ customerId: winner.id })
          .where(eq(orders.customerId, loser.id));

        // Deactivate loser account
        await db
          .update(customers)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(customers.id, loser.id));
      }

      // Check if there is a more recent shipping address from winner's orders
      const [latestOrder] = await db
        .select({ shippingAddress: orders.shippingAddress, streetAddress: orders.streetAddress })
        .from(orders)
        .where(eq(orders.customerId, winner.id))
        .orderBy(desc(orders.createdAt))
        .limit(1);

      if (latestOrder?.shippingAddress || latestOrder?.streetAddress) {
        effectiveAddress = latestOrder.shippingAddress || latestOrder.streetAddress || effectiveAddress;
      }

      const finalTier = getTierForPoints(mergedPoints);

      await db
        .update(customers)
        .set({
          customerCode: effectiveCode || generateCustomerCode(winner.id.slice(0, 4)),
          name: effectiveName,
          phone: effectivePhone,
          secondaryPhone: effectiveSecondaryPhone || null,
          primaryAddress: effectiveAddress || null,
          telegramUserId: effectiveTgUserId || null,
          telegramUsername: effectiveTgUsername || null,
          points: mergedPoints,
          tier: finalTier,
          updatedAt: new Date(),
        })
        .where(eq(customers.id, winner.id));
    }
  } catch (err) {
    console.error("[reconcileDuplicateCustomers error]", err);
  }
}

/**
 * Link a customer's phone number with their Telegram user ID and username tag.
 */
export async function linkCustomerTelegram(
  phone: string,
  telegramUserId: string,
  telegramUsername?: string | null,
  name?: string,
): Promise<{ success: boolean; profile: CustomerLoyaltyProfile; isNew: boolean }> {
  const cleanPhone = phone.trim().replace(/[^\d+]/g, "");
  const cleanTelegram = telegramUserId.trim();
  const cleanTag = telegramUsername ? telegramUsername.trim().replace(/^@/, "") : null;

  if (!db || !cleanPhone || !cleanTelegram) {
    return {
      success: Boolean(cleanPhone && cleanTelegram),
      profile: await lookupCustomerLoyalty({ telegramUserId: cleanTelegram, phone: cleanPhone }),
      isNew: false,
    };
  }

  try {
    // Check if customer exists by phone
    const [existingByPhone] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.phone, cleanPhone), eq(customers.isActive, true)))
      .limit(1);

    // Check if already exists by telegramUserId
    const [existingByTelegram] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.telegramUserId, cleanTelegram), eq(customers.isActive, true)))
      .limit(1);

    // If both exist and are distinct records, merge them into the real-phone customer
    if (existingByPhone && existingByTelegram && existingByPhone.id !== existingByTelegram.id) {
      const mergedTag = cleanTag || existingByTelegram.telegramUsername || existingByPhone.telegramUsername || null;
      const combinedPoints = (existingByPhone.points || 0) + (existingByTelegram.points || 0);

      let effectiveSecondary = existingByPhone.secondaryPhone || null;
      if (
        existingByTelegram.phone &&
        !existingByTelegram.phone.startsWith("TG-") &&
        existingByTelegram.phone !== existingByPhone.phone
      ) {
        effectiveSecondary = existingByTelegram.phone;
      }

      await db
        .update(customers)
        .set({
          telegramUserId: cleanTelegram,
          telegramUsername: mergedTag,
          secondaryPhone: effectiveSecondary,
          points: combinedPoints,
          tier: getTierForPoints(combinedPoints),
          ...(!existingByPhone.customerCode ? { customerCode: existingByTelegram.customerCode || generateCustomerCode() } : {}),
          ...(name && (!existingByPhone.name || existingByPhone.name === "Customer") ? { name } : {}),
          updatedAt: new Date(),
        })
        .where(eq(customers.id, existingByPhone.id));

      await db
        .update(orders)
        .set({ customerId: existingByPhone.id })
        .where(eq(orders.customerId, existingByTelegram.id));

      await db
        .update(customers)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(customers.id, existingByTelegram.id));

      const updatedProfile = await lookupCustomerLoyalty({ telegramUserId: cleanTelegram });
      return { success: true, profile: updatedProfile, isNew: false };
    }

    if (existingByPhone) {
      await db
        .update(customers)
        .set({
          telegramUserId: cleanTelegram,
          ...(cleanTag ? { telegramUsername: cleanTag } : {}),
          ...(!existingByPhone.customerCode ? { customerCode: generateCustomerCode() } : {}),
          ...(name && (!existingByPhone.name || existingByPhone.name === "Customer") ? { name } : {}),
          updatedAt: new Date(),
        })
        .where(eq(customers.id, existingByPhone.id));

      const updatedProfile = await lookupCustomerLoyalty({ telegramUserId: cleanTelegram });
      return { success: true, profile: updatedProfile, isNew: false };
    }

    if (existingByTelegram) {
      await db
        .update(customers)
        .set({
          phone: cleanPhone,
          ...(cleanTag ? { telegramUsername: cleanTag } : {}),
          ...(!existingByTelegram.customerCode ? { customerCode: generateCustomerCode() } : {}),
          ...(name && (!existingByTelegram.name || existingByTelegram.name === "Customer") ? { name } : {}),
          updatedAt: new Date(),
        })
        .where(eq(customers.id, existingByTelegram.id));

      const updatedProfile = await lookupCustomerLoyalty({ telegramUserId: cleanTelegram });
      return { success: true, profile: updatedProfile, isNew: false };
    }

    // Create a new customer profile linked to this phone, Telegram ID, and username tag
    const code = generateCustomerCode();
    await db.insert(customers).values({
      customerCode: code,
      name: name || "Customer",
      phone: cleanPhone,
      telegramUserId: cleanTelegram,
      telegramUsername: cleanTag,
      points: 0,
      tier: "member",
      isActive: true,
    });

    const newProfile = await lookupCustomerLoyalty({ telegramUserId: cleanTelegram });
    return { success: true, profile: newProfile, isNew: true };
  } catch (err) {
    console.error("[linkCustomerTelegram error]", err);
    return {
      success: false,
      profile: await lookupCustomerLoyalty({ telegramUserId: cleanTelegram }),
      isNew: false,
    };
  }
}

/**
 * Resolves or creates a customer profile for a Telegram user, ensuring they have
 * a unique customerCode (e.g. MH-CUST-1042) and their telegramUsername (tag) stored together.
 */
export async function getOrCreateTelegramCustomer(params: {
  telegramUserId: string;
  telegramUsername?: string | null;
  displayName?: string | null;
}): Promise<CustomerLoyaltyProfile> {
  const cleanId = params.telegramUserId.trim();
  const cleanTag = params.telegramUsername
    ? params.telegramUsername.trim().replace(/^@/, "")
    : null;

  if (!db || !cleanId) {
    return lookupCustomerLoyalty({ telegramUserId: cleanId });
  }

  try {
    // 1. Check if customer already exists by telegramUserId
    const [existing] = await db
      .select({
        id: customers.id,
        customerCode: customers.customerCode,
        telegramUsername: customers.telegramUsername,
        phone: customers.phone,
      })
      .from(customers)
      .where(and(eq(customers.telegramUserId, cleanId), eq(customers.isActive, true)))
      .limit(1);

    if (existing) {
      const needsCode = !existing.customerCode;
      const needsTag = cleanTag && existing.telegramUsername !== cleanTag;

      if (needsCode || needsTag) {
        await db
          .update(customers)
          .set({
            ...(needsCode ? { customerCode: generateCustomerCode(existing.id.slice(0, 4)) } : {}),
            ...(needsTag ? { telegramUsername: cleanTag } : {}),
            updatedAt: new Date(),
          })
          .where(eq(customers.id, existing.id));
      }

      return lookupCustomerLoyalty({ telegramUserId: cleanId });
    }

    // 2. Check if customer exists by telegramUsername tag
    if (cleanTag) {
      const [existingByTag] = await db
        .select({ id: customers.id, customerCode: customers.customerCode })
        .from(customers)
        .where(
          and(
            eq(customers.telegramUsername, cleanTag),
            eq(customers.isActive, true),
          ),
        )
        .limit(1);

      if (existingByTag) {
        await db
          .update(customers)
          .set({
            telegramUserId: cleanId,
            ...(!existingByTag.customerCode ? { customerCode: generateCustomerCode(existingByTag.id.slice(0, 4)) } : {}),
            updatedAt: new Date(),
          })
          .where(eq(customers.id, existingByTag.id));

        return lookupCustomerLoyalty({ telegramUserId: cleanId });
      }
    }

    // 3. Create new official customer record for this Telegram user
    const newCode = generateCustomerCode();
    const starterPhone = `TG-${cleanId.slice(-8)}`;

    await db.insert(customers).values({
      customerCode: newCode,
      name: params.displayName || `Telegram @${cleanTag || cleanId}`,
      phone: starterPhone,
      telegramUserId: cleanId,
      telegramUsername: cleanTag,
      points: 0,
      tier: "member",
      isActive: true,
    });

    return lookupCustomerLoyalty({ telegramUserId: cleanId });
  } catch (err) {
    console.error("[getOrCreateTelegramCustomer error]", err);
    return lookupCustomerLoyalty({ telegramUserId: cleanId });
  }
}



