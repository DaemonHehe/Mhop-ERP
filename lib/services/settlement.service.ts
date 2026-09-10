import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  courierSettlementAllocations,
  courierSettlementBatches,
  orders,
  staffAlerts,
} from "@/db/schema";
import { audit } from "./audit.service";
import type { ActionResult } from "./stock.service";

export interface SettlementAllocationInput {
  orderId: string;
  allocatedCollected: number;
  allocatedCourierFee: number;
}

export interface CreateSettlementBatchInput {
  batchCode?: string;
  courierName?: string;
  bankAccount: string;
  transferReference: string;
  settlementDate: Date | string;
  bankReceivedAmount: number;
  otherFees?: number;
  notes?: string;
  recordedBy: string;
  allocations: SettlementAllocationInput[];
}

export interface SettlementBatchItem {
  id: string;
  batchCode: string;
  courierName: string;
  bankAccount: string;
  transferReference: string;
  settlementDate: Date;
  totalCollected: number;
  totalCourierFees: number;
  otherFees: number;
  bankReceivedAmount: number;
  status: string;
  discrepancyAmount: number;
  recordedBy: string;
  notes: string | null;
  createdAt: Date;
  orderCount?: number;
}

export interface UnsettledOrderItem {
  id: string;
  orderCode: string;
  customerName: string;
  phone: string;
  destinationCity: string | null;
  destinationState: string | null;
  trackingNumber: string | null;
  fulfillmentStatus: string;
  customerPaymentStatus: string;
  courierSettlementStatus: string;
  codAmount: number;
  expectedCourierCost: number;
  totalAmount: number;
  createdAt: Date;
}

const num = (val: string | number | null | undefined): number => Number(val) || 0;

/**
 * Fetch all unsettled orders with pending Royal Express COD collection or transfer.
 */
export async function getUnsettledOrders(): Promise<UnsettledOrderItem[]> {
  if (!db) return [];

  const rows = await db
    .select({
      id: orders.id,
      orderCode: orders.orderCode,
      customerName: orders.customerName,
      phone: orders.phone,
      destinationCity: orders.destinationCity,
      destinationState: orders.destinationState,
      trackingNumber: orders.trackingNumber,
      fulfillmentStatus: orders.fulfillmentStatus,
      customerPaymentStatus: orders.customerPaymentStatus,
      courierSettlementStatus: orders.courierSettlementStatus,
      codAmount: orders.codAmount,
      expectedCourierCost: orders.expectedCourierCost,
      totalAmount: orders.totalAmount,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(
      and(
        inArray(orders.courierSettlementStatus, [
          "unsettled",
          "allocated_partial",
          "discrepancy",
        ]),
        sql`${orders.codAmount} > 0`,
        sql`${orders.fulfillmentStatus} not in ('cancelled', 'returned')`,
      ),
    )
    .orderBy(desc(orders.createdAt));

  return rows.map((r) => ({
    id: r.id,
    orderCode: r.orderCode,
    customerName: r.customerName,
    phone: r.phone,
    destinationCity: r.destinationCity,
    destinationState: r.destinationState,
    trackingNumber: r.trackingNumber,
    fulfillmentStatus: r.fulfillmentStatus,
    customerPaymentStatus: r.customerPaymentStatus,
    courierSettlementStatus: r.courierSettlementStatus,
    codAmount: num(r.codAmount),
    expectedCourierCost: num(r.expectedCourierCost),
    totalAmount: num(r.totalAmount),
    createdAt: r.createdAt,
  }));
}

/**
 * Record a Royal Express settlement payout batch with multi-order allocations.
 */
export async function createSettlementBatch(
  input: CreateSettlementBatchInput,
): Promise<ActionResult<{ batchId: string; batchCode: string }>> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };

    if (!input.bankAccount?.trim()) {
      return { ok: false, error: "Bank account is required." };
    }
    if (!input.transferReference?.trim()) {
      return { ok: false, error: "Transfer reference is required." };
    }
    if (!input.allocations?.length) {
      return { ok: false, error: "At least one order allocation is required." };
    }
    if (input.bankReceivedAmount < 0) {
      return { ok: false, error: "Bank received amount cannot be negative." };
    }

    const batchCode =
      input.batchCode?.trim() ||
      `ROYAL-SETTLE-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

    const settlementDate = new Date(input.settlementDate);
    const otherFees = num(input.otherFees);
    const courierName = input.courierName?.trim() || "Royal Express";

    const result = await db.transaction(async (tx) => {
      // 1. Validate and fetch all targeted orders
      const orderIds = input.allocations.map((a) => a.orderId);
      const targetOrders = await tx
        .select()
        .from(orders)
        .where(inArray(orders.id, orderIds))
        .for("update");

      const orderMap = new Map(targetOrders.map((o) => [o.id, o]));
      if (orderMap.size !== orderIds.length) {
        throw new Error("One or more allocated orders were not found");
      }

      let totalCollected = 0;
      let totalCourierFees = 0;

      const preparedAllocations = input.allocations.map((alloc) => {
        const order = orderMap.get(alloc.orderId)!;
        if (order.fulfillmentStatus === "cancelled") {
          throw new Error(`Order ${order.orderCode} is cancelled and cannot be settled.`);
        }
        const expectedCod = num(order.codAmount);
        const expectedCourierFee = num(order.expectedCourierCost);
        const allocatedCollected = num(alloc.allocatedCollected);
        const allocatedCourierFee = num(alloc.allocatedCourierFee);
        const netOrderPayout = allocatedCollected - allocatedCourierFee;

        totalCollected += allocatedCollected;
        totalCourierFees += allocatedCourierFee;

        return {
          order,
          expectedCod,
          allocatedCollected,
          expectedCourierFee,
          allocatedCourierFee,
          netOrderPayout,
        };
      });

      const calculatedNetPayout = totalCollected - totalCourierFees - otherFees;
      const discrepancyAmount = input.bankReceivedAmount - calculatedNetPayout;
      const batchStatus = Math.abs(discrepancyAmount) < 0.01 ? "completed" : "discrepancy";

      // 2. Insert batch header
      const [batch] = await tx
        .insert(courierSettlementBatches)
        .values({
          batchCode,
          courierName,
          bankAccount: input.bankAccount.trim(),
          transferReference: input.transferReference.trim(),
          settlementDate,
          totalCollected: String(totalCollected),
          totalCourierFees: String(totalCourierFees),
          otherFees: String(otherFees),
          bankReceivedAmount: String(input.bankReceivedAmount),
          status: batchStatus,
          discrepancyAmount: String(discrepancyAmount),
          recordedBy: input.recordedBy,
          notes: input.notes || null,
        })
        .returning({ id: courierSettlementBatches.id });

      // 3. Insert allocations & update orders
      for (const item of preparedAllocations) {
        await tx.insert(courierSettlementAllocations).values({
          settlementBatchId: batch.id,
          orderId: item.order.id,
          expectedCod: String(item.expectedCod),
          allocatedCollected: String(item.allocatedCollected),
          expectedCourierFee: String(item.expectedCourierFee),
          allocatedCourierFee: String(item.allocatedCourierFee),
          netOrderPayout: String(item.netOrderPayout),
          allocatedBy: input.recordedBy,
        });

        // Determine new order settlement status
        let newCourierSettlementStatus: string;
        if (item.allocatedCollected >= item.expectedCod) {
          newCourierSettlementStatus = "settled";
        } else if (item.allocatedCollected > 0) {
          newCourierSettlementStatus = "allocated_partial";
        } else {
          newCourierSettlementStatus = "unsettled";
        }

        if (item.allocatedCourierFee !== item.expectedCourierFee && item.allocatedCourierFee > 0) {
          // If courier fee differs from expected, mark settled but note discrepancy if partial
          if (newCourierSettlementStatus === "allocated_partial") {
            newCourierSettlementStatus = "discrepancy";
          }
        }

        // Also ensure customer payment reflects COD collection if not already recorded
        const isCustomerPaid =
          item.order.customerPaymentStatus === "cod_collected" ||
          item.order.customerPaymentStatus === "fully_paid";

        await tx
          .update(orders)
          .set({
            actualCourierCost: String(item.allocatedCourierFee),
            courierSettlementStatus: newCourierSettlementStatus,
            commercialFrozen: true,
            ...(!isCustomerPaid && item.allocatedCollected > 0
              ? {
                  customerPaidAmount: sql`${orders.customerPaidAmount} + ${item.allocatedCollected}`,
                  customerBalance: "0",
                  customerPaymentStatus: "cod_collected",
                  paymentStatus: "verified" as const,
                  ...(item.order.fulfillmentStatus === "dispatched"
                    ? { fulfillmentStatus: "delivered" as const, deliveredAt: new Date() }
                    : {}),
                }
              : {}),
          })
          .where(eq(orders.id, item.order.id));
      }

      await tx.insert(staffAlerts).values({
        type: "settlement.recorded",
        title: `Royal settlement batch • ${batchCode}`,
        body: `${preparedAllocations.length} orders settled. Collected: ${totalCollected} MMK, Fees: ${totalCourierFees} MMK, Received: ${input.bankReceivedAmount} MMK. Status: ${batchStatus}.`,
        targetCode: batchCode,
      });

      return {
        batchId: batch.id,
        batchCode,
        totalCollected,
        totalCourierFees,
        bankReceivedAmount: input.bankReceivedAmount,
        discrepancyAmount,
        orderCount: preparedAllocations.length,
      };
    });

    await audit(
      "settlement.recorded",
      result.batchCode,
      `Settlement batch created with ${result.orderCount} orders. Bank received: ${result.bankReceivedAmount} MMK. Discrepancy: ${result.discrepancyAmount} MMK.`,
      input.recordedBy,
    );

    return {
      ok: true,
      data: {
        batchId: result.batchId,
        batchCode: result.batchCode,
      },
    };
  } catch (error) {
    console.error("[createSettlementBatch error]", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to create settlement batch",
    };
  }
}

/**
 * List all settlement batches.
 */
export async function getSettlementBatches(): Promise<SettlementBatchItem[]> {
  if (!db) return [];

  const batches = await db
    .select()
    .from(courierSettlementBatches)
    .orderBy(desc(courierSettlementBatches.settlementDate));

  if (!batches.length) return [];

  const batchIds = batches.map((b) => b.id);
  const counts = await db
    .select({
      batchId: courierSettlementAllocations.settlementBatchId,
      count: sql<number>`count(*)::int`,
    })
    .from(courierSettlementAllocations)
    .where(inArray(courierSettlementAllocations.settlementBatchId, batchIds))
    .groupBy(courierSettlementAllocations.settlementBatchId);

  const countMap = new Map(counts.map((c) => [c.batchId, c.count]));

  return batches.map((b) => ({
    id: b.id,
    batchCode: b.batchCode,
    courierName: b.courierName,
    bankAccount: b.bankAccount,
    transferReference: b.transferReference,
    settlementDate: b.settlementDate,
    totalCollected: num(b.totalCollected),
    totalCourierFees: num(b.totalCourierFees),
    otherFees: num(b.otherFees),
    bankReceivedAmount: num(b.bankReceivedAmount),
    status: b.status,
    discrepancyAmount: num(b.discrepancyAmount),
    recordedBy: b.recordedBy,
    notes: b.notes,
    createdAt: b.createdAt,
    orderCount: countMap.get(b.id) || 0,
  }));
}

/**
 * Get settlement batch details with all allocations.
 */
export async function getSettlementBatchById(batchId: string) {
  if (!db || !batchId) return null;

  const [batch] = await db
    .select()
    .from(courierSettlementBatches)
    .where(eq(courierSettlementBatches.id, batchId));

  if (!batch) return null;

  const allocations = await db
    .select({
      id: courierSettlementAllocations.id,
      orderId: courierSettlementAllocations.orderId,
      expectedCod: courierSettlementAllocations.expectedCod,
      allocatedCollected: courierSettlementAllocations.allocatedCollected,
      expectedCourierFee: courierSettlementAllocations.expectedCourierFee,
      allocatedCourierFee: courierSettlementAllocations.allocatedCourierFee,
      netOrderPayout: courierSettlementAllocations.netOrderPayout,
      allocatedBy: courierSettlementAllocations.allocatedBy,
      createdAt: courierSettlementAllocations.createdAt,
      orderCode: orders.orderCode,
      customerName: orders.customerName,
      phone: orders.phone,
      destinationCity: orders.destinationCity,
      trackingNumber: orders.trackingNumber,
    })
    .from(courierSettlementAllocations)
    .innerJoin(orders, eq(orders.id, courierSettlementAllocations.orderId))
    .where(eq(courierSettlementAllocations.settlementBatchId, batchId));

  return {
    ...batch,
    totalCollected: num(batch.totalCollected),
    totalCourierFees: num(batch.totalCourierFees),
    otherFees: num(batch.otherFees),
    bankReceivedAmount: num(batch.bankReceivedAmount),
    discrepancyAmount: num(batch.discrepancyAmount),
    allocations: allocations.map((a) => ({
      ...a,
      expectedCod: num(a.expectedCod),
      allocatedCollected: num(a.allocatedCollected),
      expectedCourierFee: num(a.expectedCourierFee),
      allocatedCourierFee: num(a.allocatedCourierFee),
      netOrderPayout: num(a.netOrderPayout),
    })),
  };
}

/**
 * Reverse a settlement batch and revert order courier settlement statuses.
 */
export async function reverseSettlementBatch(
  batchId: string,
  actor: string = "admin",
  reason: string,
): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };
    if (!reason?.trim()) {
      return { ok: false, error: "Reversal reason is required." };
    }

    const result = await db.transaction(async (tx) => {
      const [batch] = await tx
        .select()
        .from(courierSettlementBatches)
        .where(eq(courierSettlementBatches.id, batchId))
        .for("update");

      if (!batch) throw new Error("Settlement batch not found");
      if (batch.status === "reversed") throw new Error("Settlement batch is already reversed");

      const allocations = await tx
        .select({ orderId: courierSettlementAllocations.orderId })
        .from(courierSettlementAllocations)
        .where(eq(courierSettlementAllocations.settlementBatchId, batchId));

      const orderIds = allocations.map((a) => a.orderId);
      if (orderIds.length) {
        await tx
          .update(orders)
          .set({
            courierSettlementStatus: "unsettled",
            actualCourierCost: null,
          })
          .where(inArray(orders.id, orderIds));
      }

      await tx
        .update(courierSettlementBatches)
        .set({
          status: "reversed",
          notes: `${batch.notes || ""} [Reversed by ${actor}: ${reason}]`.trim(),
        })
        .where(eq(courierSettlementBatches.id, batchId));

      return { batchCode: batch.batchCode, orderCount: orderIds.length };
    });

    await audit(
      "settlement.reversed",
      result.batchCode,
      `Reversed settlement batch with ${result.orderCount} orders. Reason: ${reason}`,
      actor,
    );

    return { ok: true };
  } catch (error) {
    console.error("[reverseSettlementBatch error]", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to reverse settlement batch",
    };
  }
}
