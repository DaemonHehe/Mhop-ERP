export type CustomerTier = "member" | "silver" | "gold" | "platinum" | "diamond";

export type CardTier = "classic" | "silver" | "gold" | "platinum" | "diamond";

export interface TierDefinition {
  id: CustomerTier;
  name: string;
  burmeseName: string;
  cardTitle: string;
  minPoints: number;
  maxPoints: number;
  freeDelivery: boolean;
  discountPercent: number;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  icon: string;
  description: string;
}

export const MMK_PER_POINT = 1000;

export const TIERS: Record<CustomerTier, TierDefinition> = {
  member: {
    id: "member",
    name: "Member",
    burmeseName: "အသင်းဝင် (Classic)",
    cardTitle: "CLASSIC",
    minPoints: 0,
    maxPoints: 199,
    freeDelivery: false,
    discountPercent: 0,
    badgeBg: "bg-[#f4f2eb]",
    badgeText: "text-[#62655b]",
    badgeBorder: "border-[#d8d5cb]",
    icon: "👤",
    description: "Standard member rates. Earn 1 point per 1,000 MMK spent.",
  },
  silver: {
    id: "silver",
    name: "Silver",
    burmeseName: "ငွေအဆင့် VIP",
    cardTitle: "SILVER",
    minPoints: 200,
    maxPoints: 499,
    freeDelivery: true,
    discountPercent: 0,
    badgeBg: "bg-[#edf2f7]",
    badgeText: "text-[#2b4365]",
    badgeBorder: "border-[#cbd5e0]",
    icon: "🥈",
    description: "Free Delivery on all orders across Myanmar.",
  },
  gold: {
    id: "gold",
    name: "Gold",
    burmeseName: "ရွှေအဆင့် VIP",
    cardTitle: "GOLD",
    minPoints: 500,
    maxPoints: 1000,
    freeDelivery: true,
    discountPercent: 5,
    badgeBg: "bg-[#fef9c3]",
    badgeText: "text-[#854d0e]",
    badgeBorder: "border-[#fde047]",
    icon: "🥇",
    description: "Free Delivery + 5% product discount on all orders.",
  },
  platinum: {
    id: "platinum",
    name: "Platinum",
    burmeseName: "ပလက်တီနမ် VIP",
    cardTitle: "PLATINUM",
    minPoints: 1001,
    maxPoints: Number.POSITIVE_INFINITY,
    freeDelivery: true,
    discountPercent: 10,
    badgeBg: "bg-[#f3e8ff]",
    badgeText: "text-[#6b21a8]",
    badgeBorder: "border-[#d8b4fe]",
    icon: "💎",
    description: "Free Delivery + 10% product discount on all orders.",
  },
  diamond: {
    id: "diamond",
    name: "Diamond",
    burmeseName: "ဒိုင်းမွန်း VIP",
    cardTitle: "DIAMOND",
    minPoints: 2500,
    maxPoints: Number.POSITIVE_INFINITY,
    freeDelivery: true,
    discountPercent: 15,
    badgeBg: "bg-[#e0f2fe]",
    badgeText: "text-[#0369a1]",
    badgeBorder: "border-[#bae6fd]",
    icon: "💠",
    description: "Free Delivery + 15% VIP discount on all orders.",
  },
};

/**
 * Resolve the visual card tier (Classic, Silver, Gold, Platinum, Diamond)
 * based on customer tier or point threshold.
 */
export function getCardTier(tier?: string | null, points = 0): CardTier {
  const p = Math.max(0, Math.floor(points || 0));
  const normalized = (tier || "").toLowerCase();
  if (normalized === "diamond" || p >= 2500) return "diamond";
  if (normalized === "platinum" || p >= 1001) return "platinum";
  if (normalized === "gold" || p >= 500) return "gold";
  if (normalized === "silver" || p >= 200) return "silver";
  return "classic";
}

/**
 * Determine the tier based on lifetime points
 */
export function getTierForPoints(points: number): CustomerTier {
  const p = Math.max(0, Math.floor(points || 0));
  if (p >= 1001) return "platinum";
  if (p >= 500) return "gold";
  if (p >= 200) return "silver";
  return "member";
}

/**
 * Calculate points earned from spend amount (1000 MMK = 1 point)
 */
export function calculatePointsFromAmount(amountMmk: number): number {
  if (!amountMmk || amountMmk <= 0) return 0;
  return Math.floor(amountMmk / MMK_PER_POINT);
}

/**
 * Calculate progress to next tier
 */
export function getTierProgress(points: number): {
  currentTier: CustomerTier;
  nextTier: CustomerTier | null;
  pointsNeeded: number;
  percentToNext: number;
} {
  const currentTier = getTierForPoints(points);
  const p = Math.max(0, Math.floor(points || 0));

  if (currentTier === "member") {
    const target = 200;
    const needed = Math.max(0, target - p);
    return {
      currentTier,
      nextTier: "silver",
      pointsNeeded: needed,
      percentToNext: Math.min(100, Math.round((p / target) * 100)),
    };
  }
  if (currentTier === "silver") {
    const target = 500;
    const needed = Math.max(0, target - p);
    const progress = p - 200;
    const range = 300;
    return {
      currentTier,
      nextTier: "gold",
      pointsNeeded: needed,
      percentToNext: Math.min(100, Math.round((progress / range) * 100)),
    };
  }
  if (currentTier === "gold") {
    const target = 1001;
    const needed = Math.max(0, target - p);
    const progress = p - 500;
    const range = 501;
    return {
      currentTier,
      nextTier: "platinum",
      pointsNeeded: needed,
      percentToNext: Math.min(100, Math.round((progress / range) * 100)),
    };
  }

  return {
    currentTier,
    nextTier: null,
    pointsNeeded: 0,
    percentToNext: 100,
  };
}

export interface TierPerksResult {
  tier: CustomerTier;
  tierName: string;
  burmeseName: string;
  icon: string;
  productSubtotal: number;
  discountPercent: number;
  productDiscountAmount: number;
  netProductSubtotal: number;
  standardDeliveryFee: number;
  isFreeDelivery: boolean;
  deliveryDiscountAmount: number;
  netDeliveryFee: number;
  finalTotal: number;
  pointsToEarn: number;
}

/**
 * Calculate order perks for a specific tier, subtotal, and delivery fee.
 */
export function calculateTierPerks(
  tier: CustomerTier,
  productSubtotal: number,
  standardDeliveryFee: number,
): TierPerksResult {
  const def = TIERS[tier] || TIERS.member;
  const sub = Math.max(0, Math.round(productSubtotal));
  const del = Math.max(0, Math.round(standardDeliveryFee));

  // Product discount
  const discountPercent = def.discountPercent;
  const productDiscountAmount =
    discountPercent > 0 ? Math.round(sub * (discountPercent / 100)) : 0;
  const netProductSubtotal = Math.max(0, sub - productDiscountAmount);

  // Delivery fee waiver
  const isFreeDelivery = def.freeDelivery;
  const deliveryDiscountAmount = isFreeDelivery ? del : 0;
  const netDeliveryFee = isFreeDelivery ? 0 : del;

  const finalTotal = netProductSubtotal + netDeliveryFee;
  const pointsToEarn = calculatePointsFromAmount(finalTotal);

  return {
    tier,
    tierName: def.name,
    burmeseName: def.burmeseName,
    icon: def.icon,
    productSubtotal: sub,
    discountPercent,
    productDiscountAmount,
    netProductSubtotal,
    standardDeliveryFee: del,
    isFreeDelivery,
    deliveryDiscountAmount,
    netDeliveryFee,
    finalTotal,
    pointsToEarn,
  };
}
