"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import * as auditService from "@/lib/services/audit.service";
import * as customerService from "@/lib/services/customer.service";
import * as orderService from "@/lib/services/order.service";
import * as paymentService from "@/lib/services/payment.service";
import * as settlementService from "@/lib/services/settlement.service";
import * as searchService from "@/lib/services/search.service";
import * as stockService from "@/lib/services/stock.service";
import * as ticketService from "@/lib/services/ticket.service";
import { authorizeStaff, requireStaff } from "@/lib/auth/authorize";
import { allowRequest } from "@/lib/security/rate-limit";

// Re-export types
export type {
  ActionResult,
  InventoryItem,
  CatalogItemInput,
} from "@/lib/services/stock.service";
export type { OperationalOrder } from "@/lib/services/order.service";
export type { RevenuePoint, ReceiptOrder } from "@/lib/services/order.service";
export type { CustomerSummary, CustomerLoyaltyProfile } from "@/lib/services/customer.service";
export type { GlobalSearchResult } from "@/lib/services/search.service";

// --- Read Actions ---

export async function getDashboardSnapshot() {
  await requireStaff(["admin", "staff"]);
  return stockService.getDashboardSnapshot();
}

export async function getInventoryAction() {
  await requireStaff(["admin", "staff"]);
  return stockService.getInventory();
}

export async function getOrdersAction() {
  await requireStaff(["admin", "staff"]);
  return orderService.getOrders();
}

export async function getRevenueSeriesAction() {
  await requireStaff(["admin", "staff"]);
  return orderService.getRevenueSeries();
}
export async function getReceiptOrdersAction() {
  await requireStaff(["admin", "staff"]);
  return orderService.getReceiptOrders();
}

export async function getTicketsAction() {
  await requireStaff(["admin", "staff"]);
  return ticketService.getTickets();
}

export async function getAuditLogsAction(before?: {
  createdAt: string;
  id: string;
}) {
  await requireStaff(["admin", "staff"]);
  if (
    before &&
    (!/^[0-9a-f-]{36}$/i.test(before.id) ||
      !Number.isFinite(Date.parse(before.createdAt)))
  )
    throw new Error("Invalid history cursor");
  return auditService.getAuditLogs(before);
}

export async function getCustomersAction() {
  await requireStaff(["admin", "staff"]);
  return customerService.getCustomers();
}

export async function lookupCustomerLoyaltyAction(query: {
  phone?: string | null;
  telegramUserId?: string | null;
  telegramUsername?: string | null;
}) {
  return customerService.lookupCustomerLoyalty(query);
}

export async function getReceiptSettingsAction() {
  await requireStaff(["admin", "staff"]);
  return ticketService.getReceiptSettings();
}

export async function globalSearchAction(query: string) {
  if (!(await authorizeStaff(["admin", "staff"]))) {
    return { ok: false as const, error: "Unauthorized" };
  }
  try {
    return {
      ok: true as const,
      data: await searchService.searchBusiness(query),
    };
  } catch (error) {
    console.error("[MH OP global search]", error);
    return {
      ok: false as const,
      error: "Search could not be completed. Try again.",
    };
  }
}

// --- Order Mutations ---

export async function createOrder(form: FormData) {
  if (
    !(await allowRequest(
      "public-order",
      12,
      10 * 60_000,
      String(form.get("phone") || ""),
    ))
  ) {
    return {
      ok: false as const,
      error:
        "Too many order attempts. Please wait a few minutes and try again.",
    };
  }
  const result = await orderService.createOrder(form);
  if (result.ok) {
    revalidatePath("/orders");
    revalidateCatalog();
  }
  return result;
}
export async function reviewPayment(
  orderId: string,
  decision: "verified" | "rejected",
) {
  if (!(await authorizeStaff(["admin", "staff"])))
    return { ok: false as const, error: "Unauthorized" };
  const result = await orderService.reviewPayment(orderId, decision);
  if (result.ok) {
    revalidatePath("/orders");
    revalidateCatalog();
  }
  return result;
}
export async function updateFulfillmentAction(
  orderId: string,
  status:
    | "confirmed"
    | "packing"
    | "packed"
    | "dispatched"
    | "delivered"
    | "cancelled",
) {
  if (!(await authorizeStaff(["admin", "staff"])))
    return { ok: false as const, error: "Unauthorized" };
  const result = await orderService.updateFulfillment(orderId, status);
  if (result.ok) {
    revalidatePath("/orders");
    revalidateCatalog();
  }
  return result;
}

export async function deleteOrderAction(
  orderId: string,
  input: { confirmationCode: string; reason: string },
) {
  const staff = await authorizeStaff(["admin"]);
  if (!staff)
    return {
      ok: false as const,
      error: "Administrator access is required to delete orders.",
    };
  const result = await orderService.deleteOrder(
    orderId,
    input.confirmationCode,
    input.reason,
    `${staff.name} (${staff.email})`,
  );
  if (result.ok) {
    revalidatePath("/orders");
    revalidatePath("/reports");
    revalidatePath("/customers");
    revalidatePath("/erp");
    revalidateCatalog();
  }
  return result;
}

export async function addShipmentAction(
  orderId: string,
  input: { trackingNumber: string; carrier: string },
) {
  if (!(await authorizeStaff(["admin", "staff"])))
    return { ok: false as const, error: "Unauthorized" };
  const result = await orderService.addShipment(orderId, input);
  if (result.ok) {
    revalidatePath("/orders");
  }
  return result;
}

// --- Stock Mutations ---

const revalidateCatalog = () => {
  revalidateTag("public-commerce");
  revalidatePath("/inventory");
  revalidatePath("/shop");
  revalidatePath("/shop/compare");
  revalidatePath("/shop/checkout");
  revalidatePath("/dashboard");
};

export async function createCatalogItemAction(
  input: stockService.CatalogItemInput,
) {
  if (!(await authorizeStaff(["admin", "staff"])))
    return { ok: false as const, error: "Unauthorized" };
  const result = await stockService.createCatalogItem(input);
  if (result.ok) revalidateCatalog();
  return result;
}
export async function updateCatalogItemAction(
  variantId: string,
  input: stockService.CatalogItemInput,
) {
  if (!(await authorizeStaff(["admin", "staff"])))
    return { ok: false as const, error: "Unauthorized" };
  const result = await stockService.updateCatalogItem(variantId, input);
  if (result.ok) revalidateCatalog();
  return result;
}
export async function deleteCatalogItemAction(variantId: string) {
  if (!(await authorizeStaff(["admin"])))
    return {
      ok: false as const,
      error: "Administrator access is required to delete listings.",
    };
  const result = await stockService.deleteCatalogItem(variantId);
  if (result.ok) revalidateCatalog();
  return result;
}
export async function adjustStockAction(variantId: string, delta: number) {
  if (!(await authorizeStaff(["admin", "staff"])))
    return { ok: false as const, error: "Unauthorized" };
  const result = await stockService.adjustStock(variantId, delta);
  if (result.ok) {
    revalidateCatalog();
  }
  return result;
}

export async function assignDeviceToOrder(
  orderItemId: string,
  deviceUnitId: string,
) {
  if (!(await authorizeStaff(["admin", "staff"])))
    return { ok: false as const, error: "Unauthorized" };
  const result = await stockService.assignDeviceToOrder(
    orderItemId,
    deviceUnitId,
  );
  if (result.ok) {
    revalidatePath("/orders");
    revalidatePath("/inventory");
  }
  return result;
}

export async function assignDeviceByIdentifierAction(
  orderId: string,
  identifier: string,
) {
  if (!(await authorizeStaff(["admin", "staff"])))
    return { ok: false as const, error: "Unauthorized" };
  const result = await stockService.assignDeviceByIdentifier(
    orderId,
    identifier,
  );
  if (result.ok) {
    revalidatePath("/orders");
    revalidatePath("/inventory");
  }
  return result;
}

// --- Tickets & CRM Mutations ---

export async function createWarrantyTicket(form: FormData) {
  if (!(await authorizeStaff(["admin", "staff"])))
    return { ok: false as const, error: "Unauthorized" };
  const result = await ticketService.createWarrantyTicket(form);
  if (result.ok) {
    revalidatePath("/tickets");
  }
  return result;
}

export async function updateTicketStatusAction(
  ticketId: string,
  status:
    "claim_received" | "inspection" | "repaired" | "replaced" | "dispatched",
) {
  if (!(await authorizeStaff(["admin", "staff"])))
    return { ok: false as const, error: "Unauthorized" };
  const result = await ticketService.updateTicketStatus(ticketId, status);
  if (result.ok) {
    revalidatePath("/tickets");
  }
  return result;
}

export async function resolveWarrantyTicketAction(
  ticketId: string,
  input: {
    resolution: "repair" | "replacement" | "refund" | "rejected";
    resolutionCost: number;
    refundAmount: number;
    replacementVariantId?: string;
  },
) {
  if (!(await authorizeStaff(["admin", "staff"])))
    return { ok: false as const, error: "Unauthorized" };
  const result = await ticketService.resolveWarrantyTicket(ticketId, input);
  if (result.ok) {
    revalidatePath("/tickets");
    revalidatePath("/erp");
    revalidatePath("/dashboard");
    revalidatePath("/inventory");
    revalidatePath("/shop");
  }
  return result;
}

// --- Order Workflow Actions ---

export async function adminCreateOrderAction(
  input: Parameters<typeof orderService.adminCreateOrder>[0],
) {
  const staff = await authorizeStaff(["admin", "staff"]);
  if (!staff) return { ok: false as const, error: "Unauthorized" };
  const result = await orderService.adminCreateOrder(input, staff.email);
  if (result.ok) {
    revalidatePath("/orders");
    revalidatePath("/inventory");
  }
  return result;
}

export async function getOrderByIdAction(orderId: string) {
  const staff = await requireStaff(["admin", "staff"]);
  const order = await orderService.getOrderById(orderId);
  return order ? { ...order, canDeleteOrder: staff.role === "admin" } : null;
}

export async function preDispatchEditOrderAction(
  orderId: string,
  input: Parameters<typeof orderService.preDispatchEditOrder>[1],
) {
  const staff = await authorizeStaff(["admin", "staff"]);
  if (!staff) return { ok: false as const, error: "Unauthorized" };
  const result = await orderService.preDispatchEditOrder(orderId, input, staff.email);
  if (result.ok) {
    revalidatePath("/orders");
    revalidatePath(`/orders/${orderId}`);
    revalidatePath("/inventory");
  }
  return result;
}

export async function postDispatchCorrectionAction(
  orderId: string,
  input: Parameters<typeof orderService.postDispatchCorrection>[1],
) {
  const staff = await authorizeStaff(["admin", "staff"]);
  if (!staff) return { ok: false as const, error: "Unauthorized" };
  const result = await orderService.postDispatchCorrection(orderId, input, staff.email);
  if (result.ok) {
    revalidatePath("/orders");
    revalidatePath(`/orders/${orderId}`);
  }
  return result;
}

export async function recordFailedDeliveryAction(
  orderId: string,
  input: Parameters<typeof orderService.recordFailedDelivery>[1],
) {
  const staff = await authorizeStaff(["admin"]);
  if (!staff)
    return {
      ok: false as const,
      error: "Unauthorized: Admin access required for failed delivery and return disposition.",
    };
  const result = await orderService.recordFailedDelivery(orderId, input, staff.email);
  if (result.ok) {
    revalidatePath("/orders");
    revalidatePath(`/orders/${orderId}`);
    revalidatePath("/inventory");
  }
  return result;
}

// --- Payment Ledger Actions ---

export async function recordPaymentAction(input: paymentService.RecordPaymentInput) {
  const staff = await authorizeStaff(["admin", "staff"]);
  if (!staff) return { ok: false as const, error: "Unauthorized" };
  const result = await paymentService.recordPayment({
    ...input,
    recordedBy: staff.email,
  });
  if (result.ok) {
    revalidatePath("/orders");
    revalidatePath(`/orders/${input.orderId}`);
  }
  return result;
}

export async function verifyPaymentAction(paymentId: string) {
  const staff = await authorizeStaff(["admin"]);
  if (!staff)
    return { ok: false as const, error: "Unauthorized: Admin access required to approve payments." };
  const result = await paymentService.verifyPayment(paymentId, staff.email);
  if (result.ok) {
    revalidatePath("/orders");
  }
  return result;
}

export async function rejectPaymentAction(paymentId: string, reason?: string) {
  const staff = await authorizeStaff(["admin"]);
  if (!staff)
    return { ok: false as const, error: "Unauthorized: Admin access required to reject payments." };
  const result = await paymentService.rejectPayment(paymentId, staff.email, reason);
  if (result.ok) {
    revalidatePath("/orders");
  }
  return result;
}

export async function confirmCodCollectionAction(
  orderId: string,
  collectedAmount?: number,
  notes?: string,
) {
  const staff = await authorizeStaff(["admin", "staff"]);
  if (!staff) return { ok: false as const, error: "Unauthorized" };
  const result = await paymentService.confirmCodCollection(
    orderId,
    staff.email,
    collectedAmount,
    notes,
  );
  if (result.ok) {
    revalidatePath("/orders");
    revalidatePath(`/orders/${orderId}`);
    revalidatePath("/erp");
  }
  return result;
}

export async function recordRefundReversalAction(
  paymentId: string,
  reason: string,
) {
  const staff = await authorizeStaff(["admin"]);
  if (!staff)
    return {
      ok: false as const,
      error: "Unauthorized: Admin access required to issue refund reversals.",
    };
  const result = await paymentService.recordRefundReversal(
    paymentId,
    staff.email,
    reason,
  );
  if (result.ok) {
    revalidatePath("/orders");
    revalidatePath("/erp");
  }
  return result;
}

// --- Courier Settlement Actions ---

export async function getUnsettledOrdersAction() {
  await requireStaff(["admin", "staff"]);
  return settlementService.getUnsettledOrders();
}

export async function getSettlementBatchesAction() {
  await requireStaff(["admin", "staff"]);
  return settlementService.getSettlementBatches();
}

export async function getSettlementBatchByIdAction(batchId: string) {
  await requireStaff(["admin", "staff"]);
  return settlementService.getSettlementBatchById(batchId);
}

export async function createSettlementBatchAction(
  input: Omit<settlementService.CreateSettlementBatchInput, "recordedBy">,
) {
  const staff = await authorizeStaff(["admin"]);
  if (!staff)
    return {
      ok: false as const,
      error: "Unauthorized: Admin access required to record courier settlements.",
    };
  const result = await settlementService.createSettlementBatch({
    ...input,
    recordedBy: staff.email,
  });
  if (result.ok) {
    revalidatePath("/orders");
    revalidatePath("/erp");
    revalidatePath("/erp/settlements");
  }
  return result;
}

export async function reverseSettlementBatchAction(
  batchId: string,
  reason: string,
) {
  const staff = await authorizeStaff(["admin"]);
  if (!staff)
    return {
      ok: false as const,
      error: "Unauthorized: Admin access required to reverse settlements.",
    };
  const result = await settlementService.reverseSettlementBatch(
    batchId,
    staff.email,
    reason,
  );
  if (result.ok) {
    revalidatePath("/orders");
    revalidatePath("/erp");
    revalidatePath("/erp/settlements");
  }
  return result;
}



