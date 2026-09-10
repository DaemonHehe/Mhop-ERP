import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  orderPayments,
  orders,
  staffAlerts,
} from "@/db/schema";
import { audit } from "./audit.service";
import type { ActionResult } from "./stock.service";

export interface OrderPaymentItem {
  id: string;
  orderId: string;
  paymentType: string;
  amount: number;
  paymentMethod: string;
  status: string;
  reference: string | null;
  slipUrl: string | null;
  recordedBy: string;
  verifiedBy: string | null;
  verifiedAt: Date | null;
  reversalOfId: string | null;
  notes: string | null;
  createdAt: Date;
}

export interface RecordPaymentInput {
  orderId: string;
  paymentType: "deposit" | "cod_collection" | "direct_prepayment" | "direct_balance";
  amount: number;
  paymentMethod?: string;
  reference?: string;
  slipUrl?: string;
  recordedBy?: string;
  notes?: string;
  autoVerify?: boolean;
}

const num = (val: string | number | null | undefined): number => Number(val) || 0;

/**
 * Recalculate order financial balance and payment status based on all verified payments in ledger.
 */
export async function recalculateOrderPayments(
  tx: Parameters<Parameters<NonNullable<typeof db>["transaction"]>[0]>[0],
  orderId: string,
): Promise<{
  paidAmount: number;
  customerBalance: number;
  customerPaymentStatus: string;
}> {
  const [order] = await tx
    .select({
      id: orders.id,
      orderCode: orders.orderCode,
      totalAmount: orders.totalAmount,
      requiredDeposit: orders.requiredDeposit,
      codAmount: orders.codAmount,
      isDigitalOnly: orders.isDigitalOnly,
      fulfillmentStatus: orders.fulfillmentStatus,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .for("update");

  if (!order) throw new Error("Order not found");

  const verifiedPayments = await tx
    .select({
      amount: orderPayments.amount,
      paymentType: orderPayments.paymentType,
    })
    .from(orderPayments)
    .where(
      and(
        eq(orderPayments.orderId, orderId),
        eq(orderPayments.status, "verified"),
      ),
    );

  const totalPaid = verifiedPayments.reduce(
    (sum: number, p: { amount: string }) => sum + num(p.amount),
    0,
  );

  const totalAmount = num(order.totalAmount);
  const requiredDeposit = num(order.requiredDeposit);
  const customerBalance = Math.max(0, totalAmount - totalPaid);

  let newPaymentStatus: string;
  if (totalPaid <= 0 && verifiedPayments.length > 0) {
    newPaymentStatus = "refunded";
  } else if (totalPaid <= 0) {
    newPaymentStatus = "unpaid";
  } else if (totalPaid > totalAmount) {
    newPaymentStatus = "overpaid";
  } else if (totalPaid >= totalAmount) {
    newPaymentStatus = "fully_paid";
  } else if (totalPaid >= requiredDeposit) {
    newPaymentStatus = "deposit_verified";
  } else {
    newPaymentStatus = "deposit_pending";
  }

  // Determine legacy paymentStatus for backward compatibility
  let legacyPaymentStatus: "pending" | "verified" | "rejected" | "refunded" = "pending";
  if (newPaymentStatus === "refunded") {
    legacyPaymentStatus = "refunded";
  } else if (
    newPaymentStatus === "fully_paid" ||
    newPaymentStatus === "cod_collected" ||
    newPaymentStatus === "deposit_verified"
  ) {
    legacyPaymentStatus = "verified";
  }

  const codAmount = !order.isDigitalOnly && customerBalance > 0
    ? Math.max(0, totalAmount - Math.max(totalPaid, requiredDeposit))
    : 0;

  await tx
    .update(orders)
    .set({
      customerPaidAmount: String(totalPaid),
      customerBalance: String(customerBalance),
      codAmount: String(codAmount),
      customerPaymentStatus: newPaymentStatus,
      paymentStatus: legacyPaymentStatus,
    })
    .where(eq(orders.id, orderId));

  return {
    paidAmount: totalPaid,
    customerBalance,
    customerPaymentStatus: newPaymentStatus,
  };
}

/**
 * Record a payment entry in the immutable ledger.
 */
export async function recordPayment(
  input: RecordPaymentInput,
): Promise<ActionResult<{ paymentId: string }>> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };
    if (!input.orderId || input.amount <= 0) {
      return { ok: false, error: "Valid order ID and positive amount are required." };
    }

    const result = await db.transaction(async (tx) => {
      const [order] = await tx
        .select({
          id: orders.id,
          orderCode: orders.orderCode,
          customerName: orders.customerName,
          totalAmount: orders.totalAmount,
        })
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .for("update");

      if (!order) throw new Error("Order not found");

      const initialStatus = input.autoVerify ? "verified" : "pending";
      const now = new Date();

      const [payment] = await tx
        .insert(orderPayments)
        .values({
          orderId: input.orderId,
          paymentType: input.paymentType,
          amount: String(input.amount),
          paymentMethod: input.paymentMethod || "kbzpay",
          status: initialStatus,
          reference: input.reference || null,
          slipUrl: input.slipUrl || null,
          recordedBy: input.recordedBy || "customer",
          verifiedBy: input.autoVerify ? (input.recordedBy || "admin") : null,
          verifiedAt: input.autoVerify ? now : null,
          notes: input.notes || null,
          createdAt: now,
        })
        .returning({ id: orderPayments.id });

      if (input.autoVerify) {
        await recalculateOrderPayments(tx, input.orderId);
      } else {
        await tx.insert(staffAlerts).values({
          type: "payment.slip_uploaded",
          title: `Payment pending verification • ${order.orderCode}`,
          body: `${input.paymentType.toUpperCase()} payment of ${input.amount} MMK recorded. Verification needed.`,
          targetCode: order.orderCode,
        });
      }

      return { paymentId: payment.id, orderCode: order.orderCode };
    });

    await audit(
      "payment.recorded",
      result.orderCode,
      `${input.paymentType} payment of ${input.amount} MMK recorded (${input.autoVerify ? "verified" : "pending"})`,
      input.recordedBy || "system",
    );

    return { ok: true, data: { paymentId: result.paymentId } };
  } catch (error) {
    console.error("[recordPayment error]", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to record payment",
    };
  }
}

/**
 * Verify a pending payment record.
 */
export async function verifyPayment(
  paymentId: string,
  actor: string = "admin",
): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };

    const result = await db.transaction(async (tx) => {
      const [payment] = await tx
        .select()
        .from(orderPayments)
        .where(eq(orderPayments.id, paymentId))
        .for("update");

      if (!payment) throw new Error("Payment record not found");
      if (payment.status === "verified") throw new Error("Payment is already verified");
      if (payment.status === "rejected") throw new Error("Cannot verify a rejected payment");

      const now = new Date();
      await tx
        .update(orderPayments)
        .set({
          status: "verified",
          verifiedBy: actor,
          verifiedAt: now,
        })
        .where(eq(orderPayments.id, paymentId));

      const { paidAmount, customerPaymentStatus } = await recalculateOrderPayments(
        tx,
        payment.orderId,
      );

      const [order] = await tx
        .select({
          orderCode: orders.orderCode,
          fulfillmentStatus: orders.fulfillmentStatus,
        })
        .from(orders)
        .where(eq(orders.id, payment.orderId));

      await tx.insert(staffAlerts).values({
        type: "payment.verified",
        title: `Payment verified • ${order.orderCode}`,
        body: `Payment of ${payment.amount} MMK verified. Total paid: ${paidAmount} MMK (${customerPaymentStatus}).`,
        targetCode: order.orderCode,
      });

      return { orderCode: order.orderCode, amount: payment.amount };
    });

    await audit(
      "payment.verified",
      result.orderCode,
      `Verified payment of ${result.amount} MMK`,
      actor,
    );

    return { ok: true };
  } catch (error) {
    console.error("[verifyPayment error]", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to verify payment",
    };
  }
}

/**
 * Reject a pending payment record.
 */
export async function rejectPayment(
  paymentId: string,
  actor: string = "admin",
  reason?: string,
): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };

    const result = await db.transaction(async (tx) => {
      const [payment] = await tx
        .select()
        .from(orderPayments)
        .where(eq(orderPayments.id, paymentId))
        .for("update");

      if (!payment) throw new Error("Payment record not found");
      if (payment.status === "verified") throw new Error("Cannot reject a verified payment; record a refund reversal instead");
      if (payment.status === "rejected") throw new Error("Payment is already rejected");

      await tx
        .update(orderPayments)
        .set({
          status: "rejected",
          verifiedBy: actor,
          notes: reason ? `${payment.notes || ""} [Rejected: ${reason}]`.trim() : payment.notes,
        })
        .where(eq(orderPayments.id, paymentId));

      const [order] = await tx
        .select({ orderCode: orders.orderCode })
        .from(orders)
        .where(eq(orders.id, payment.orderId));

      return { orderCode: order?.orderCode || "UNKNOWN", amount: payment.amount };
    });

    await audit(
      "payment.rejected",
      result.orderCode,
      `Rejected payment of ${result.amount} MMK. Reason: ${reason || "Unspecified"}`,
      actor,
    );

    return { ok: true };
  } catch (error) {
    console.error("[rejectPayment error]", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to reject payment",
    };
  }
}

/**
 * Confirm COD collection by Royal Express on delivery.
 * This zeros the customer balance, marks customerPaymentStatus as 'cod_collected',
 * and courierSettlementStatus remains 'unsettled' awaiting Royal transfer.
 */
export async function confirmCodCollection(
  orderId: string,
  actor: string = "admin",
  collectedAmount?: number,
  notes?: string,
): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };

    const result = await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .for("update");

      if (!order) throw new Error("Order not found");
      if (order.fulfillmentStatus === "cancelled") throw new Error("Cannot collect COD on a cancelled order");
      if (order.customerPaymentStatus === "cod_collected" || order.customerPaymentStatus === "fully_paid") {
        throw new Error("COD has already been collected or order is fully paid");
      }

      const amountToCollect = collectedAmount ?? num(order.codAmount);
      if (amountToCollect <= 0) throw new Error("COD amount must be greater than 0");

      const now = new Date();

      // Insert COD payment ledger entry
      await tx.insert(orderPayments).values({
        orderId,
        paymentType: "cod_collection",
        amount: String(amountToCollect),
        paymentMethod: "cash_courier",
        status: "verified",
        reference: "ROYAL-COD-DELIVERY",
        recordedBy: actor,
        verifiedBy: actor,
        verifiedAt: now,
        notes: notes || "Royal Express COD collection confirmed on delivery",
        createdAt: now,
      });

      // Recalculate order payments
      await recalculateOrderPayments(tx, orderId);

      // Explicitly set customer_payment_status = 'cod_collected' and mark delivered if dispatched
      await tx
        .update(orders)
        .set({
          customerPaymentStatus: "cod_collected",
          courierSettlementStatus: "unsettled",
          ...(order.fulfillmentStatus === "dispatched"
            ? { fulfillmentStatus: "delivered", deliveredAt: now }
            : {}),
        })
        .where(eq(orders.id, orderId));

      await tx.insert(staffAlerts).values({
        type: "payment.cod_collected",
        title: `COD collected • ${order.orderCode}`,
        body: `Royal Express collected ${amountToCollect} MMK COD from customer. Customer balance is now 0. Funds are courier-held pending Royal settlement.`,
        targetCode: order.orderCode,
      });

      return {
        orderCode: order.orderCode,
        amount: amountToCollect,
      };
    });

    await audit(
      "payment.cod_collected",
      result.orderCode,
      `Royal Express COD collected: ${result.amount} MMK. Customer balance zeroed; courier-held.`,
      actor,
    );

    return { ok: true };
  } catch (error) {
    console.error("[confirmCodCollection error]", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to confirm COD collection",
    };
  }
}

/**
 * Record a refund reversal linked to a previous verified payment.
 * Creates an immutable negative ledger row and recalculates balances.
 */
export async function recordRefundReversal(
  paymentId: string,
  actor: string = "admin",
  reason: string,
): Promise<ActionResult<{ reversalPaymentId: string }>> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };
    if (!reason?.trim()) {
      return { ok: false, error: "A detailed refund/reversal reason is required." };
    }

    const result = await db.transaction(async (tx) => {
      const [original] = await tx
        .select()
        .from(orderPayments)
        .where(eq(orderPayments.id, paymentId))
        .for("update");

      if (!original) throw new Error("Original payment record not found");
      if (original.status !== "verified") throw new Error("Only verified payments can be reversed");
      if (num(original.amount) <= 0) throw new Error("Cannot reverse a non-positive or reversal entry");

      // Check if already reversed
      const existingReversal = await tx
        .select({ id: orderPayments.id })
        .from(orderPayments)
        .where(eq(orderPayments.reversalOfId, paymentId))
        .limit(1);

      if (existingReversal.length > 0) {
        throw new Error("This payment has already been reversed");
      }

      const reversalAmount = -num(original.amount);
      const now = new Date();

      const [reversal] = await tx
        .insert(orderPayments)
        .values({
          orderId: original.orderId,
          paymentType: "refund_reversal",
          amount: String(reversalAmount),
          paymentMethod: original.paymentMethod,
          status: "verified",
          recordedBy: actor,
          verifiedBy: actor,
          verifiedAt: now,
          reversalOfId: original.id,
          notes: `Reversal of payment ${original.id}. Reason: ${reason}`,
          createdAt: now,
        })
        .returning({ id: orderPayments.id });

      const { customerBalance, customerPaymentStatus } =
        await recalculateOrderPayments(tx, original.orderId);

      const [order] = await tx
        .select({ orderCode: orders.orderCode })
        .from(orders)
        .where(eq(orders.id, original.orderId));

      await tx.insert(staffAlerts).values({
        type: "payment.refunded",
        title: `Payment reversed • ${order.orderCode}`,
        body: `Reversed ${original.amount} MMK. Current customer balance: ${customerBalance} MMK (${customerPaymentStatus}).`,
        targetCode: order.orderCode,
      });

      return {
        reversalPaymentId: reversal.id,
        orderCode: order.orderCode,
        amount: original.amount,
      };
    });

    await audit(
      "payment.reversed",
      result.orderCode,
      `Reversed payment of ${result.amount} MMK. Reason: ${reason}`,
      actor,
    );

    return { ok: true, data: { reversalPaymentId: result.reversalPaymentId } };
  } catch (error) {
    console.error("[recordRefundReversal error]", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to record refund reversal",
    };
  }
}

/**
 * Fetch all payment ledger records for an order.
 */
export async function getOrderPayments(orderId: string): Promise<OrderPaymentItem[]> {
  if (!db || !orderId) return [];

  const rows = await db
    .select()
    .from(orderPayments)
    .where(eq(orderPayments.orderId, orderId))
    .orderBy(desc(orderPayments.createdAt));

  return rows.map((r) => ({
    id: r.id,
    orderId: r.orderId,
    paymentType: r.paymentType,
    amount: num(r.amount),
    paymentMethod: r.paymentMethod,
    status: r.status,
    reference: r.reference,
    slipUrl: r.slipUrl,
    recordedBy: r.recordedBy,
    verifiedBy: r.verifiedBy,
    verifiedAt: r.verifiedAt,
    reversalOfId: r.reversalOfId,
    notes: r.notes,
    createdAt: r.createdAt,
  }));
}
