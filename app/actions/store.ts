"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import * as auditService from "@/lib/services/audit.service";
import * as customerService from "@/lib/services/customer.service";
import * as orderService from "@/lib/services/order.service";
import * as searchService from "@/lib/services/search.service";
import * as stockService from "@/lib/services/stock.service";
import * as ticketService from "@/lib/services/ticket.service";
import { authorizeStaff, requireStaff } from "@/lib/auth/authorize";
import { allowRequest } from "@/lib/security/rate-limit";

// Re-export types
export type {
  ActionResult,
  InventoryItem,
  AccountUnit,
  CatalogItemInput,
  AccountUnitInput,
} from "@/lib/services/stock.service";
export type { OperationalOrder } from "@/lib/services/order.service";
export type { RevenuePoint, ReceiptOrder } from "@/lib/services/order.service";
export type { CustomerSummary } from "@/lib/services/customer.service";
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

export async function getAccountUnitsAction() {
  await requireStaff(["admin", "staff"]);
  return stockService.getAccountUnits();
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

export async function getLeadsAction() {
  await requireStaff(["admin", "staff"]);
  return ticketService.getLeads();
}

export async function getAuditLogsAction() {
  await requireStaff(["admin", "staff"]);
  return auditService.getAuditLogs();
}

export async function getCustomersAction() {
  await requireStaff(["admin", "staff"]);
  return customerService.getCustomers();
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
  status: "confirmed" | "packing" | "dispatched" | "delivered" | "cancelled",
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
  revalidatePath("/bot");
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
export async function createAccountUnitAction(
  input: stockService.AccountUnitInput,
) {
  if (!(await authorizeStaff(["admin", "staff"])))
    return { ok: false as const, error: "Unauthorized" };
  const result = await stockService.createAccountUnit(input);
  if (result.ok) revalidateCatalog();
  return result;
}
export async function updateAccountUnitAction(
  id: string,
  input: stockService.AccountUnitInput,
) {
  if (!(await authorizeStaff(["admin", "staff"])))
    return { ok: false as const, error: "Unauthorized" };
  const result = await stockService.updateAccountUnit(id, input);
  if (result.ok) revalidateCatalog();
  return result;
}
export async function deleteAccountUnitAction(id: string) {
  if (!(await authorizeStaff(["admin"])))
    return {
      ok: false as const,
      error: "Administrator access is required to delete accounts.",
    };
  const result = await stockService.deleteAccountUnit(id);
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

export async function updateLeadStageAction(
  leadId: string,
  stage: "new" | "contacted" | "reserved" | "converted" | "lost",
) {
  if (!(await authorizeStaff(["admin", "staff"])))
    return { ok: false as const, error: "Unauthorized" };
  const result = await ticketService.updateLeadStage(leadId, stage);
  if (result.ok) {
    revalidatePath("/leads");
  }
  return result;
}
