export interface WarrantyPolicyInput {
  paymentStatus: string;
  fulfillmentStatus: string;
  deliveredAt: Date | null;
  orderCreatedAt: Date;
  warrantyMonths: number;
  now?: Date;
}

export function evaluateWarrantyPolicy(input: WarrantyPolicyInput) {
  const startAt = input.deliveredAt || input.orderCreatedAt;
  const expiresAt = new Date(startAt);
  expiresAt.setMonth(expiresAt.getMonth() + Math.max(0, input.warrantyMonths));
  const now = input.now || new Date();

  if (input.paymentStatus !== "verified")
    return {
      eligible: false,
      status: "Pending delivery" as const,
      reason: "Warranty starts only after payment is verified.",
      startAt,
      expiresAt,
    };
  if (input.fulfillmentStatus !== "delivered")
    return {
      eligible: false,
      status: "Pending delivery" as const,
      reason: "Warranty starts after the order is delivered.",
      startAt,
      expiresAt,
    };
  if (input.warrantyMonths <= 0)
    return {
      eligible: false,
      status: "Not covered" as const,
      reason: "This product does not include warranty coverage.",
      startAt,
      expiresAt,
    };
  if (expiresAt.getTime() < now.getTime())
    return {
      eligible: false,
      status: "Expired" as const,
      reason: `Warranty expired on ${expiresAt.toLocaleDateString("en-GB", { timeZone: "Asia/Yangon" })}.`,
      startAt,
      expiresAt,
    };
  return {
    eligible: true,
    status: "Active" as const,
    reason: "Warranty coverage is active.",
    startAt,
    expiresAt,
  };
}
