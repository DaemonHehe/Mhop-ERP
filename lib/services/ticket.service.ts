import { desc, eq } from "drizzle-orm";
import { and, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  customers,
  deviceUnits,
  leads,
  orderItems,
  orders,
  products,
  productVariants,
  receiptSettings,
  staffAlerts,
  tickets,
} from "@/db/schema";
import { clientConfig } from "@/lib/client-config";
import { evaluateWarrantyPolicy } from "@/lib/warranty-policy";
import {
  leadSchema,
  ticketSchema,
  warrantyResolutionSchema,
} from "@/lib/validation/schemas";
import { audit } from "./audit.service";
import type { ActionResult } from "./stock.service";

export type LeadInput = z.input<typeof leadSchema>;

const errorOf = (error: unknown) =>
  error instanceof Error ? error.message : "Unexpected operation failure";

export async function getTickets() {
  if (!db) {
    return [
      {
        id: "demo-1",
        ticketCode: "RMA-2608-042",
        orderCode: "MHOP-260820-0912",
        serialNumber: "F2LIP16P0001",
        productName: "DL05 Phone Cooler",
        sku: "MEMO-DL05-RGB",
        customerName: "Ei Mon",
        phone: "09 000 000 001",
        category: "battery",
        priority: "normal",
        status: "claim_received",
        messageText: "Battery health degradation",
        warrantyExpiresAt: new Date("2026-11-20"),
        resolution: null,
        resolutionCost: 0,
        refundAmount: 0,
      },
      {
        id: "demo-2",
        ticketCode: "RMA-2608-039",
        orderCode: "MHOP-260817-0881",
        serialNumber: "R5CX20S25002",
        productName: "G8 Galileo Controller",
        sku: "GMS-G8-GALILEO",
        customerName: "Yan Naing",
        phone: "09 000 000 002",
        category: "charging",
        priority: "high",
        status: "inspection",
        messageText: "Charging fault",
        warrantyExpiresAt: new Date("2027-02-17"),
        resolution: null,
        resolutionCost: 0,
        refundAmount: 0,
      },
      {
        id: "demo-3",
        ticketCode: "RMA-2608-031",
        orderCode: "MHOP-260810-0790",
        serialNumber: "WHXM500018",
        productName: "BlackShark V2 X",
        sku: "RZR-BSV2X-BLK",
        customerName: "Aye Chan",
        phone: "09 000 000 003",
        category: "other",
        priority: "normal",
        status: "repaired",
        messageText: "Right channel intermittent",
        warrantyExpiresAt: new Date("2027-02-10"),
        resolution: "repair",
        resolutionCost: 18000,
        refundAmount: 0,
      },
    ];
  }
  const rows = await db
    .select({
      id: tickets.id,
      ticketCode: tickets.ticketCode,
      orderCode: tickets.orderCode,
      orderItemId: tickets.orderItemId,
      serialNumber: tickets.serialNumber,
      customerName: tickets.customerName,
      phone: tickets.phone,
      category: tickets.category,
      priority: tickets.priority,
      status: tickets.status,
      messageText: tickets.messageText,
      warrantyStartAt: tickets.warrantyStartAt,
      warrantyExpiresAt: tickets.warrantyExpiresAt,
      resolution: tickets.resolution,
      resolutionCost: tickets.resolutionCost,
      refundAmount: tickets.refundAmount,
      replacementVariantId: tickets.replacementVariantId,
      resolvedAt: tickets.resolvedAt,
      productName: products.name,
      sku: productVariants.sku,
    })
    .from(tickets)
    .leftJoin(orderItems, eq(orderItems.id, tickets.orderItemId))
    .leftJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .leftJoin(products, eq(products.id, orderItems.productId))
    .orderBy(desc(tickets.id));
  return rows.map((row) => ({
    ...row,
    productName: row.productName || "Legacy warranty item",
    sku: row.sku || "—",
    resolutionCost: Number(row.resolutionCost),
    refundAmount: Number(row.refundAmount),
  }));
}

export async function createWarrantyTicket(
  form: FormData,
): Promise<ActionResult<{ ticketCode: string }>> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };

    const parsed = ticketSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message || "Invalid ticket",
      };
    }

    const ticketCode = `RMA-${new Date()
      .toISOString()
      .slice(2, 10)
      .replaceAll("-", "")}-${crypto.randomUUID().slice(0, 3).toUpperCase()}`;

    const [purchase] = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.orderCode, parsed.data.orderCode),
          eq(orders.phone, parsed.data.phone),
        ),
      )
      .limit(1);
    if (!purchase)
      return {
        ok: false,
        error: "The order code and phone number do not match.",
      };
    const itemRows = await db
      .select({
        id: orderItems.id,
        productName: products.name,
        sku: productVariants.sku,
        warrantyMonths: productVariants.warrantyMonths,
        serial: deviceUnits.serialNumber,
        imei: deviceUnits.imeiNumber,
      })
      .from(orderItems)
      .innerJoin(products, eq(products.id, orderItems.productId))
      .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
      .leftJoin(deviceUnits, eq(deviceUnits.id, orderItems.deviceUnitId))
      .where(
        and(
          eq(orderItems.orderId, purchase.id),
          eq(productVariants.sku, parsed.data.sku),
        ),
      );
    const item = itemRows.find(
      (row) =>
        !parsed.data.serialNumber ||
        row.serial === parsed.data.serialNumber ||
        row.imei === parsed.data.serialNumber,
    );
    if (!item)
      return {
        ok: false,
        error: parsed.data.serialNumber
          ? "The SKU and serial/IMEI do not match this order."
          : "That product SKU is not part of this order.",
      };

    const [existing] = await db
      .select({ code: tickets.ticketCode })
      .from(tickets)
      .where(
        and(
          eq(tickets.orderItemId, item.id),
          or(
            eq(tickets.status, "claim_received"),
            eq(tickets.status, "inspection"),
            eq(tickets.status, "repaired"),
            eq(tickets.status, "replaced"),
          ),
        ),
      )
      .limit(1);
    if (existing)
      return {
        ok: false,
        error: `${existing.code} is already active for this item.`,
      };

    const policy = evaluateWarrantyPolicy({
      paymentStatus: purchase.paymentStatus,
      fulfillmentStatus: purchase.fulfillmentStatus,
      deliveredAt: purchase.deliveredAt,
      orderCreatedAt: purchase.createdAt,
      warrantyMonths: item.warrantyMonths,
    });
    if (!policy.eligible) return { ok: false, error: policy.reason };
    const warrantyStartAt = policy.startAt;
    const warrantyExpiresAt = policy.expiresAt;

    await db.transaction(async (tx) => {
      await tx.insert(tickets).values({
        orderCode: parsed.data.orderCode,
        orderItemId: item.id,
        serialNumber:
          parsed.data.serialNumber || item.imei || item.serial || null,
        phone: parsed.data.phone,
        category: parsed.data.category,
        priority: parsed.data.priority,
        messageText: parsed.data.messageText,
        customerName: purchase.customerName,
        ticketCode,
        warrantyStartAt,
        warrantyExpiresAt,
      });
      await tx.insert(staffAlerts).values({
        type: "warranty_claim",
        title: `New warranty claim ${ticketCode}`,
        body: `${purchase.customerName}: ${item.productName} · ${parsed.data.category}`,
        targetCode: ticketCode,
      });
    });
    await audit(
      "ticket.created",
      ticketCode,
      `${parsed.data.category}: ${item.sku}`,
    );

    return { ok: true, data: { ticketCode } };
  } catch (error) {
    return { ok: false, error: errorOf(error) };
  }
}

export async function updateTicketStatus(
  ticketId: string,
  status:
    "claim_received" | "inspection" | "repaired" | "replaced" | "dispatched",
): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };

    const updated = await db.transaction(async (tx) => {
      const [ticket] = await tx
        .select({
          code: tickets.ticketCode,
          serial: tickets.serialNumber,
          status: tickets.status,
        })
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .limit(1)
        .for("update");
      if (!ticket) return null;
      const allowed =
        (ticket.status === "claim_received" && status === "inspection") ||
        (["repaired", "replaced"].includes(ticket.status) &&
          status === "dispatched");
      if (!allowed)
        throw new Error(
          "Use the required next warranty step or record a resolution first.",
        );
      await tx.update(tickets).set({ status }).where(eq(tickets.id, ticketId));
      if (status === "inspection" && ticket.serial)
        await tx
          .update(deviceUnits)
          .set({ status: "rma_under_repair" })
          .where(
            or(
              eq(deviceUnits.serialNumber, ticket.serial),
              eq(deviceUnits.imeiNumber, ticket.serial),
            ),
          );
      if (status === "dispatched" && ticket.serial)
        await tx
          .update(deviceUnits)
          .set({ status: "sold" })
          .where(
            or(
              eq(deviceUnits.serialNumber, ticket.serial),
              eq(deviceUnits.imeiNumber, ticket.serial),
            ),
          );
      return ticket;
    });

    if (!updated) return { ok: false, error: "Ticket not found" };

    await audit(
      "ticket.status_changed",
      updated.code,
      `Status changed to ${status}`,
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorOf(error) };
  }
}

export async function resolveWarrantyTicket(
  ticketId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };
    const parsed = warrantyResolutionSchema.safeParse(input);
    if (!parsed.success)
      return {
        ok: false,
        error: parsed.error.issues[0]?.message || "Invalid warranty resolution",
      };
    const value = parsed.data;
    let ticketCode = "";
    let bookedCost = value.resolutionCost;

    await db.transaction(async (tx) => {
      const [ticket] = await tx
        .select({
          code: tickets.ticketCode,
          status: tickets.status,
          serial: tickets.serialNumber,
        })
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .for("update");
      if (!ticket) throw new Error("Warranty ticket not found");
      if (!["claim_received", "inspection"].includes(ticket.status))
        throw new Error("This claim has already been resolved");

      const status =
        value.resolution === "repair"
          ? "repaired"
          : value.resolution === "replacement"
            ? "replaced"
            : value.resolution === "refund"
              ? "refunded"
              : "rejected";

      if (value.resolution === "replacement") {
        const [replacement] = await tx
          .select({
            cost: productVariants.costPrice,
            stock: productVariants.stockQuantity,
            category: products.category,
          })
          .from(productVariants)
          .innerJoin(products, eq(products.id, productVariants.productId))
          .where(
            and(
              eq(productVariants.id, value.replacementVariantId!),
              eq(productVariants.isActive, true),
            ),
          )
          .for("update");
        if (!replacement || replacement.stock < 1)
          throw new Error("The selected replacement is out of stock");
        if (replacement.category === "PUBG Accounts")
          throw new Error(
            "Handle PUBG account replacements using an individual account listing; physical stock replacement does not apply.",
          );
        await tx
          .update(productVariants)
          .set({ stockQuantity: sql`${productVariants.stockQuantity}-1` })
          .where(eq(productVariants.id, value.replacementVariantId!));
        bookedCost += Number(replacement.cost);
        if (ticket.serial)
          await tx
            .update(deviceUnits)
            .set({ status: "written_off" })
            .where(
              or(
                eq(deviceUnits.serialNumber, ticket.serial),
                eq(deviceUnits.imeiNumber, ticket.serial),
              ),
            );
      }

      await tx
        .update(tickets)
        .set({
          status,
          resolution: value.resolution,
          resolutionCost: String(bookedCost),
          refundAmount: String(
            value.resolution === "refund" ? value.refundAmount : 0,
          ),
          replacementVariantId:
            value.resolution === "replacement"
              ? value.replacementVariantId
              : null,
          resolvedAt: new Date(),
        })
        .where(eq(tickets.id, ticketId));
      ticketCode = ticket.code;
    });

    await audit(
      "ticket.resolved",
      ticketCode,
      `${value.resolution}; warranty cost ${bookedCost}; refund ${value.refundAmount}`,
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorOf(error) };
  }
}

export async function getLeads() {
  if (!db) {
    return [
      {
        id: "demo-1",
        customerName: "May Thazin",
        phone: null,
        telegramUserId: "100001",
        cartItemsJson: [{ name: "PUBG Competitive Account" }],
        stage: "new",
        reserveExpiresAt: new Date(Date.now() + 43 * 60000),
      },
      {
        id: "demo-2",
        customerName: "Zaw Lin",
        phone: "09 000 001 002",
        telegramUserId: null,
        cartItemsJson: [{ name: "Razer BlackShark V2 X" }],
        stage: "contacted",
        reserveExpiresAt: new Date(Date.now() + 2 * 3600000),
      },
    ];
  }
  return db.select().from(leads).orderBy(desc(leads.reserveExpiresAt));
}

export async function updateLeadStage(
  leadId: string,
  stage: "new" | "contacted" | "reserved" | "converted" | "lost",
): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };
    if (!["new", "contacted", "reserved", "converted", "lost"].includes(stage))
      return { ok: false, error: "Invalid lead stage" };

    const [updated] = await db
      .update(leads)
      .set({ stage })
      .where(eq(leads.id, leadId))
      .returning({ id: leads.id });
    if (!updated) return { ok: false, error: "Lead not found" };
    await audit("lead.updated", updated.id, `Stage changed to ${stage}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorOf(error) };
  }
}

const leadItems = (value: string) =>
  value
    .split(/[\n,]/)
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((name) => ({ name }));

export async function createLead(input: LeadInput): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };
    const parsed = leadSchema.safeParse(input);
    if (!parsed.success)
      return {
        ok: false,
        error: parsed.error.issues[0]?.message || "Invalid lead",
      };
    const value = parsed.data;
    const [created] = await db
      .insert(leads)
      .values({
        customerName: value.customerName,
        phone: value.phone || null,
        telegramUserId: value.telegramUserId || null,
        cartItemsJson: leadItems(value.interestedIn),
        stage: value.stage,
        reserveExpiresAt:
          value.reserveExpiresAt instanceof Date
            ? value.reserveExpiresAt
            : null,
      })
      .returning({ id: leads.id });
    await audit(
      "lead.created",
      created.id,
      `Lead created for ${value.customerName}`,
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorOf(error) };
  }
}

export async function updateLead(
  leadId: string,
  input: LeadInput,
): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };
    const parsed = leadSchema.safeParse(input);
    if (!parsed.success)
      return {
        ok: false,
        error: parsed.error.issues[0]?.message || "Invalid lead",
      };
    const value = parsed.data;
    const [updated] = await db
      .update(leads)
      .set({
        customerName: value.customerName,
        phone: value.phone || null,
        telegramUserId: value.telegramUserId || null,
        cartItemsJson: leadItems(value.interestedIn),
        stage: value.stage,
        reserveExpiresAt:
          value.reserveExpiresAt instanceof Date
            ? value.reserveExpiresAt
            : null,
      })
      .where(eq(leads.id, leadId))
      .returning({ id: leads.id });
    if (!updated) return { ok: false, error: "Lead not found" };
    await audit(
      "lead.updated",
      updated.id,
      `Lead details updated for ${value.customerName}`,
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorOf(error) };
  }
}

export async function convertLeadToCustomer(
  leadId: string,
): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };
    let name = "";
    await db.transaction(async (tx) => {
      const [lead] = await tx
        .select()
        .from(leads)
        .where(eq(leads.id, leadId))
        .for("update");
      if (!lead) throw new Error("Lead not found");
      if (!lead.phone)
        throw new Error("Add a phone number before converting this lead");
      name = lead.customerName;
      await tx
        .insert(customers)
        .values({
          name: lead.customerName,
          phone: lead.phone,
          telegramUserId: lead.telegramUserId,
        })
        .onConflictDoUpdate({
          target: customers.phone,
          set: {
            name: lead.customerName,
            telegramUserId:
              lead.telegramUserId || sql`${customers.telegramUserId}`,
            updatedAt: new Date(),
          },
        });
      await tx
        .update(leads)
        .set({ stage: "converted" })
        .where(eq(leads.id, leadId));
    });
    await audit(
      "lead.converted",
      leadId,
      `${name} added to the customer master`,
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorOf(error) };
  }
}

export async function getReceiptSettings() {
  if (!db) {
    return {
      shopName: clientConfig.brand.name,
      address: null,
      phone: clientConfig.payments.kbzPay.account,
      headerMessage: clientConfig.brand.tagline,
      footerMessage:
        "ကျေးဇူးတင်ပါတယ်ခင်ဗျာ။ MH OP ကို ယုံကြည်စွာ ရွေးချယ်ပေးသည့်အတွက် ဝမ်းမြောက်ပါတယ်။",
      paperSize: 80,
      showBarcode: true,
      showQr: true,
    };
  }
  return (await db.select().from(receiptSettings).limit(1))[0];
}

export const updateTicketStatusAction = updateTicketStatus;

