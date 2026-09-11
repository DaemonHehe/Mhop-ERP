import { canPurchaseListing } from "@/lib/listing-rules";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  getTierForPoints,
  calculateTierPerks,
  calculatePointsFromAmount,
  type CustomerTier,
} from "@/lib/loyalty";
import {
  awardCustomerPoints,
  generateCustomerCode,
  recalculateCustomerLoyalty,
} from "./customer.service";
import {
  bundles,
  courierSettlementAllocations,
  courierSettlementBatches,
  customers,
  deviceUnits,
  orderBundleSets,
  orderItems,
  orderPayments,
  orders,
  productVariants,
  products,
  staffAlerts,
  systemAuditLogs,
  tickets,
} from "@/db/schema";
import { formatMMK, orders as demoOrders } from "@/lib/data";
import { calculateOrderShipping, clientConfig } from "@/lib/client-config";
import {
  adminCreateOrderSchema,
  failedDeliverySchema,
  orderPreDispatchEditSchema,
  orderSchema,
  postDispatchCorrectionSchema,
  shipmentSchema,
} from "@/lib/validation/schemas";
import { audit } from "./audit.service";
import type { ActionResult } from "./stock.service";
import { allocateDiscountedUnits } from "@/lib/order-pricing";
import { evaluateWarrantyPolicy } from "@/lib/warranty-policy";
import {
  calculateRoyalDelivery,
  calculateRequiredDeposit,
  isLocationSuspended,
  SUSPENDED_DELIVERY_NOTICE,
} from "@/lib/shipping/royal-rates";
import {
  recalculateOrderPayments,
} from "./payment.service";
import type { z } from "zod";
import {
  sendTelegramMessage,
  sendTelegramOpsMessage,
  sendTelegramPhoto,
} from "@/lib/telegram/bot";
import {
  formatCustomerReceipt,
  formatDepositRequestReceipt,
  formatManagerOrderAlert,
} from "./receipt-summary";
import {
  renderCustomerReceiptImage,
  renderDepositRequestReceiptImage,
} from "./receipt-image";
import {
  formatBankAccountsTelegramMessage,
  getPaymentAccountForMethod,
} from "./payment-account.service";

export interface OperationalOrder {
  id: string;
  orderCode?: string;
  customer: string;
  channel: string;
  amount: number;
  payment: string;
  fulfillment: string;
  item: string;
  created: string;
  createdAt?: Date;
  phone?: string;
  address?: string | null;
  trackingNumber?: string | null;
  shippingCarrier?: string | null;
  telegramUserId?: string | null;
  paymentSlipUrl?: string | null;
  isDigitalOnly?: boolean;
  orderSource?: string;
  destinationCity?: string | null;
  destinationState?: string | null;
  requiredDeposit?: number;
  customerPaidAmount?: number;
  customerBalance?: number;
  codAmount?: number;
  expectedCourierCost?: number;
  actualCourierCost?: number | null;
  customerPaymentStatus?: string;
  courierSettlementStatus?: string;
  commercialFrozen?: boolean;
  deliveryFeeConfirmed?: boolean;
  customerTier?: string;
  tierDiscountAmount?: number;
  tierDeliveryDiscount?: number;
  pointsEarned?: number;
}

export interface WarrantyResult {
  orderCode: string;
  customer: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  items: {
    name: string;
    identifier: string | null;
    warrantyMonths: number;
    coverageStatus: "Active" | "Expired" | "Pending delivery" | "Not covered";
    warrantyStarts: string;
    validUntil: string;
  }[];
}
export interface RevenuePoint {
  date: string;
  label: string;
  value: number;
}
export interface ReceiptOrder {
  id: string;
  code: string;
  customer: string;
  phone: string;
  address: string;
  total: number;
  subtotal: number;
  shippingFee: number;
  paidAmount: number;
  outstandingBalance: number;
  paymentMethod: string;
  paymentStatus: string;
  carrier: string;
  createdAt: Date;
  items: {
    name: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    identifier: string | null;
    warrantyMonths: number;
  }[];
  bundles: string[];
  requiredDeposit?: number;
  codAmount?: number;
  customerPaymentStatus?: string;
  courierSettlementStatus?: string;
  destinationCity?: string | null;
  destinationState?: string | null;
  customerTier?: string;
  tierDiscountAmount?: number;
  tierDeliveryDiscount?: number;
  pointsEarned?: number;
}

const errorOf = (error: unknown) => {
  if (error instanceof Error && !(error as Error & { code?: string }).code)
    return error.message;
  console.error("[MH OP order operation]", error);
  return "The order operation could not be completed. Try again.";
};

const num = (value: string | number) => Number(value);

const title = <T extends string>(value: T) =>
  `${value.charAt(0).toUpperCase()}${value.slice(1)}` as string;

export function shouldRestoreOrderInventory(fulfillmentStatus: string) {
  return !["cancelled", "returned"].includes(fulfillmentStatus);
}

export function calculateSettlementAfterOrderDeletion(
  remaining: Array<{
    allocatedCollected: string | number;
    allocatedCourierFee: string | number;
  }>,
  bankReceivedAmount: string | number,
  otherFees: string | number,
) {
  const totalCollected = remaining.reduce(
    (sum, allocation) => sum + num(allocation.allocatedCollected),
    0,
  );
  const totalCourierFees = remaining.reduce(
    (sum, allocation) => sum + num(allocation.allocatedCourierFee),
    0,
  );
  const discrepancyAmount =
    num(bankReceivedAmount) -
    (totalCollected - totalCourierFees - num(otherFees));
  return { totalCollected, totalCourierFees, discrepancyAmount };
}

export async function deleteOrder(
  orderId: string,
  confirmationCode: string,
  reason: string,
  actor = "admin",
): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };
    if (!reason?.trim() || reason.trim().length < 3)
      return { ok: false, error: "A deletion reason is required." };

    await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .for("update");

      if (!order) throw new Error("Order not found");
      if (confirmationCode.trim() !== order.orderCode)
        throw new Error(`Type ${order.orderCode} exactly to confirm deletion`);

      const items = await tx
        .select({
          variantId: orderItems.variantId,
          quantity: orderItems.quantity,
          category: products.category,
          deviceUnitId: orderItems.deviceUnitId,
        })
        .from(orderItems)
        .innerJoin(products, eq(products.id, orderItems.productId))
        .where(eq(orderItems.orderId, orderId));

      const payments = await tx
        .select({ amount: orderPayments.amount, status: orderPayments.status })
        .from(orderPayments)
        .where(eq(orderPayments.orderId, orderId));
      const verifiedPaymentTotal = payments
        .filter((payment) => payment.status === "verified")
        .reduce((sum, payment) => sum + num(payment.amount), 0);

      const allocations = await tx
        .select({
          settlementBatchId: courierSettlementAllocations.settlementBatchId,
        })
        .from(courierSettlementAllocations)
        .where(eq(courierSettlementAllocations.orderId, orderId));
      const affectedBatchIds = [
        ...new Set(allocations.map((allocation) => allocation.settlementBatchId)),
      ];

      if (shouldRestoreOrderInventory(order.fulfillmentStatus)) {
        for (const item of items) {
          if (item.category === "PUBG Accounts") {
            await tx
              .update(productVariants)
              .set({ listingStatus: "available" })
              .where(
                and(
                  eq(productVariants.id, item.variantId),
                  inArray(productVariants.listingStatus, ["reserved", "sold"]),
                ),
              );
          } else {
            await tx
              .update(productVariants)
              .set({
                stockQuantity: sql`${productVariants.stockQuantity} + ${item.quantity}`,
              })
              .where(eq(productVariants.id, item.variantId));
          }

          if (item.deviceUnitId) {
            await tx
              .update(deviceUnits)
              .set({ status: "in_stock", soldAt: null })
              .where(
                and(
                  eq(deviceUnits.id, item.deviceUnitId),
                  inArray(deviceUnits.status, ["reserved", "sold"]),
                ),
              );
          }
        }
      }

      await tx
        .delete(courierSettlementAllocations)
        .where(eq(courierSettlementAllocations.orderId, orderId));

      for (const batchId of affectedBatchIds) {
        const [batch] = await tx
          .select()
          .from(courierSettlementBatches)
          .where(eq(courierSettlementBatches.id, batchId))
          .for("update");
        if (!batch) continue;

        const remaining = await tx
          .select({
            collected: courierSettlementAllocations.allocatedCollected,
            fee: courierSettlementAllocations.allocatedCourierFee,
          })
          .from(courierSettlementAllocations)
          .where(eq(courierSettlementAllocations.settlementBatchId, batchId));
        const { totalCollected, totalCourierFees, discrepancyAmount } =
          calculateSettlementAfterOrderDeletion(
            remaining.map((allocation) => ({
              allocatedCollected: allocation.collected,
              allocatedCourierFee: allocation.fee,
            })),
            batch.bankReceivedAmount,
            batch.otherFees,
          );

        await tx
          .update(courierSettlementBatches)
          .set({
            totalCollected: String(totalCollected),
            totalCourierFees: String(totalCourierFees),
            discrepancyAmount: String(discrepancyAmount),
            status:
              batch.status === "reversed"
                ? "reversed"
                : Math.abs(discrepancyAmount) < 0.01
                  ? "completed"
                  : "discrepancy",
          })
          .where(eq(courierSettlementBatches.id, batchId));

        await tx.insert(staffAlerts).values({
          type: "settlement.adjusted",
          title: `Royal settlement adjusted • ${batch.batchCode}`,
          body: `Order ${order.orderCode} was deleted. Remaining collected: ${totalCollected} MMK, fees: ${totalCourierFees} MMK, discrepancy: ${discrepancyAmount} MMK.`,
          targetCode: batch.batchCode,
        });
      }

      await tx.delete(tickets).where(eq(tickets.orderCode, order.orderCode));
      await tx.delete(orderPayments).where(eq(orderPayments.orderId, orderId));
      await tx.delete(orderBundleSets).where(eq(orderBundleSets.orderId, orderId));
      await tx.delete(orderItems).where(eq(orderItems.orderId, orderId));
      await tx.delete(staffAlerts).where(eq(staffAlerts.targetCode, order.orderCode));
      await tx.delete(orders).where(eq(orders.id, orderId));
      await recalculateCustomerLoyalty(tx, order.customerId);

      const restoredUnits = shouldRestoreOrderInventory(order.fulfillmentStatus)
        ? items.reduce((sum, item) => sum + item.quantity, 0)
        : 0;
      await tx.insert(systemAuditLogs).values({
        category: "orders",
        event: "order.deleted",
        actor: actor.slice(0, 120),
        targetCode: order.orderCode,
        details: `Permanently deleted order. Revenue removed: ${num(order.totalAmount)} MMK. Verified payment ledger removed: ${verifiedPaymentTotal} MMK. Inventory units restored: ${restoredUnits}. Royal allocations removed: ${allocations.length}. Reason: ${reason.trim()}`,
      });

    });

    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorOf(error) };
  }
}

export async function getOrders(): Promise<OperationalOrder[]> {
  if (!db) return demoOrders;

  const rows = await db.select().from(orders).orderBy(desc(orders.createdAt));
  const ids = rows.map((row) => row.id);
  const [itemRows, bundleRows] = ids.length
    ? await Promise.all([
        db
          .select({
            orderId: orderItems.orderId,
            name: products.name,
            category: products.category,
            quantity: orderItems.quantity,
          })
          .from(orderItems)
          .innerJoin(products, eq(products.id, orderItems.productId))
          .where(inArray(orderItems.orderId, ids)),
        db
          .select({
            orderId: orderBundleSets.orderId,
            name: orderBundleSets.bundleName,
          })
          .from(orderBundleSets)
          .where(inArray(orderBundleSets.orderId, ids)),
      ])
    : [[], []];
  const itemLabels = new Map<string, string[]>();
  const itemCategories = new Map<string, string[]>();
  for (const item of itemRows) {
    const list = itemLabels.get(item.orderId) || [];
    list.push(`${item.quantity > 1 ? `${item.quantity}× ` : ""}${item.name}`);
    itemLabels.set(item.orderId, list);
    const categories = itemCategories.get(item.orderId) || [];
    categories.push(item.category);
    itemCategories.set(item.orderId, categories);
  }
  const bundleLabels = new Map<string, string[]>();
  for (const bundle of bundleRows) {
    const list = bundleLabels.get(bundle.orderId) || [];
    list.push(`${bundle.name} bundle`);
    bundleLabels.set(bundle.orderId, list);
  }

  return rows.map((o) => ({
    id: o.id,
    orderCode: o.orderCode,
    customer: o.customerName,
    channel: o.orderSource ? title(o.orderSource) : o.telegramUserId ? "Telegram" : "Web",
    amount: num(o.totalAmount),
    payment: title(o.customerPaymentStatus || o.paymentStatus),
    fulfillment: title(o.fulfillmentStatus),
    item: (
      bundleLabels.get(o.id) ||
      itemLabels.get(o.id) || ["Order items unavailable"]
    ).join(", "),
    created: o.createdAt.toLocaleString("en-US", { timeZone: "Asia/Yangon" }),
    createdAt: o.createdAt,
    phone: o.phone,
    address: o.shippingAddress,
    trackingNumber: o.trackingNumber,
    shippingCarrier: o.shippingCarrier,
    telegramUserId: o.telegramUserId,
    paymentSlipUrl: o.paymentSlipUrl,
    isDigitalOnly: (() => {
      const items = itemCategories.get(o.id) || [];
      return (
        items.length > 0 &&
        items.every((category) => category === "PUBG Accounts")
      );
    })(),
    orderSource: o.orderSource || "web",
    destinationCity: o.destinationCity,
    destinationState: o.destinationState,
    requiredDeposit: num(o.requiredDeposit) || (num(o.totalAmount) > 0 ? (itemCategories.get(o.id)?.every((c) => c === "PUBG Accounts") ? num(o.totalAmount) : Math.min(10000, num(o.totalAmount))) : 0),
    customerPaidAmount: num(o.customerPaidAmount),
    customerBalance:
      o.customerBalance != null && num(o.customerBalance) > 0
        ? num(o.customerBalance)
        : (num(o.customerPaidAmount) >= num(o.totalAmount) ? 0 : Math.max(0, num(o.totalAmount) - num(o.customerPaidAmount))),
    codAmount:
      o.codAmount != null && num(o.codAmount) > 0
        ? num(o.codAmount)
        : (!(itemCategories.get(o.id)?.every((c) => c === "PUBG Accounts")) && num(o.totalAmount) > num(o.customerPaidAmount)
            ? Math.max(0, num(o.totalAmount) - Math.max(num(o.customerPaidAmount), num(o.requiredDeposit) || 10000))
            : 0),
    expectedCourierCost:
      o.expectedCourierCost != null && num(o.expectedCourierCost) > 0
        ? num(o.expectedCourierCost)
        : (!(itemCategories.get(o.id)?.every((c) => c === "PUBG Accounts")) ? 4050 : 0),
    actualCourierCost: o.actualCourierCost != null ? num(o.actualCourierCost) : null,
    customerPaymentStatus: o.customerPaymentStatus || "unpaid",
    courierSettlementStatus: o.courierSettlementStatus || "not_applicable",
    commercialFrozen: Boolean(o.commercialFrozen),
    deliveryFeeConfirmed: Boolean(o.deliveryFeeConfirmed),
    customerTier: o.customerTier || "member",
    tierDiscountAmount: num(o.tierDiscountAmount),
    tierDeliveryDiscount: num(o.tierDeliveryDiscount),
    pointsEarned: Number(o.pointsEarned || 0),
  }));
}

export async function getRevenueSeries(days = 14): Promise<RevenuePoint[]> {
  const safeDays = Math.min(60, Math.max(1, Math.trunc(days))),
    today = new Date(),
    start = new Date(today);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - safeDays + 1);
  const buckets = Array.from({ length: safeDays }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = date.toISOString().slice(0, 10);
      return {
        date: key,
        label: new Intl.DateTimeFormat("en-US", {
          day: "numeric",
          timeZone: "Asia/Yangon",
        }).format(date),
        value: 0,
      };
    }),
    map = new Map(buckets.map((point) => [point.date, point]));
  if (!db) {
    const demo = [
      12.4, 18.2, 15.1, 24.7, 21.2, 31.8, 28.4, 35.5, 32.1, 40.2, 38.4, 48.8,
      44.6, 52.4,
    ].slice(-safeDays);
    return buckets.map((point, index) => ({
      ...point,
      value: (demo[index] || 0) * 1_000_000,
    }));
  }
  const paid = await db
    .select({ amount: orders.totalAmount, createdAt: orders.createdAt })
    .from(orders)
    .where(
      and(
        eq(orders.paymentStatus, "verified"),
        sql`${orders.createdAt}>=${start}`,
      ),
    );
  for (const order of paid) {
    const key = new Date(order.createdAt).toLocaleDateString("en-CA", {
      timeZone: "Asia/Yangon",
    });
    const point = map.get(key);
    if (point) point.value += num(order.amount);
  }
  return buckets;
}

export async function getReceiptOrders(): Promise<ReceiptOrder[]> {
  if (!db)
    return demoOrders.slice(0, 4).map((order, index) => {
      const digitalOnly = order.item.toLowerCase().includes("pubg");
      const shippingFee = calculateOrderShipping(
        order.amount,
        "otherCities",
        digitalOnly,
      );
      const subtotal = Math.max(0, order.amount - shippingFee);
      return {
        id: order.id,
        code: order.id,
        customer: order.customer,
        phone: "—",
        address: digitalOnly ? "Secure digital handover" : "—",
        total: order.amount,
        subtotal,
        shippingFee,
        paidAmount: order.payment === "Verified" ? order.amount : 0,
        outstandingBalance: order.payment === "Verified" ? 0 : order.amount,
        paymentMethod: "KBZPay",
        paymentStatus: order.payment,
        carrier: digitalOnly
          ? "Digital handover"
          : clientConfig.shipping.courier,
        createdAt: new Date(Date.now() - index * 86400000),
        items: [
          {
            name: order.item,
            sku: "DEMO-SKU",
            quantity: 1,
            unitPrice: subtotal,
            discountPercent: 0,
            identifier: null,
            warrantyMonths: digitalOnly ? 1 : 6,
          },
        ],
        bundles: [],
      };
    });
  const base = await db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(100),
    ids = base.map((order) => order.id);
  if (!ids.length) return [];
  const items = await db
    .select({
      orderId: orderItems.orderId,
      name: products.name,
      sku: productVariants.sku,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      retailPrice: productVariants.price,
      serial: deviceUnits.serialNumber,
      imei: deviceUnits.imeiNumber,
      warrantyMonths: productVariants.warrantyMonths,
    })
    .from(orderItems)
    .innerJoin(products, eq(products.id, orderItems.productId))
    .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .leftJoin(deviceUnits, eq(deviceUnits.id, orderItems.deviceUnitId))
    .where(inArray(orderItems.orderId, ids));
  const snapshots = await db
    .select({
      orderId: orderBundleSets.orderId,
      name: orderBundleSets.bundleName,
    })
    .from(orderBundleSets)
    .where(inArray(orderBundleSets.orderId, ids));
  return base.map((order) => ({
    id: order.id,
    code: order.orderCode,
    customer: order.customerName,
    phone: order.phone,
    address: order.shippingAddress || "—",
    total: num(order.totalAmount),
    subtotal: Math.max(0, num(order.totalAmount) - num(order.shippingFee)),
    shippingFee: num(order.shippingFee),
    paidAmount: num(order.customerPaidAmount ?? (order.paymentStatus === "verified" ? order.totalAmount : 0)),
    outstandingBalance: num(order.customerBalance ?? (order.paymentStatus === "verified" ? 0 : order.totalAmount)),
    requiredDeposit: num(order.requiredDeposit),
    codAmount: num(order.codAmount),
    customerPaymentStatus: order.customerPaymentStatus || order.paymentStatus,
    courierSettlementStatus: order.courierSettlementStatus || "not_applicable",
    destinationCity: order.destinationCity,
    destinationState: order.destinationState,
    customerTier: order.customerTier || "member",
    tierDiscountAmount: num(order.tierDiscountAmount),
    tierDeliveryDiscount: num(order.tierDeliveryDiscount),
    pointsEarned: Number(order.pointsEarned || 0),
    paymentMethod: order.paymentMethod || "Not recorded",
    paymentStatus: order.paymentStatus,
    carrier: order.shippingCarrier || "Not assigned",
    createdAt: order.createdAt,
    items: items
      .filter((item) => item.orderId === order.id)
      .map((item) => ({
        name: item.name,
        sku: item.sku,
        quantity: Number(item.quantity),
        unitPrice: num(item.unitPrice),
        discountPercent:
          num(item.retailPrice) > 0
            ? Math.max(
                0,
                Math.round(
                  ((num(item.retailPrice) - num(item.unitPrice)) /
                    num(item.retailPrice)) *
                    100,
                ),
              )
            : 0,
        identifier: item.imei || item.serial || null,
        warrantyMonths: Number(item.warrantyMonths),
      })),
    bundles: snapshots
      .filter((bundle) => bundle.orderId === order.id)
      .map((bundle) => bundle.name),
  }));
}

export async function lookupWarranty(
  orderCode: string,
  phone: string,
): Promise<WarrantyResult | null> {
  if (!db) return null;
  const rows = await db
    .select({
      orderCode: orders.orderCode,
      customer: orders.customerName,
      paymentStatus: orders.paymentStatus,
      fulfillmentStatus: orders.fulfillmentStatus,
      createdAt: orders.createdAt,
      deliveredAt: orders.deliveredAt,
      name: products.name,
      warrantyMonths: productVariants.warrantyMonths,
      serial: deviceUnits.serialNumber,
      imei: deviceUnits.imeiNumber,
    })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .innerJoin(products, eq(products.id, orderItems.productId))
    .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .leftJoin(deviceUnits, eq(deviceUnits.id, orderItems.deviceUnitId))
    .where(and(eq(orders.orderCode, orderCode), eq(orders.phone, phone)));
  if (!rows.length) return null;
  const first = rows[0];
  return {
    orderCode: first.orderCode,
    customer: first.customer,
    paymentStatus: first.paymentStatus,
    fulfillmentStatus: first.fulfillmentStatus,
    items: rows.map((row) => {
      const policy = evaluateWarrantyPolicy({
        paymentStatus: first.paymentStatus,
        fulfillmentStatus: first.fulfillmentStatus,
        deliveredAt: row.deliveredAt,
        orderCreatedAt: row.createdAt,
        warrantyMonths: row.warrantyMonths,
      });
      return {
        name: row.name,
        identifier: row.imei || row.serial || null,
        warrantyMonths: row.warrantyMonths,
        coverageStatus: policy.status,
        warrantyStarts: policy.startAt.toLocaleDateString("en-GB", {
          timeZone: "Asia/Yangon",
        }),
        validUntil: policy.expiresAt.toLocaleDateString("en-GB", {
          timeZone: "Asia/Yangon",
        }),
      };
    }),
  };
}

export async function createOrder(
  form: FormData,
): Promise<ActionResult<{ orderCode: string }>> {
  try {
    if (!db) {
      return {
        ok: false,
        error: "Database is not configured. Add DATABASE_URL to .env.local.",
      };
    }

    const parsed = orderSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message || "Invalid order",
      };
    }

    const rawSkus = String(form.get("skus") || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, 50);
    const bundleIds = String(form.get("bundleIds") || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, 10);
    if (!rawSkus.length && !bundleIds.length) {
      return {
        ok: false,
        error: "Your order does not contain any products or bundles",
      };
    }
    const individualQuantities = new Map<string, number>();
    for (const raw of rawSkus) {
      const [sku, qtyStr] = raw.split(":");
      const cleanSku = (sku || "").trim();
      if (!cleanSku) continue;
      const count = qtyStr ? Math.max(1, parseInt(qtyStr, 10) || 1) : 1;
      individualQuantities.set(cleanSku, (individualQuantities.get(cleanSku) || 0) + count);
    }
    if (!individualQuantities.size && !bundleIds.length) {
      return {
        ok: false,
        error: "Your order does not contain any products or bundles",
      };
    }
    const orderCode = `MHOP-${new Date()
      .toISOString()
      .slice(2, 10)
      .replaceAll("-", "")}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

    const { paymentMethod } = parsed.data;
    const rawTag = (parsed.data.telegramUsername || "").trim().replace(/^@/, "");
    const customer = {
      customerName: parsed.data.customerName,
      phone: parsed.data.phone,
      telegramUserId: parsed.data.telegramUserId || undefined,
      telegramUsername: rawTag || undefined,
      shippingAddress: parsed.data.shippingAddress,
      destinationCity: parsed.data.destinationCity,
      orderSource: parsed.data.orderSource,
    };

    const orderSummary = await db.transaction(async (tx) => {
      const selectedBundles = bundleIds.length
        ? await tx
            .select()
            .from(bundles)
            .where(
              and(
                inArray(bundles.id, [...new Set(bundleIds)]),
                eq(bundles.isActive, true),
              ),
            )
            .for("update")
        : [];
      if (selectedBundles.length !== new Set(bundleIds).size)
        throw new Error("One or more bundles are unavailable");
      const quantities = new Map(individualQuantities);
      for (const bundle of selectedBundles) {
        const lines = Array.isArray(bundle.itemsJson)
          ? (bundle.itemsJson as {
              sku?: string;
              quantity?: number;
              qty?: number;
            }[])
          : [];
        if (lines.length < 2)
          throw new Error(`${bundle.name} is not configured correctly`);
        for (const line of lines) {
          const sku = String(line.sku || "").trim(),
            quantity = Number(line.quantity || line.qty || 1);
          if (!sku || !Number.isInteger(quantity) || quantity < 1)
            throw new Error(`${bundle.name} contains an invalid product line`);
          quantities.set(sku, (quantities.get(sku) || 0) + quantity);
        }
      }
      const uniqueSkus = [...quantities.keys()];
      const selected = await tx
        .select({
          productId: products.id,
          productName: products.name,
          variantId: productVariants.id,
          sku: productVariants.sku,
          price: productVariants.price,
          cost: productVariants.costPrice,
          stock: productVariants.stockQuantity,
          listingStatus: productVariants.listingStatus,
          category: products.category,
        })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(
          and(
            inArray(productVariants.sku, uniqueSkus),
            eq(products.isActive, true),
            eq(productVariants.isActive, true),
          ),
        )
        .for("update");
      if (selected.length !== uniqueSkus.length)
        throw new Error("One or more products are unavailable");
      for (const item of selected) {
        const quantity = quantities.get(item.sku) || 0;
        if (!canPurchaseListing(item, quantity))
          throw new Error(`${item.sku} is unavailable for the requested quantity`);
      }
      const retailSubtotal = selected.reduce(
        (sum, item) => sum + num(item.price) * (quantities.get(item.sku) || 0),
        0,
      );
      const individualSubtotal = selected.reduce(
        (sum, item) =>
          sum + num(item.price) * (individualQuantities.get(item.sku) || 0),
        0,
      );
      const subtotal =
        individualSubtotal +
        selectedBundles.reduce(
          (sum, bundle) => sum + num(bundle.bundlePrice),
          0,
        );
      if (subtotal <= 0 || retailSubtotal <= 0)
        throw new Error("Order pricing could not be calculated");
      const allocatedUnits = allocateDiscountedUnits(
        selected.map((item) => ({
          key: item.sku,
          retailPrice: num(item.price),
          quantity: quantities.get(item.sku) || 0,
        })),
        subtotal,
      );
      const digitalOnly = selected.every(
        (item) => item.category === "PUBG Accounts",
      );
      const destinationCity = parsed.data.destinationCity || "Yangon";
      if (!digitalOnly && isLocationSuspended(destinationCity)) {
        throw new Error(SUSPENDED_DELIVERY_NOTICE);
      }
      const weightKg = Number(form.get("weightKg")) || 1.0;
      const royalDelivery = calculateRoyalDelivery({
        destinationCity,
        weightKg,
        isDigitalOnly: digitalOnly,
      });

      // Check customer loyalty tier for automatic perks
      const cleanCustomerPhone = (customer.phone || "").trim().replace(/[^\d+]/g, "");
      const cleanCustomerTag = (customer.telegramUsername || "").trim().replace(/^@/, "");
      const loyaltyConditions = [];
      if (cleanCustomerPhone) {
        loyaltyConditions.push(eq(customers.phone, cleanCustomerPhone));
        loyaltyConditions.push(eq(customers.secondaryPhone, cleanCustomerPhone));
      }
      if (customer.telegramUserId) loyaltyConditions.push(eq(customers.telegramUserId, customer.telegramUserId));
      if (cleanCustomerTag) {
        loyaltyConditions.push(eq(customers.telegramUsername, cleanCustomerTag));
        loyaltyConditions.push(eq(customers.telegramUsername, `@${cleanCustomerTag}`));
      }

      const matchingCustomers = loyaltyConditions.length
        ? await tx
            .select()
            .from(customers)
            .where(and(eq(customers.isActive, true), or(...loyaltyConditions)))
            .orderBy(desc(customers.points))
        : [];

      let customerTier: CustomerTier = "member";
      let resolvedCustomerProfileId: string;
      let effectiveTgUserId = customer.telegramUserId;
      let effectiveTgUsername = cleanCustomerTag || customer.telegramUsername;

      if (matchingCustomers.length > 0) {
        // Existing customer found! Do NOT create duplicate customer account.
        const baseCustomer = matchingCustomers[0];
        const otherDuplicates = matchingCustomers.slice(1);

        let accumulatedPoints = baseCustomer.points || 0;
        for (const dup of otherDuplicates) {
          accumulatedPoints += (dup.points || 0);
          await tx
            .update(orders)
            .set({ customerId: baseCustomer.id })
            .where(eq(orders.customerId, dup.id));
          await tx
            .update(customers)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(customers.id, dup.id));
        }

        customerTier = getTierForPoints(accumulatedPoints);
        resolvedCustomerProfileId = baseCustomer.id;
        effectiveTgUserId = customer.telegramUserId || baseCustomer.telegramUserId || undefined;
        effectiveTgUsername = cleanCustomerTag || baseCustomer.telegramUsername || undefined;

        // Determine primary and secondary phone
        let primaryPhone = baseCustomer.phone;
        let secondaryPhone = baseCustomer.secondaryPhone;

        if (primaryPhone.startsWith("TG-") && cleanCustomerPhone) {
          primaryPhone = cleanCustomerPhone;
        } else if (cleanCustomerPhone && cleanCustomerPhone !== primaryPhone) {
          secondaryPhone = cleanCustomerPhone;
        }

        await tx
          .update(customers)
          .set({
            name: customer.customerName || baseCustomer.name,
            phone: primaryPhone,
            secondaryPhone: secondaryPhone || null,
            telegramUserId: effectiveTgUserId || null,
            telegramUsername: effectiveTgUsername || null,
            points: accumulatedPoints,
            tier: customerTier,
            ...(!digitalOnly && customer.shippingAddress ? { primaryAddress: customer.shippingAddress } : {}),
            updatedAt: new Date(),
          })
          .where(eq(customers.id, baseCustomer.id));
      } else {
        // Brand new customer record
        customerTier = "member";
        effectiveTgUsername = cleanCustomerTag || undefined;
        effectiveTgUserId = customer.telegramUserId || undefined;

        const [customerProfile] = await tx
          .insert(customers)
          .values({
            customerCode: generateCustomerCode(),
            name: customer.customerName,
            phone: cleanCustomerPhone,
            telegramUserId: effectiveTgUserId || null,
            telegramUsername: effectiveTgUsername || null,
            primaryAddress: digitalOnly ? null : customer.shippingAddress || null,
            points: 0,
            tier: "member",
            isActive: true,
          })
          .onConflictDoUpdate({
            target: customers.phone,
            set: {
              name: customer.customerName,
              ...(effectiveTgUserId ? { telegramUserId: effectiveTgUserId } : {}),
              ...(effectiveTgUsername ? { telegramUsername: effectiveTgUsername } : {}),
              ...(!digitalOnly && customer.shippingAddress
                ? { primaryAddress: customer.shippingAddress }
                : {}),
              isActive: true,
              updatedAt: new Date(),
            },
          })
          .returning({ id: customers.id });

        if (!customerProfile) throw new Error("Customer profile could not be saved");
        resolvedCustomerProfileId = customerProfile.id;
      }

      const standardShipping = digitalOnly ? 0 : royalDelivery.customerDeliveryFee;
      const tierPerks = calculateTierPerks(customerTier, subtotal, standardShipping);
      const shippingFee = digitalOnly ? 0 : tierPerks.netDeliveryFee;
      const tierDiscountAmount = tierPerks.productDiscountAmount;
      const tierDeliveryDiscount = digitalOnly ? 0 : tierPerks.deliveryDiscountAmount;
      const total = tierPerks.netProductSubtotal + shippingFee;
      const pointsEarned = calculatePointsFromAmount(total);

      const requiredDeposit = calculateRequiredDeposit(total, digitalOnly);
      const codAmount = Math.max(0, total - requiredDeposit);

      const [created] = await tx
        .insert(orders)
        .values({
          ...customer,
          orderSource: parsed.data.orderSource || "web",
          destinationCity: royalDelivery.destinationCity,
          destinationState: royalDelivery.destinationState,
          streetAddress: customer.shippingAddress || null,
          shippingAddress: customer.shippingAddress || null,
          telegramUserId: effectiveTgUserId || null,
          customerId: resolvedCustomerProfileId,
          totalAmount: String(total),
          shippingZone: royalDelivery.zone,
          shippingFee: String(shippingFee),
          shippingCarrier: digitalOnly
            ? "Digital handover"
            : clientConfig.shipping.courier,
          paymentMethod,
          orderCode,
          isDigitalOnly: digitalOnly,
          packedWeightKg: String(royalDelivery.weightKg),
          expectedCourierCost: String(royalDelivery.expectedCourierCost),
          requiredDeposit: String(requiredDeposit),
          customerPaidAmount: "0",
          customerBalance: String(total),
          codAmount: String(codAmount),
          customerPaymentStatus: "unpaid",
          courierSettlementStatus: digitalOnly ? "not_applicable" : "unsettled",
          deliveryFeeConfirmed: true,
          commercialFrozen: false,
          customerTier,
          tierDiscountAmount: String(tierDiscountAmount),
          tierDeliveryDiscount: String(tierDeliveryDiscount),
          pointsEarned,
        })
        .returning({ id: orders.id });

      if (selectedBundles.length)
        await tx.insert(orderBundleSets).values(
          selectedBundles.map((bundle) => ({
            orderId: created.id,
            bundleId: bundle.id,
            bundleName: bundle.name,
            bundlePrice: bundle.bundlePrice,
            itemsJson: bundle.itemsJson,
          })),
        );

      if (selected.length) {
        for (const item of selected) {
          const quantity = quantities.get(item.sku) || 1;
          const prices = allocatedUnits.filter((unit) => unit.key === item.sku);
          for (const price of prices) {
            await tx
              .insert(orderItems)
              .values({
                orderId: created.id,
                productId: item.productId,
                variantId: item.variantId,
                unitPrice: price.unitPrice.toFixed(2),
                costSnapshot: item.cost,
                quantity: 1,
              })
              .returning({ id: orderItems.id });
          }
          if (item.category === "PUBG Accounts") {
            const [reserved] = await tx.update(productVariants).set({ listingStatus: "reserved" })
              .where(and(eq(productVariants.id, item.variantId), eq(productVariants.listingStatus, "available")))
              .returning({ id: productVariants.id });
            if (!reserved) throw new Error(`${item.sku} is already reserved`);
            continue;
          }
          const [updated] = await tx
            .update(productVariants)
            .set({
              stockQuantity: sql`${productVariants.stockQuantity} - ${quantity}`,
            })
            .where(
              and(
                eq(productVariants.id, item.variantId),
                sql`${productVariants.stockQuantity} >= ${quantity}`,
              ),
            )
            .returning({ id: productVariants.id });
          if (!updated) throw new Error(`${item.sku} went out of stock`);
        }
      }

      await tx.insert(staffAlerts).values({
        type: "order.created",
        title: `New order ${orderCode}`,
        body: `${parsed.data.customerName} placed an order for ${total} MMK`,
        targetCode: orderCode,
      });

      return {
        orderId: created.id,
        orderCode,
        total,
        shippingFee,
        requiredDeposit,
        codAmount,
        destinationCity: royalDelivery.destinationCity,
        telegramUserId: effectiveTgUserId,
        selectedItems: selected.map((item) => ({
          name: item.productName || item.sku,
          quantity: quantities.get(item.sku) || 1,
          unitPrice: num(item.price),
          sku: item.sku,
        })),
        bundleSummaries: selectedBundles.map((bundle) => ({
          name: bundle.name,
          price: num(bundle.bundlePrice),
        })),
      };
    });

    await audit(
      "order.created",
      orderCode,
      `Order created for ${parsed.data.customerName}`,
    );

    // Telegram Notifications (Best-effort, does not block order creation)
    const receiptData = {
      orderCode: orderSummary.orderCode,
      customerName: parsed.data.customerName,
      phone: parsed.data.phone,
      shippingAddress: parsed.data.shippingAddress || "Secure digital handover",
      destinationCity: orderSummary.destinationCity,
      shippingFee: orderSummary.shippingFee,
      totalAmount: orderSummary.total,
      requiredDeposit: orderSummary.requiredDeposit,
      codAmount: orderSummary.codAmount,
      paymentMethod: parsed.data.paymentMethod,
      items: orderSummary.selectedItems,
      bundles: orderSummary.bundleSummaries,
    };

    // 1. Notify Manager Bot in Operations Group
    try {
      const managerText = formatManagerOrderAlert(receiptData);
      await sendTelegramOpsMessage(managerText, { parse_mode: "HTML" });
    } catch (opsErr) {
      console.error("[Telegram Manager Notification Error]", opsErr);
    }

    // 2. Generate and dispatch receipt back to customer via Customer Bot (if linked)
    if (orderSummary.telegramUserId) {
      const bankInfoMessage = await formatBankAccountsTelegramMessage(parsed.data.paymentMethod);

      try {
        const paymentAccount = await getPaymentAccountForMethod(parsed.data.paymentMethod);
        const receiptImage = await renderDepositRequestReceiptImage({
          ...receiptData,
          paymentAccount,
        });
        await sendTelegramPhoto(orderSummary.telegramUserId, receiptImage, {
          filename: `${orderSummary.orderCode}-45mm-deposit-request.png`,
          caption: `🧾 <b>${orderSummary.orderCode}</b> · 45mm စရန်ငွေတောင်းခံလွှာ\nယခုပေးချေရမည့် စရန်ငွေ: <b>${formatMMK(orderSummary.requiredDeposit)}</b>\n\nPayment Slip ပုံနှင့် Order Code ကို ဤ Bot သို့ ပေးပို့ပါခင်ဗျာ။ Admin အတည်ပြုပြီးပါက Royal COD ပါသော အဓိကပြေစာကို ပို့ပေးပါမည်။`,
          parse_mode: "HTML",
        });
        // Also send bank transfer details
        await sendTelegramMessage(orderSummary.telegramUserId, bankInfoMessage, {
          parse_mode: "HTML",
        });
      } catch (custErr) {
        console.error("[Telegram Customer Receipt Image Error]", custErr);
        try {
          const customerReceiptText = formatDepositRequestReceipt(receiptData);
          await sendTelegramMessage(orderSummary.telegramUserId, customerReceiptText, {
            parse_mode: "HTML",
          });
          // Also send bank transfer details on fallback
          await sendTelegramMessage(orderSummary.telegramUserId, bankInfoMessage, {
            parse_mode: "HTML",
          });
        } catch (fallbackErr) {
          console.error("[Telegram Customer Receipt Fallback Error]", fallbackErr);
        }
      }
    }

    return { ok: true, data: { orderCode } };
  } catch (error) {
    return { ok: false, error: errorOf(error) };
  }
}

export async function reviewPayment(
  orderId: string,
  decision: "verified" | "rejected",
): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };

    const reviewed = await db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          code: orders.orderCode,
          paymentStatus: orders.paymentStatus,
          fulfillmentStatus: orders.fulfillmentStatus,
          paymentSlipUrl: orders.paymentSlipUrl,
          requiredDeposit: orders.requiredDeposit,
          totalAmount: orders.totalAmount,
          codAmount: orders.codAmount,
          paymentMethod: orders.paymentMethod,
        })
        .from(orders)
        .where(eq(orders.id, orderId))
        .for("update");
      if (!current) throw new Error("Order not found");
      if (
        ["cancelled", "dispatched", "delivered"].includes(
          current.fulfillmentStatus,
        )
      )
        throw new Error("Payment can no longer be reviewed for this order");
      if (decision === "verified" && !current.paymentSlipUrl)
        throw new Error("A payment slip is required before approval");
      if (current.paymentStatus === decision)
        throw new Error(
          decision === "verified"
            ? "Payment is already approved"
            : "Payment is already rejected",
        );
      if (current.paymentStatus === "verified" && decision === "rejected")
        throw new Error(
          "Use the refund or cancellation workflow after approval",
        );

      const now = new Date();
      if (decision === "verified") {
        const pendingPayments = await tx
          .select()
          .from(orderPayments)
          .where(
            and(
              eq(orderPayments.orderId, orderId),
              eq(orderPayments.status, "pending"),
            ),
          );

        if (pendingPayments.length > 0) {
          for (const p of pendingPayments) {
            await tx
              .update(orderPayments)
              .set({ status: "verified", verifiedBy: "admin", verifiedAt: now })
              .where(eq(orderPayments.id, p.id));
          }
        } else {
          const depositAmount = num(current.requiredDeposit) || num(current.totalAmount);
          await tx.insert(orderPayments).values({
            orderId,
            paymentType: num(current.codAmount) > 0 ? "deposit" : "direct_prepayment",
            amount: String(depositAmount),
            paymentMethod: current.paymentMethod || "kbzpay",
            status: "verified",
            slipUrl: current.paymentSlipUrl,
            recordedBy: "admin",
            verifiedBy: "admin",
            verifiedAt: now,
            notes: "Verified via order management review",
            createdAt: now,
          });
        }
        await recalculateOrderPayments(tx, orderId);
      } else {
        await tx
          .update(orderPayments)
          .set({ status: "rejected", verifiedBy: "admin" })
          .where(
            and(
              eq(orderPayments.orderId, orderId),
              eq(orderPayments.status, "pending"),
            ),
          );
      }

      const changed = await tx
        .update(orders)
        .set({
          paymentStatus: decision,
          ...(decision === "verified"
            ? { fulfillmentStatus: "packing" as const }
            : { customerPaymentStatus: "unpaid" }),
        })
        .where(eq(orders.id, orderId))
        .returning({
          code: orders.orderCode,
          telegramUserId: orders.telegramUserId,
          customerId: orders.customerId,
          pointsEarned: orders.pointsEarned,
          totalAmount: orders.totalAmount,
        });

      if (!changed[0]) throw new Error("Order not found");

      if (decision === "verified" && changed[0].customerId) {
        const points =
          changed[0].pointsEarned > 0
            ? changed[0].pointsEarned
            : calculatePointsFromAmount(Number(changed[0].totalAmount || 0));
        await awardCustomerPoints(tx, changed[0].customerId, points);
      }

      await tx.insert(staffAlerts).values({
        type: `payment.${decision}`,
        title:
          decision === "verified"
            ? `Payment approved • ${changed[0].code}`
            : `Payment rejected • ${changed[0].code}`,
        body:
          decision === "verified"
            ? "Payment is verified. The order is now ready for packing."
            : "Payment evidence was rejected and requires customer follow-up.",
        targetCode: changed[0].code,
      });

      return changed[0];
    });

    await audit(`payment.${decision}`, orderId, `Payment marked ${decision}`);

    // If customer has linked Telegram, send the second-stage main receipt after
    // approval. Rejections remain a text notification because no valid receipt
    // should be issued for rejected payment evidence.
    if (reviewed?.telegramUserId) {
      if (decision === "verified") {
        const approvedOrder = await getOrderById(orderId);
        if (approvedOrder) {
          const approvedReceiptData = {
            orderCode: approvedOrder.orderCode,
            customerName: approvedOrder.customerName,
            phone: approvedOrder.phone,
            shippingAddress:
              approvedOrder.shippingAddress || "Secure digital handover",
            destinationCity: approvedOrder.destinationCity,
            destinationState: approvedOrder.destinationState,
            shippingFee: approvedOrder.shippingFee,
            totalAmount: approvedOrder.totalAmount,
            requiredDeposit: approvedOrder.requiredDeposit,
            customerPaidAmount: approvedOrder.customerPaidAmount,
            customerBalance: approvedOrder.customerBalance,
            codAmount: approvedOrder.codAmount,
            customerPaymentStatus: approvedOrder.customerPaymentStatus,
            paymentMethod: approvedOrder.paymentMethod || "kbzpay",
            customerTier: approvedOrder.customerTier,
            tierDiscountAmount: num(approvedOrder.tierDiscountAmount),
            tierDeliveryDiscount: num(approvedOrder.tierDeliveryDiscount),
            pointsEarned: approvedOrder.pointsEarned,
            items: approvedOrder.items.map((item) => ({
              name: item.name,
              sku: item.sku,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          };

          try {
            const receiptImage = await renderCustomerReceiptImage(
              approvedReceiptData,
            );
            const paymentCaption = approvedOrder.isDigitalOnly
              ? `ပေးချေပြီးငွေ: <b>${formatMMK(approvedOrder.totalAmount)}</b> · ကျန်ငွေ 0 MMK`
              : `အတည်ပြုပြီး စရန်ငွေ: <b>${formatMMK(approvedOrder.customerPaidAmount)}</b>\nRoyal Express COD (ပစ္စည်းရောက်မှ): <b>${formatMMK(approvedOrder.codAmount)}</b>`;
            await sendTelegramPhoto(reviewed.telegramUserId, receiptImage, {
              filename: `${reviewed.code}-main-receipt.png`,
              caption: `✅ <b>ငွေလွှဲပြေစာ အတည်ပြုပြီးပါပြီ</b>\nOrder Code: <code>${reviewed.code}</code>\n${paymentCaption}\n\nဤအဓိကပြေစာကို သိမ်းဆည်းထားပေးပါခင်ဗျာ။ ပစ္စည်းများကို ထုတ်ပိုးပြင်ဆင်နေပါသည်။`,
              parse_mode: "HTML",
            });
          } catch (err) {
            console.error("[Telegram Approved Main Receipt Image Error]", err);
            try {
              await sendTelegramMessage(
                reviewed.telegramUserId,
                formatCustomerReceipt(approvedReceiptData),
                { parse_mode: "HTML" },
              );
            } catch (fallbackErr) {
              console.error(
                "[Telegram Approved Main Receipt Fallback Error]",
                fallbackErr,
              );
            }
          }
        }
      } else {
        try {
          await sendTelegramMessage(
            reviewed.telegramUserId,
            `⚠️ <b>ငွေလွှဲပြေစာ စစ်ဆေးမှု မအောင်မြင်ပါ</b>\nOrder Code: <code>${reviewed.code}</code> အတွက် ငွေလွှဲပြေစာကို အတည်ပြု၍မရသေးပါခင်ဗျာ။ Customer Service (/support) သို့ ဆက်သွယ်မေးမြန်းပေးပါရန်။`,
            { parse_mode: "HTML" },
          );
        } catch (err) {
          console.error("[Telegram Customer Payment Decision Error]", err);
        }
      }
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorOf(error) };
  }
}

export async function recordTelegramPaymentSlip(
  orderCode: string,
  fileId: string,
  telegramUserId: string,
): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };
    if (!/^MHOP-\d{6}-[A-Z0-9]{4}$/i.test(orderCode) || !fileId)
      return {
        ok: false,
        error: "A valid order code and Telegram file are required",
      };
    const [updated] = await db.transaction(async (tx) => {
      const changed = await tx
        .update(orders)
        .set({ paymentSlipUrl: `telegram-file:${fileId}`, telegramUserId })
        .where(eq(orders.orderCode, orderCode.toUpperCase()))
        .returning({
          id: orders.id,
          code: orders.orderCode,
          customerId: orders.customerId,
        });
      if (!changed[0]) throw new Error("Order code was not found");
      await tx
        .update(customers)
        .set({ telegramUserId, updatedAt: new Date() })
        .where(eq(customers.id, changed[0].customerId));
      await tx.insert(staffAlerts).values({
        type: "payment.slip_uploaded",
        title: `Payment slip received for ${changed[0].code}`,
        body: "Telegram payment evidence is ready for staff review.",
        targetCode: changed[0].code,
      });
      return changed;
    });
    await audit(
      "payment.slip_uploaded",
      updated.code,
      "Payment slip received through Telegram",
      "telegram",
    );

    // Notify Manager Bot in operations group that payment slip arrived for manual verification
    try {
      await sendTelegramOpsMessage(
        `💳 <b>Payment Slip Received</b>\nOrder Code: <code>${updated.code}</code>\nTelegram Customer: <code>${telegramUserId}</code>\n\nAdmin console တွင် စစ်ဆေးအတည်ပြုပေးပါရန်။`,
        { parse_mode: "HTML" },
      );
    } catch (opsErr) {
      console.error("[Telegram Slip Ops Alert Error]", opsErr);
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorOf(error) };
  }
}

export async function getLatestPendingOrderByTelegramUser(
  telegramUserId: string,
): Promise<{ orderCode: string; totalAmount: string } | null> {
  if (!db || !telegramUserId) return null;
  try {
    const [recent] = await db
      .select({
        orderCode: orders.orderCode,
        totalAmount: orders.totalAmount,
      })
      .from(orders)
      .where(
        and(
          eq(orders.telegramUserId, telegramUserId),
          eq(orders.paymentStatus, "pending"),
        ),
      )
      .orderBy(desc(orders.createdAt))
      .limit(1);

    return recent || null;
  } catch (err) {
    console.error("[getLatestPendingOrderByTelegramUser error]", err);
    return null;
  }
}

export async function getLatestOrderByTelegramUser(
  telegramUserId: string,
): Promise<{
  orderCode: string;
  totalAmount: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  trackingNumber: string | null;
  createdAt: Date;
} | null> {
  if (!db || !telegramUserId) return null;
  try {
    const [recent] = await db
      .select({
        orderCode: orders.orderCode,
        totalAmount: orders.totalAmount,
        paymentStatus: orders.paymentStatus,
        fulfillmentStatus: orders.fulfillmentStatus,
        trackingNumber: orders.trackingNumber,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(eq(orders.telegramUserId, telegramUserId))
      .orderBy(desc(orders.createdAt))
      .limit(1);

    return recent || null;
  } catch (err) {
    console.error("[getLatestOrderByTelegramUser error]", err);
    return null;
  }
}

export async function updateFulfillment(
  orderId: string,
  status:
    | "confirmed"
    | "packing"
    | "packed"
    | "dispatched"
    | "delivered"
    | "cancelled",
): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };

    const updated = await db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          code: orders.orderCode,
          status: orders.fulfillmentStatus,
          paymentStatus: orders.paymentStatus,
          customerPaymentStatus: orders.customerPaymentStatus,
          trackingNumber: orders.trackingNumber,
          deliveryFeeConfirmed: orders.deliveryFeeConfirmed,
          deliveredAt: orders.deliveredAt,
        })
        .from(orders)
        .where(eq(orders.id, orderId))
        .for("update");
      if (!current) throw new Error("Order not found");
      if (current.status === "cancelled")
        throw new Error("A cancelled order cannot be reopened");
      if (current.status === status)
        throw new Error(`Order is already ${status}`);

      const allowed: Record<string, string[]> = {
        new: ["confirmed", "packing", "cancelled"],
        confirmed: ["packing", "cancelled"],
        packing: ["packed", "cancelled"],
        packed: ["dispatched", "cancelled"],
        dispatched: ["delivered"],
        delivered: [],
        cancelled: [],
        returned: [],
      };
      if (!allowed[current.status]?.includes(status))
        throw new Error(
          `Cannot move an order from ${current.status} to ${status}`,
        );

      const isDepositApproved =
        current.paymentStatus === "verified" ||
        ["deposit_verified", "cod_collected", "fully_paid"].includes(
          current.customerPaymentStatus || "",
        );

      if (
        ["packing", "packed", "dispatched", "delivered"].includes(status) &&
        !isDepositApproved
      )
        throw new Error("Verify the required deposit before fulfilling this order");

      if (status === "packing" && !current.deliveryFeeConfirmed)
        throw new Error("Delivery fee must be confirmed before packing");

      if (status === "packed" || status === "dispatched") {
        const fulfillmentItems = await tx
          .select({
            category: products.category,
            deviceUnitId: orderItems.deviceUnitId,
          })
          .from(orderItems)
          .innerJoin(products, eq(products.id, orderItems.productId))
          .where(eq(orderItems.orderId, orderId));
        const digitalOnly =
          fulfillmentItems.length > 0 &&
          fulfillmentItems.every((item) => item.category === "PUBG Accounts");
        if (status === "dispatched" && !digitalOnly && !current.trackingNumber)
          throw new Error(
            "Physical orders must have courier tracking before dispatch",
          );
      }
      if (status === "cancelled") {
        const items = await tx
          .select({
            variantId: orderItems.variantId,
            quantity: orderItems.quantity,
            category: products.category,
            deviceUnitId: orderItems.deviceUnitId,
          })
          .from(orderItems)
          .innerJoin(products, eq(products.id, orderItems.productId))
          .where(eq(orderItems.orderId, orderId));
        for (const item of items) {
          if (item.category === "PUBG Accounts") {
            await tx.update(productVariants).set({ listingStatus: "available" })
              .where(and(eq(productVariants.id, item.variantId), eq(productVariants.listingStatus, "reserved")));
            continue;
          }
          await tx
            .update(productVariants)
            .set({
              stockQuantity: sql`${productVariants.stockQuantity}+${item.quantity}`,
            })
            .where(eq(productVariants.id, item.variantId));
          if (item.deviceUnitId)
            await tx
              .update(deviceUnits)
              .set({ status: "in_stock" })
              .where(
                and(
                  eq(deviceUnits.id, item.deviceUnitId),
                  eq(deviceUnits.status, "reserved"),
                ),
              );
        }
      }
      if (status === "delivered") {
        const digitalItems = await tx.select({ variantId: orderItems.variantId }).from(orderItems)
          .innerJoin(products, eq(products.id, orderItems.productId))
          .where(and(eq(orderItems.orderId, orderId), eq(products.category, "PUBG Accounts")));
        for (const item of digitalItems)
          await tx.update(productVariants).set({ listingStatus: "sold" }).where(eq(productVariants.id, item.variantId));
        const assigned = await tx
          .select({ deviceUnitId: orderItems.deviceUnitId })
          .from(orderItems)
          .where(eq(orderItems.orderId, orderId));
        for (const item of assigned)
          if (item.deviceUnitId)
            await tx
              .update(deviceUnits)
              .set({ status: "sold", soldAt: new Date() })
              .where(
                and(
                  eq(deviceUnits.id, item.deviceUnitId),
                  eq(deviceUnits.status, "reserved"),
                ),
              );
      }
      const [changed] = await tx
        .update(orders)
        .set({
          fulfillmentStatus: status,
          ...(status === "dispatched" ? { commercialFrozen: true } : {}),
          ...(status === "delivered" && !current.deliveredAt
            ? { deliveredAt: new Date() }
            : {}),
        })
        .where(eq(orders.id, orderId))
        .returning({ code: orders.orderCode });
      return changed;
    });

    if (!updated) return { ok: false, error: "Order not found" };

    await audit(
      `order.${status}`,
      updated.code,
      `Fulfillment changed to ${status}`,
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorOf(error) };
  }
}

export async function addShipment(
  orderId: string,
  input: { trackingNumber: string; carrier: string },
): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };

    const parsed = shipmentSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message || "Invalid shipment",
      };
    }

    const updated = await db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          code: orders.orderCode,
          paymentStatus: orders.paymentStatus,
          fulfillmentStatus: orders.fulfillmentStatus,
        })
        .from(orders)
        .where(eq(orders.id, orderId))
        .for("update");
      if (!current) throw new Error("Order not found");
      if (current.paymentStatus !== "verified")
        throw new Error("Approve the payment before dispatch");
      if (!["packed", "dispatched"].includes(current.fulfillmentStatus))
        throw new Error("Mark the order as packed before dispatch");
      const shipmentItems = await tx
        .select({ category: products.category })
        .from(orderItems)
        .innerJoin(products, eq(products.id, orderItems.productId))
        .where(eq(orderItems.orderId, orderId));
      if (
        shipmentItems.length > 0 &&
        shipmentItems.every((item) => item.category === "PUBG Accounts")
      )
        throw new Error(
          "Digital orders use secure handover, not courier dispatch",
        );

      const [changed] = await tx
        .update(orders)
        .set({
          trackingNumber: parsed.data.trackingNumber,
          shippingCarrier: parsed.data.carrier,
          fulfillmentStatus: "dispatched",
          commercialFrozen: true,
        })
        .where(eq(orders.id, orderId))
        .returning({
          code: orders.orderCode,
          telegramUserId: orders.telegramUserId,
          customerId: orders.customerId,
        });
      return changed;
    });

    if (!updated) return { ok: false, error: "Order not found" };

    await audit(
      "order.dispatched",
      updated.code,
      `${parsed.data.carrier}: ${parsed.data.trackingNumber}`,
    );

    // Send dispatch notification to customer on Telegram with estimated delivery (10-15 days)
    let tgId = updated.telegramUserId;
    if (!tgId && updated.customerId) {
      const [cust] = await db
        .select({ telegramUserId: customers.telegramUserId })
        .from(customers)
        .where(eq(customers.id, updated.customerId))
        .limit(1);
      tgId = cust?.telegramUserId || null;
    }

    if (tgId) {
      try {
        const text = `🚚 <b>လူကြီးမင်း၏ အော်ဒါကို ပို့ဆောင်ပေးလိုက်ပါပြီခင်ဗျာ</b>\n\nOrder Code: <code>${updated.code}</code>\nပို့ဆောင်သည့် လုပ်ငန်း: <b>${parsed.data.carrier}</b>\nTracking Number: <code>${parsed.data.trackingNumber}</code>\n\n📦 <b>၁၀ ရက် မှ ၁၅ ရက်အတွင်း</b> လူကြီးမင်းထံသို့ အရောက်ပို့ဆောင်ပေးပါမည်ခင်ဗျာ။\n<i>(10–15 days atwin yout pr mal)</i>\n\nအော်ဒါနှင့် ပတ်သက်၍ အကူအညီလိုအပ်ပါက /support သို့ ဆက်သွယ်နိုင်ပါသည်ခင်ဗျာ။ MH OP ကို အားပေးမှုအတွက် ကျေးဇူးတင်ရှိပါသည်! 🙏`;
        await sendTelegramMessage(tgId, text, { parse_mode: "HTML" });
      } catch (tgErr) {
        console.error("[Telegram Customer Dispatch Notification Error]", tgErr);
      }
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorOf(error) };
  }
}

/**
 * Admin order creation across multi-channels (Facebook, Messenger, TikTok, Viber, Phone, Walk-in, etc.)
 */
export async function adminCreateOrder(
  input: z.infer<typeof adminCreateOrderSchema>,
  actor: string = "admin",
): Promise<ActionResult<{ orderId: string; orderCode: string }>> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };
    const parsed = adminCreateOrderSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message || "Invalid order input" };
    }

    const orderCode = `MHOP-${new Date()
      .toISOString()
      .slice(2, 10)
      .replaceAll("-", "")}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

    const result = await db.transaction(async (tx) => {
      const skus = [...new Set(parsed.data.items.map((i) => i.sku))];
      const variants = await tx
        .select({
          id: productVariants.id,
          sku: productVariants.sku,
          price: productVariants.price,
          cost: productVariants.costPrice,
          stock: productVariants.stockQuantity,
          listingStatus: productVariants.listingStatus,
          category: products.category,
          productId: products.id,
          productName: products.name,
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(
          and(
            inArray(productVariants.sku, skus),
            eq(products.isActive, true),
            eq(productVariants.isActive, true),
          ),
        )
        .for("update");

      if (variants.length !== skus.length) {
        throw new Error("One or more selected products are unavailable");
      }

      const variantMap = new Map(variants.map((v) => [v.sku, v]));
      let subtotal = 0;
      const isDigitalOnly = variants.every((v) => v.category === "PUBG Accounts");

      for (const item of parsed.data.items) {
        const variant = variantMap.get(item.sku)!;
        if (!canPurchaseListing(variant, item.quantity)) {
          throw new Error(`${item.sku} is unavailable for quantity ${item.quantity}`);
        }
        const itemPrice = item.agreedPrice != null ? item.agreedPrice : num(variant.price);
        subtotal += itemPrice * item.quantity;
      }

      const royalDelivery = calculateRoyalDelivery({
        destinationCity: parsed.data.destinationCity,
        weightKg: parsed.data.packedWeightKg,
        isDigitalOnly,
        customNormalPrice: parsed.data.customDeliveryFee,
        customCourierCost: parsed.data.customCourierCost,
      });

      // Check customer loyalty tier for automatic perks
      const cleanAdminPhone = (parsed.data.phone || "").trim().replace(/[^\d+]/g, "");
      const rawAdminTag = (parsed.data.telegramUsername || "").trim().replace(/^@/, "");
      const adminLoyaltyConds = [];
      if (cleanAdminPhone) {
        adminLoyaltyConds.push(eq(customers.phone, cleanAdminPhone));
        adminLoyaltyConds.push(eq(customers.secondaryPhone, cleanAdminPhone));
      }
      if (parsed.data.telegramUserId) adminLoyaltyConds.push(eq(customers.telegramUserId, parsed.data.telegramUserId));
      if (rawAdminTag) {
        adminLoyaltyConds.push(eq(customers.telegramUsername, rawAdminTag));
        adminLoyaltyConds.push(eq(customers.telegramUsername, `@${rawAdminTag}`));
      }

      const matchingAdminCustomers = adminLoyaltyConds.length
        ? await tx
            .select()
            .from(customers)
            .where(and(eq(customers.isActive, true), or(...adminLoyaltyConds)))
            .orderBy(desc(customers.points))
        : [];

      const existingAdminCustomer = matchingAdminCustomers[0] || null;
      let adminPoints = existingAdminCustomer?.points || 0;

      if (matchingAdminCustomers.length > 1) {
        for (const dup of matchingAdminCustomers.slice(1)) {
          adminPoints += (dup.points || 0);
          await tx
            .update(orders)
            .set({ customerId: existingAdminCustomer.id })
            .where(eq(orders.customerId, dup.id));
          await tx
            .update(customers)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(customers.id, dup.id));
        }
      }

      const customerTier = existingAdminCustomer
        ? getTierForPoints(adminPoints)
        : "member";

      const standardDelivery = royalDelivery.customerDeliveryFee;
      const shippingFee =
        parsed.data.customDeliveryFee != null
          ? parsed.data.customDeliveryFee
          : isDigitalOnly
            ? 0
            : customerTier !== "member"
              ? 0
              : standardDelivery;

      const tierDeliveryDiscount =
        !isDigitalOnly && customerTier !== "member" && parsed.data.customDeliveryFee == null
          ? standardDelivery
          : 0;

      let tierDiscountAmount = 0;
      if (customerTier === "gold") {
        tierDiscountAmount = Math.round(subtotal * 0.05);
      } else if (customerTier === "platinum") {
        tierDiscountAmount = Math.round(subtotal * 0.10);
      }

      const courierCost =
        parsed.data.customCourierCost != null
          ? parsed.data.customCourierCost
          : royalDelivery.expectedCourierCost;

      const total = Math.max(0, subtotal - tierDiscountAmount) + shippingFee;
      const pointsEarned = calculatePointsFromAmount(total);
      const requiredDeposit =
        parsed.data.requiredDeposit != null
          ? Math.min(total, parsed.data.requiredDeposit)
          : calculateRequiredDeposit(total, isDigitalOnly);
      const codAmount = Math.max(0, total - requiredDeposit);

      let resolvedAdminCustomerId: string;

      if (existingAdminCustomer) {
        let primaryPhone = existingAdminCustomer.phone;
        let secondaryPhone = existingAdminCustomer.secondaryPhone;

        if (primaryPhone.startsWith("TG-") && cleanAdminPhone) {
          primaryPhone = cleanAdminPhone;
        } else if (cleanAdminPhone && cleanAdminPhone !== primaryPhone) {
          secondaryPhone = cleanAdminPhone;
        }

        await tx
          .update(customers)
          .set({
            name: parsed.data.customerName || existingAdminCustomer.name,
            phone: primaryPhone,
            secondaryPhone: secondaryPhone || null,
            telegramUserId: parsed.data.telegramUserId || existingAdminCustomer.telegramUserId,
            telegramUsername: rawAdminTag || existingAdminCustomer.telegramUsername,
            points: adminPoints,
            tier: customerTier,
            ...(!isDigitalOnly && parsed.data.shippingAddress
              ? { primaryAddress: parsed.data.shippingAddress }
              : {}),
            updatedAt: new Date(),
          })
          .where(eq(customers.id, existingAdminCustomer.id));

        resolvedAdminCustomerId = existingAdminCustomer.id;
      } else {
        const [customerProfile] = await tx
          .insert(customers)
          .values({
            customerCode: generateCustomerCode(),
            name: parsed.data.customerName,
            phone: parsed.data.phone,
            telegramUserId: parsed.data.telegramUserId || null,
            telegramUsername: rawAdminTag || null,
            primaryAddress: isDigitalOnly ? null : parsed.data.shippingAddress || null,
            points: 0,
            tier: "member",
            isActive: true,
          })
          .onConflictDoUpdate({
            target: customers.phone,
            set: {
              name: parsed.data.customerName,
              ...(parsed.data.telegramUserId ? { telegramUserId: parsed.data.telegramUserId } : {}),
              ...(rawAdminTag ? { telegramUsername: rawAdminTag } : {}),
              ...(!isDigitalOnly && parsed.data.shippingAddress
                ? { primaryAddress: parsed.data.shippingAddress }
                : {}),
              isActive: true,
              updatedAt: new Date(),
            },
          })
          .returning({ id: customers.id });

        if (!customerProfile) throw new Error("Customer profile could not be saved");
        resolvedAdminCustomerId = customerProfile.id;
      }

      const [created] = await tx
        .insert(orders)
        .values({
          customerId: resolvedAdminCustomerId,
          customerName: parsed.data.customerName,
          phone: parsed.data.phone,
          telegramUserId: parsed.data.telegramUserId || null,
          orderSource: parsed.data.orderSource,
          orderCode,
          destinationCity: royalDelivery.destinationCity,
          destinationState: royalDelivery.destinationState,
          streetAddress: parsed.data.shippingAddress,
          shippingAddress: parsed.data.shippingAddress,
          shippingZone: royalDelivery.zone,
          shippingFee: String(shippingFee),
          shippingCarrier: isDigitalOnly ? "Digital handover" : clientConfig.shipping.courier,
          paymentMethod: parsed.data.paymentMethod,
          totalAmount: String(total),
          isDigitalOnly,
          packedWeightKg: String(royalDelivery.weightKg),
          expectedCourierCost: String(courierCost),
          requiredDeposit: String(requiredDeposit),
          customerPaidAmount: "0",
          customerBalance: String(total),
          codAmount: String(codAmount),
          customerPaymentStatus: "unpaid",
          courierSettlementStatus: isDigitalOnly ? "not_applicable" : "unsettled",
          deliveryFeeConfirmed: true,
          commercialFrozen: false,
          internalNotes: parsed.data.internalNotes || null,
          customerTier,
          tierDiscountAmount: String(tierDiscountAmount),
          tierDeliveryDiscount: String(tierDeliveryDiscount),
          pointsEarned,
        })
        .returning({ id: orders.id });

      for (const item of parsed.data.items) {
        const variant = variantMap.get(item.sku)!;
        const unitPrice = item.agreedPrice != null ? item.agreedPrice : num(variant.price);
        for (let i = 0; i < item.quantity; i++) {
          await tx.insert(orderItems).values({
            orderId: created.id,
            productId: variant.productId,
            variantId: variant.id,
            unitPrice: String(unitPrice),
            costSnapshot: variant.cost,
            quantity: 1,
          });
        }

        if (variant.category === "PUBG Accounts") {
          const [reserved] = await tx
            .update(productVariants)
            .set({ listingStatus: "reserved" })
            .where(
              and(
                eq(productVariants.id, variant.id),
                eq(productVariants.listingStatus, "available"),
              ),
            )
            .returning({ id: productVariants.id });
          if (!reserved) throw new Error(`${variant.sku} is already reserved`);
        } else {
          const [updated] = await tx
            .update(productVariants)
            .set({
              stockQuantity: sql`${productVariants.stockQuantity} - ${item.quantity}`,
            })
            .where(
              and(
                eq(productVariants.id, variant.id),
                sql`${productVariants.stockQuantity} >= ${item.quantity}`,
              ),
            )
            .returning({ id: productVariants.id });
          if (!updated) throw new Error(`${variant.sku} went out of stock`);
        }
      }

      await tx.insert(staffAlerts).values({
        type: "order.created",
        title: `Admin order ${orderCode} (${parsed.data.orderSource.toUpperCase()})`,
        body: `${parsed.data.customerName} placed order for ${total} MMK via ${parsed.data.orderSource}`,
        targetCode: orderCode,
      });

      return { orderId: created.id, orderCode };
    });

    await audit(
      "order.created",
      result.orderCode,
      `Order created via ${parsed.data.orderSource} by ${actor}. Customer: ${parsed.data.customerName}`,
      actor,
    );

    return { ok: true, data: result };
  } catch (error) {
    console.error("[adminCreateOrder error]", error);
    return { ok: false, error: errorOf(error) };
  }
}

/**
 * Fetch full order details by ID for dedicated order console (/orders/[id]).
 */
export async function getOrderById(orderId: string) {
  if (!db || !orderId) return null;

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return null;

  const [customer] = order.customerId
    ? await db.select().from(customers).where(eq(customers.id, order.customerId))
    : [null];

  const items = await db
    .select({
      id: orderItems.id,
      productId: orderItems.productId,
      variantId: orderItems.variantId,
      name: products.name,
      category: products.category,
      sku: productVariants.sku,
      unitPrice: orderItems.unitPrice,
      costSnapshot: orderItems.costSnapshot,
      quantity: orderItems.quantity,
      serial: deviceUnits.serialNumber,
      imei: deviceUnits.imeiNumber,
      warrantyMonths: productVariants.warrantyMonths,
    })
    .from(orderItems)
    .innerJoin(products, eq(products.id, orderItems.productId))
    .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .leftJoin(deviceUnits, eq(deviceUnits.id, orderItems.deviceUnitId))
    .where(eq(orderItems.orderId, orderId));

  const payments = await db
    .select()
    .from(orderPayments)
    .where(eq(orderPayments.orderId, orderId))
    .orderBy(desc(orderPayments.createdAt));

  const allocations = await db
    .select({
      id: courierSettlementAllocations.id,
      settlementBatchId: courierSettlementAllocations.settlementBatchId,
      batchCode: courierSettlementBatches.batchCode,
      settlementDate: courierSettlementBatches.settlementDate,
      allocatedCollected: courierSettlementAllocations.allocatedCollected,
      allocatedCourierFee: courierSettlementAllocations.allocatedCourierFee,
      netOrderPayout: courierSettlementAllocations.netOrderPayout,
    })
    .from(courierSettlementAllocations)
    .innerJoin(
      courierSettlementBatches,
      eq(courierSettlementBatches.id, courierSettlementAllocations.settlementBatchId),
    )
    .where(eq(courierSettlementAllocations.orderId, orderId));

  const totalAmount = num(order.totalAmount);
  const customerPaidAmount = num(order.customerPaidAmount);
  const requiredDeposit =
    num(order.requiredDeposit) ||
    (totalAmount > 0 ? (order.isDigitalOnly ? totalAmount : Math.min(10000, totalAmount)) : 0);

  const customerBalance =
    order.customerBalance != null && num(order.customerBalance) > 0
      ? num(order.customerBalance)
      : (customerPaidAmount >= totalAmount ? 0 : Math.max(0, totalAmount - customerPaidAmount));

  const codAmount =
    order.codAmount != null && num(order.codAmount) > 0
      ? num(order.codAmount)
      : (!order.isDigitalOnly && totalAmount > customerPaidAmount
          ? Math.max(0, totalAmount - Math.max(customerPaidAmount, requiredDeposit))
          : 0);

  const expectedCourierCost =
    order.expectedCourierCost != null && num(order.expectedCourierCost) > 0
      ? num(order.expectedCourierCost)
      : (!order.isDigitalOnly ? 4050 : 0);

  return {
    ...order,
    totalAmount,
    shippingFee: num(order.shippingFee),
    expectedCourierCost,
    actualCourierCost: order.actualCourierCost != null ? num(order.actualCourierCost) : null,
    requiredDeposit,
    customerPaidAmount,
    customerBalance,
    codAmount,
    packedWeightKg: num(order.packedWeightKg),
    returnCost: num(order.returnCost),
    customer,
    items: items.map((i) => ({
      ...i,
      unitPrice: num(i.unitPrice),
      costSnapshot: num(i.costSnapshot),
      quantity: Number(i.quantity),
      warrantyMonths: Number(i.warrantyMonths),
    })),
    payments: payments.map((p) => ({
      ...p,
      amount: num(p.amount),
    })),
    allocations: allocations.map((a) => ({
      ...a,
      allocatedCollected: num(a.allocatedCollected),
      allocatedCourierFee: num(a.allocatedCourierFee),
      netOrderPayout: num(a.netOrderPayout),
    })),
  };
}

/**
 * Pre-dispatch order modifications: change items, address, delivery fee, required deposit.
 * Transactionally adjusts stock reservations and recomputes balances.
 * Flags overpayment if paid amount exceeds new total.
 */
export async function preDispatchEditOrder(
  orderId: string,
  input: z.infer<typeof orderPreDispatchEditSchema>,
  actor: string = "admin",
): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };
    const parsed = orderPreDispatchEditSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message || "Invalid input" };
    }

    const result = await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .for("update");

      if (!order) throw new Error("Order not found");
      if (order.commercialFrozen) {
        throw new Error(
          "Commercial terms are locked after dispatch. Use post-dispatch corrections instead.",
        );
      }
      if (
        ["dispatched", "delivered", "cancelled", "returned"].includes(
          order.fulfillmentStatus,
        )
      ) {
        throw new Error(
          `Cannot edit commercial terms when order is ${order.fulfillmentStatus}`,
        );
      }

      // 1. Fetch current order items to compute stock deltas
      const currentItems = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));

      const oldVariantIds = [...new Set(currentItems.map((ci) => ci.variantId))];
      const currentVariants = oldVariantIds.length
        ? await tx
            .select({ id: productVariants.id, sku: productVariants.sku })
            .from(productVariants)
            .where(inArray(productVariants.id, oldVariantIds))
        : [];
      const variantIdToSku = new Map(currentVariants.map((v) => [v.id, v.sku]));

      const oldQtyBySku = new Map<string, number>();
      for (const ci of currentItems) {
        const sku = variantIdToSku.get(ci.variantId);
        if (sku) {
          oldQtyBySku.set(sku, (oldQtyBySku.get(sku) || 0) + Number(ci.quantity));
        }
      }

      const newQtyBySku = new Map<string, { qty: number; unitPrice: number }>();
      for (const ni of parsed.data.items) {
        const existing = newQtyBySku.get(ni.sku) || {
          qty: 0,
          unitPrice: ni.unitPrice,
        };
        newQtyBySku.set(ni.sku, {
          qty: existing.qty + ni.quantity,
          unitPrice: ni.unitPrice,
        });
      }

      const allSkus = [...new Set([...oldQtyBySku.keys(), ...newQtyBySku.keys()])];
      const variants = await tx
        .select({
          id: productVariants.id,
          sku: productVariants.sku,
          price: productVariants.price,
          cost: productVariants.costPrice,
          stock: productVariants.stockQuantity,
          category: products.category,
          productId: products.id,
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(inArray(productVariants.sku, allSkus))
        .for("update");

      const variantMap = new Map(variants.map((v) => [v.sku, v]));

      // Check stock deltas
      for (const sku of allSkus) {
        const oldQty = oldQtyBySku.get(sku) || 0;
        const newQty = newQtyBySku.get(sku)?.qty || 0;
        const delta = newQty - oldQty;
        const variant = variantMap.get(sku);
        if (!variant) throw new Error(`Product ${sku} not found`);

        if (delta > 0) {
          if (variant.category !== "PUBG Accounts" && variant.stock < delta) {
            throw new Error(
              `Insufficient stock for ${sku}. Available: ${variant.stock}, needed: ${delta}`,
            );
          }
          if (variant.category !== "PUBG Accounts") {
            await tx
              .update(productVariants)
              .set({
                stockQuantity: sql`${productVariants.stockQuantity} - ${delta}`,
              })
              .where(eq(productVariants.id, variant.id));
          }
        } else if (delta < 0) {
          const returnQty = Math.abs(delta);
          if (variant.category !== "PUBG Accounts") {
            await tx
              .update(productVariants)
              .set({
                stockQuantity: sql`${productVariants.stockQuantity} + ${returnQty}`,
              })
              .where(eq(productVariants.id, variant.id));
          }
        }
      }

      // Delete old items and insert new ones
      await tx.delete(orderItems).where(eq(orderItems.orderId, orderId));

      let newSubtotal = 0;
      const isDigitalOnly = parsed.data.items.every((item) => {
        const v = variantMap.get(item.sku);
        return v?.category === "PUBG Accounts";
      });

      for (const item of parsed.data.items) {
        const variant = variantMap.get(item.sku)!;
        newSubtotal += item.unitPrice * item.quantity;
        for (let i = 0; i < item.quantity; i++) {
          await tx.insert(orderItems).values({
            orderId,
            productId: variant.productId,
            variantId: variant.id,
            unitPrice: String(item.unitPrice),
            costSnapshot: variant.cost,
            quantity: 1,
          });
        }
      }

      const deliveryFee = parsed.data.deliveryFee;
      const newTotal = newSubtotal + deliveryFee;
      const requiredDeposit = Math.min(newTotal, parsed.data.requiredDeposit);
      const codAmount = Math.max(0, newTotal - requiredDeposit);

      const royalDelivery = calculateRoyalDelivery({
        destinationCity: parsed.data.destinationCity,
        weightKg: parsed.data.packedWeightKg,
        isDigitalOnly,
      });

      await tx
        .update(orders)
        .set({
          customerName: parsed.data.customerName,
          phone: parsed.data.phone,
          shippingAddress: parsed.data.shippingAddress,
          streetAddress: parsed.data.shippingAddress,
          destinationCity: royalDelivery.destinationCity,
          destinationState: royalDelivery.destinationState,
          shippingZone: royalDelivery.zone,
          packedWeightKg: String(parsed.data.packedWeightKg),
          shippingFee: String(deliveryFee),
          expectedCourierCost: String(royalDelivery.expectedCourierCost),
          totalAmount: String(newTotal),
          requiredDeposit: String(requiredDeposit),
          codAmount: String(codAmount),
          deliveryFeeConfirmed: true,
          internalNotes: parsed.data.internalNotes || order.internalNotes,
        })
        .where(eq(orders.id, orderId));

      const paymentRecalc = await recalculateOrderPayments(tx, orderId);

      if (paymentRecalc.customerPaymentStatus === "overpaid") {
        await tx.insert(staffAlerts).values({
          type: "order.overpaid",
          title: `Overpayment detected • ${order.orderCode}`,
          body: `Order edited. Customer paid ${paymentRecalc.paidAmount} MMK, but new total is ${newTotal} MMK. Process refund for difference.`,
          targetCode: order.orderCode,
        });
      }

      return {
        orderCode: order.orderCode,
        newTotal,
        paymentRecalc,
      };
    });

    await audit(
      "order.pre_dispatch_edit",
      result.orderCode,
      `Pre-dispatch order modified by ${actor}. New total: ${result.newTotal} MMK. Status: ${result.paymentRecalc.customerPaymentStatus}.`,
      actor,
    );

    return { ok: true };
  } catch (error) {
    console.error("[preDispatchEditOrder error]", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to edit order",
    };
  }
}

/**
 * Post-dispatch operational correction. Freezes commercial terms and allows only
 * tracking number, courier, shipping address notes, or internal notes.
 */
export async function postDispatchCorrection(
  orderId: string,
  input: z.infer<typeof postDispatchCorrectionSchema>,
  actor: string = "admin",
): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };
    const parsed = postDispatchCorrectionSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message || "Invalid input" };
    }

    const result = await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .for("update");

      if (!order) throw new Error("Order not found");

      const updates: Partial<typeof orders.$inferInsert> = {};
      if (parsed.data.trackingNumber) updates.trackingNumber = parsed.data.trackingNumber;
      if (parsed.data.shippingCarrier) updates.shippingCarrier = parsed.data.shippingCarrier;
      if (parsed.data.shippingAddress) {
        updates.shippingAddress = parsed.data.shippingAddress;
        updates.streetAddress = parsed.data.shippingAddress;
      }
      if (parsed.data.phone) updates.phone = parsed.data.phone;

      const appendNote = `[Correction by ${actor} on ${new Date().toISOString().slice(0, 10)}: ${parsed.data.reason}]`;
      updates.internalNotes = order.internalNotes
        ? `${order.internalNotes}\n${appendNote}`
        : appendNote;

      await tx.update(orders).set(updates).where(eq(orders.id, orderId));
      return { orderCode: order.orderCode };
    });

    await audit(
      "order.post_dispatch_correction",
      result.orderCode,
      `Post-dispatch update: ${parsed.data.reason}`,
      actor,
    );

    return { ok: true };
  } catch (error) {
    console.error("[postDispatchCorrection error]", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to update order",
    };
  }
}

/**
 * Record a failed delivery / customer return.
 * Sets fulfillment to 'returned', stores return cost & reason,
 * handles stock disposition (return to inventory or write-off),
 * and handles deposit retention vs refund reversal.
 */
export async function recordFailedDelivery(
  orderId: string,
  input: z.infer<typeof failedDeliverySchema>,
  actor: string = "admin",
): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };
    const parsed = failedDeliverySchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message || "Invalid input" };
    }

    const result = await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .for("update");

      if (!order) throw new Error("Order not found");
      if (!["dispatched", "delivered"].includes(order.fulfillmentStatus)) {
        throw new Error(
          "Failed delivery can only be recorded for dispatched or delivered orders",
        );
      }

      const now = new Date();

      if (parsed.data.stockDisposition === "return_to_stock") {
        const items = await tx
          .select({
            variantId: orderItems.variantId,
            quantity: orderItems.quantity,
            deviceUnitId: orderItems.deviceUnitId,
            category: products.category,
          })
          .from(orderItems)
          .innerJoin(products, eq(products.id, orderItems.productId))
          .where(eq(orderItems.orderId, orderId));

        for (const item of items) {
          if (item.category === "PUBG Accounts") {
            await tx
              .update(productVariants)
              .set({ listingStatus: "available" })
              .where(eq(productVariants.id, item.variantId));
          } else {
            await tx
              .update(productVariants)
              .set({
                stockQuantity: sql`${productVariants.stockQuantity} + ${item.quantity}`,
              })
              .where(eq(productVariants.id, item.variantId));
          }
          if (item.deviceUnitId) {
            await tx
              .update(deviceUnits)
              .set({ status: "in_stock" })
              .where(eq(deviceUnits.id, item.deviceUnitId));
          }
        }
      }

      if (
        (parsed.data.depositDisposition === "refund_fully" ||
          parsed.data.depositDisposition === "partial_refund") &&
        num(order.customerPaidAmount) > 0
      ) {
        const refundAmt =
          parsed.data.depositDisposition === "refund_fully"
            ? num(order.customerPaidAmount)
            : parsed.data.refundAmount;

        if (refundAmt > 0) {
          await tx.insert(orderPayments).values({
            orderId,
            paymentType: "refund_reversal",
            amount: String(-refundAmt),
            paymentMethod: "refund",
            status: "verified",
            recordedBy: actor,
            verifiedBy: actor,
            verifiedAt: now,
            notes: `Failed delivery refund. Reason: ${parsed.data.reason}`,
            createdAt: now,
          });
          await recalculateOrderPayments(tx, orderId);
        }
      }

      await tx
        .update(orders)
        .set({
          fulfillmentStatus: "returned",
          returnCost: String(parsed.data.returnCost),
          returnReason: parsed.data.reason,
          failedDeliveryAt: now,
          courierSettlementStatus: "unsettled",
        })
        .where(eq(orders.id, orderId));

      await tx.insert(staffAlerts).values({
        type: "order.returned",
        title: `Delivery failed / returned • ${order.orderCode}`,
        body: `Order returned. Courier return fee: ${parsed.data.returnCost} MMK. Stock: ${parsed.data.stockDisposition}. Reason: ${parsed.data.reason}`,
        targetCode: order.orderCode,
      });

      return { orderCode: order.orderCode };
    });

    await audit(
      "order.failed_delivery",
      result.orderCode,
      `Failed delivery recorded: ${parsed.data.reason}. Return cost: ${parsed.data.returnCost} MMK.`,
      actor,
    );

    return { ok: true };
  } catch (error) {
    console.error("[recordFailedDelivery error]", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to record failed delivery",
    };
  }
}

export const updateFulfillmentAction = updateFulfillment;
