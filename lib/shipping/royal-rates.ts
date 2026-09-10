import {
  ROYAL_DESTINATIONS,
  findDestinationByCity,
  getDestinationsByState,
  getStateDeliveryFee,
  isLocationSuspended,
  SUSPENDED_DELIVERY_NOTICE,
  SUSPENDED_CITIES,
  STATE_DELIVERY_FEES,
  CHECKOUT_CITIES,
  DELIVERABLE_DESTINATIONS_BY_STATE,
  type ShippingDestinationItem,
  type CheckoutCityOption,
} from "./destinations-data";

export {
  findDestinationByCity,
  getDestinationsByState,
  getStateDeliveryFee,
  isLocationSuspended,
  SUSPENDED_DELIVERY_NOTICE,
  SUSPENDED_CITIES,
  STATE_DELIVERY_FEES,
  CHECKOUT_CITIES,
  DELIVERABLE_DESTINATIONS_BY_STATE,
  type CheckoutCityOption,
};

export function getAllDestinations(): ShippingDestinationItem[] {
  return ROYAL_DESTINATIONS;
}

export interface DeliveryQuoteInput {
  destinationCity?: string | null;
  cityName?: string | null;
  srNo?: number | null;
  weightKg?: number | null;
  packedWeightKg?: number | null;
  isDigitalOnly?: boolean;
  customNormalPrice?: number | null;
  customDeliveryFee?: number | null;
  customCourierCost?: number | null;
  customNextKgRate?: number | null;
}

export interface DeliveryRateSnapshot {
  destinationCity: string;
  destinationState: string;
  zone: string;
  weightKg: number;
  customerDeliveryFee: number;
  expectedCourierCost: number;
  baseCustomerFee: number;
  baseCourierCost: number;
  nextKgRate: number;
  additionalKg: number;
  isUnlisted: boolean;
  isCustomQuoteRequired: boolean;
  isDigitalOnly: boolean;
}

/**
 * Calculate Royal Express delivery fee charged to the customer and expected courier cost deduction.
 * Origin is Yangon.
 * Delivery charges are flat by State/Region covering Royal Express's courier fee.
 * Package weight tiered multipliers are dropped.
 * Digital-only orders: Always 0 fee and 0 cost.
 */
export function calculateRoyalDelivery(input: DeliveryQuoteInput): DeliveryRateSnapshot {
  if (input.isDigitalOnly) {
    return {
      destinationCity: "Digital",
      destinationState: "Digital",
      zone: "0",
      weightKg: 0,
      customerDeliveryFee: 0,
      expectedCourierCost: 0,
      baseCustomerFee: 0,
      baseCourierCost: 0,
      nextKgRate: 0,
      additionalKg: 0,
      isUnlisted: false,
      isCustomQuoteRequired: false,
      isDigitalOnly: true,
    };
  }

  const targetCity = input.destinationCity || input.cityName;

  // Find destination in the 227 rate card
  let item: ShippingDestinationItem | undefined;
  if (input.srNo != null) {
    item = ROYAL_DESTINATIONS.find((d) => d.srNo === input.srNo);
  }
  if (!item && targetCity) {
    item = findDestinationByCity(targetCity);
  }

  if (item) {
    const regionalAdminFee = getStateDeliveryFee(item.stateName);
    const customerDeliveryFee =
      input.customDeliveryFee ?? input.customNormalPrice ?? regionalAdminFee;
    const expectedCourierCost = input.customCourierCost ?? item.courierCost;

    return {
      destinationCity: item.toCity,
      destinationState: item.stateName,
      zone: item.zone,
      weightKg: 1.0,
      customerDeliveryFee,
      expectedCourierCost,
      baseCustomerFee: customerDeliveryFee,
      baseCourierCost: expectedCourierCost,
      nextKgRate: 0,
      additionalKg: 0,
      isUnlisted: false,
      isCustomQuoteRequired: false,
      isDigitalOnly: false,
    };
  }

  // Custom / Unlisted Destination Quote
  const hasCustomQuote =
    input.customNormalPrice != null || input.customDeliveryFee != null;
  const baseCustomerFee = hasCustomQuote
    ? Number(input.customNormalPrice ?? input.customDeliveryFee) || 0
    : 0;
  const baseCourierCost = hasCustomQuote
    ? Number(input.customCourierCost) || 0
    : 0;

  return {
    destinationCity: targetCity?.trim() || "Unlisted Destination",
    destinationState: "Custom Quote",
    zone: "Custom",
    weightKg: 1.0,
    customerDeliveryFee: baseCustomerFee,
    expectedCourierCost: baseCourierCost,
    baseCustomerFee,
    baseCourierCost,
    nextKgRate: 0,
    additionalKg: 0,
    isUnlisted: true,
    isCustomQuoteRequired: !hasCustomQuote,
    isDigitalOnly: false,
  };
}

/**
 * Calculates standard required deposit:
 * - Physical gadgets default to 10,000 MMK deposit, capped at the order total.
 * - PUBG digital accounts require 100% full prepayment.
 * - Admins can override the required deposit.
 */
export function calculateRequiredDeposit(
  orderTotal: number,
  isDigitalOnly: boolean,
  customDeposit?: number | null,
): number {
  if (isDigitalOnly) {
    return Math.max(0, orderTotal);
  }
  if (customDeposit != null && Number.isFinite(customDeposit) && customDeposit >= 0) {
    return Math.min(orderTotal, Math.max(0, customDeposit));
  }
  return Math.min(orderTotal, 10000);
}
