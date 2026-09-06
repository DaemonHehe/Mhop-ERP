import { and, desc, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db";
import {
  expenses,
  orderItems,
  orders,
  productVariants,
  products,
  purchaseItems,
  purchaseOrders,
  suppliers,
  tickets,
} from "@/db/schema";
import {
  expenseSchema,
  purchaseSchema,
  supplierSchema,
} from "@/lib/validation/schemas";
import { audit } from "./audit.service";
import type { ActionResult } from "./stock.service";

export type SupplierInput = z.input<typeof supplierSchema>;
export type PurchaseInput = z.input<typeof purchaseSchema>;
export type ExpenseInput = z.input<typeof expenseSchema>;
export interface SupplierRecord {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
}
export interface PurchaseRecord {
  id: string;
  code: string;
  supplier: string;
  product: string;
  sku: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  status: string;
  createdAt: Date;
  receivedAt: Date | null;
}
export interface ExpenseRecord {
  id: string;
  code: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  expenseDate: Date;
}
export interface ErpSnapshot {
  mode: "demo" | "database";
  sales: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  inventoryValue: number;
  openPurchases: number;
  warrantyCost: number;
  refunds: number;
}
const num = (value: string | number) => Number(value);
function failure(error: unknown, fallback: string) {
  const e = error as { code?: string };
  if (error instanceof Error && !e.code) return error.message;
  console.error("[MH OP ERP]", error);
  return fallback;
}
function code(prefix: string) {
  return `${prefix}-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
}

export async function getErpSnapshot(): Promise<ErpSnapshot> {
  if (!db)
    return {
      mode: "demo",
      sales: 12_840_000,
      grossProfit: 2_910_000,
      expenses: 730_000,
      netProfit: 2_180_000,
      inventoryValue: 8_742_000,
      openPurchases: 2,
      warrantyCost: 18000,
      refunds: 0,
    };
  const [
    [sales],
    [profit],
    [costs],
    [stock],
    [open],
    [deliveryFees],
    [warranty],
  ] = await Promise.all([
    db
      .select({
        revenue: sql<string>`coalesce(sum(case when ${orders.paymentStatus}='verified' then ${orders.totalAmount} else 0 end),0)`,
      })
      .from(orders),
    db
      .select({
        value: sql<string>`coalesce(sum((${orderItems.unitPrice}-${orderItems.costSnapshot})*${orderItems.quantity}),0)`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(eq(orders.paymentStatus, "verified")),
    db
      .select({ value: sql<string>`coalesce(sum(${expenses.amount}),0)` })
      .from(expenses),
    db
      .select({
        value: sql<string>`coalesce(sum(${productVariants.costPrice}*${productVariants.stockQuantity}),0)`,
      })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(
        and(eq(products.isActive, true), eq(productVariants.isActive, true)),
      ),
    db
      .select({ value: sql<number>`count(*)` })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.status, "ordered")),
    db
      .select({
        revenue: sql<string>`coalesce(sum(case when ${orders.paymentStatus}='verified' then ${orders.shippingFee} else 0 end),0)`,
      })
      .from(orders),
    db
      .select({
        cost: sql<string>`coalesce(sum(${tickets.resolutionCost}),0)`,
        refunds: sql<string>`coalesce(sum(${tickets.refundAmount}),0)`,
      })
      .from(tickets),
  ]);
  const grossProfit = num(profit.value) + num(deliveryFees.revenue),
    expenseTotal = num(costs.value),
    warrantyCost = num(warranty.cost),
    refunds = num(warranty.refunds);
  return {
    mode: "database",
    sales: num(sales.revenue),
    grossProfit,
    expenses: expenseTotal,
    netProfit: grossProfit - expenseTotal - warrantyCost - refunds,
    inventoryValue: num(stock.value),
    openPurchases: Number(open.value),
    warrantyCost,
    refunds,
  };
}
export async function getSuppliers(): Promise<SupplierRecord[]> {
  if (!db) return [];
  return db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      phone: suppliers.phone,
      email: suppliers.email,
      address: suppliers.address,
      notes: suppliers.notes,
    })
    .from(suppliers)
    .where(eq(suppliers.isActive, true))
    .orderBy(suppliers.name);
}
export async function getPurchases(): Promise<PurchaseRecord[]> {
  if (!db) return [];
  const rows = await db
    .select({
      id: purchaseOrders.id,
      code: purchaseOrders.poCode,
      supplier: suppliers.name,
      product: products.name,
      sku: productVariants.sku,
      quantity: purchaseItems.quantity,
      unitCost: purchaseItems.unitCost,
      totalCost: purchaseOrders.totalCost,
      status: purchaseOrders.status,
      createdAt: purchaseOrders.createdAt,
      receivedAt: purchaseOrders.receivedAt,
    })
    .from(purchaseOrders)
    .innerJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
    .innerJoin(
      purchaseItems,
      eq(purchaseItems.purchaseOrderId, purchaseOrders.id),
    )
    .innerJoin(productVariants, eq(productVariants.id, purchaseItems.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .orderBy(desc(purchaseOrders.createdAt));
  return rows.map((r) => ({
    ...r,
    unitCost: num(r.unitCost),
    totalCost: num(r.totalCost),
    quantity: Number(r.quantity),
  }));
}
export async function getExpenses(): Promise<ExpenseRecord[]> {
  if (!db) return [];
  const rows = await db
    .select()
    .from(expenses)
    .orderBy(desc(expenses.expenseDate));
  return rows.map((r) => ({
    id: r.id,
    code: r.expenseCode,
    category: r.category,
    description: r.description,
    amount: num(r.amount),
    paymentMethod: r.paymentMethod,
    expenseDate: r.expenseDate,
  }));
}

export async function createSupplier(
  input: SupplierInput,
): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };
    const parsed = supplierSchema.safeParse(input);
    if (!parsed.success)
      return {
        ok: false,
        error: parsed.error.issues[0]?.message || "Invalid supplier",
      };
    const v = parsed.data;
    const [created] = await db
      .insert(suppliers)
      .values({
        name: v.name,
        phone: v.phone || null,
        email: v.email || null,
        address: v.address || null,
        notes: v.notes || null,
      })
      .returning({ id: suppliers.id });
    await audit("supplier.created", created.id, `Supplier ${v.name} created`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: failure(error, "Could not create supplier.") };
  }
}
export async function updateSupplier(
  id: string,
  input: SupplierInput,
): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };
    const parsed = supplierSchema.safeParse(input);
    if (!parsed.success)
      return {
        ok: false,
        error: parsed.error.issues[0]?.message || "Invalid supplier",
      };
    const v = parsed.data;
    const [changed] = await db
      .update(suppliers)
      .set({
        name: v.name,
        phone: v.phone || null,
        email: v.email || null,
        address: v.address || null,
        notes: v.notes || null,
      })
      .where(and(eq(suppliers.id, id), eq(suppliers.isActive, true)))
      .returning({ id: suppliers.id });
    if (!changed) return { ok: false, error: "Supplier not found" };
    await audit("supplier.updated", id, `Supplier ${v.name} updated`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: failure(error, "Could not update supplier.") };
  }
}
export async function deleteSupplier(id: string): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };
    const [open] = await db
      .select({ id: purchaseOrders.id })
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.supplierId, id),
          eq(purchaseOrders.status, "ordered"),
        ),
      )
      .limit(1);
    if (open)
      return {
        ok: false,
        error: "Receive or cancel this supplier's open purchase orders first.",
      };
    const [changed] = await db
      .update(suppliers)
      .set({ isActive: false })
      .where(eq(suppliers.id, id))
      .returning({ id: suppliers.id });
    if (!changed) return { ok: false, error: "Supplier not found" };
    await audit("supplier.deleted", id, "Supplier archived");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: failure(error, "Could not delete supplier.") };
  }
}

export async function createPurchase(
  input: PurchaseInput,
): Promise<ActionResult<{ code: string }>> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };
    const parsed = purchaseSchema.safeParse(input);
    if (!parsed.success)
      return {
        ok: false,
        error: parsed.error.issues[0]?.message || "Invalid purchase order",
      };
    const v = parsed.data,
      poCode = code("PO"),
      total = v.quantity * v.unitCost;
    await db.transaction(async (tx) => {
      const [supplier] = await tx
        .select({ id: suppliers.id })
        .from(suppliers)
        .where(
          and(eq(suppliers.id, v.supplierId), eq(suppliers.isActive, true)),
        );
      if (!supplier) throw new Error("Select an active supplier");
      const [variant] = await tx
        .select({ id: productVariants.id, category: products.category })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(
          and(
            eq(productVariants.id, v.variantId),
            eq(productVariants.isActive, true),
          ),
        );
      if (!variant) throw new Error("Select an active product");
      if (variant.category === "PUBG Accounts")
        throw new Error(
          "Create each purchased PUBG account as an individual listing in Products & Stock; quantity-based purchase inventory is for gadgets",
        );
      const [po] = await tx
        .insert(purchaseOrders)
        .values({
          poCode,
          supplierId: v.supplierId,
          totalCost: String(total),
          notes: v.notes || null,
        })
        .returning({ id: purchaseOrders.id });
      await tx.insert(purchaseItems).values({
        purchaseOrderId: po.id,
        variantId: v.variantId,
        quantity: v.quantity,
        unitCost: String(v.unitCost),
      });
    });
    await audit(
      "purchase.created",
      poCode,
      `Purchase order created for ${total} MMK`,
    );
    return { ok: true, data: { code: poCode } };
  } catch (error) {
    return {
      ok: false,
      error: failure(error, "Could not create purchase order."),
    };
  }
}
export async function receivePurchase(id: string): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };
    let poCode = "";
    await db.transaction(async (tx) => {
      const [po] = await tx
        .select({ code: purchaseOrders.poCode, status: purchaseOrders.status })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, id))
        .for("update");
      if (!po) throw new Error("Purchase order not found");
      if (po.status !== "ordered")
        throw new Error("Only an ordered purchase can be received");
      const items = await tx
        .select()
        .from(purchaseItems)
        .where(eq(purchaseItems.purchaseOrderId, id));
      for (const item of items)
        await tx
          .update(productVariants)
          .set({
            stockQuantity: sql`${productVariants.stockQuantity}+${item.quantity}`,
            costPrice: item.unitCost,
          })
          .where(
            and(
              eq(productVariants.id, item.variantId),
              eq(productVariants.isActive, true),
            ),
          );
      await tx
        .update(purchaseOrders)
        .set({ status: "received", receivedAt: new Date() })
        .where(eq(purchaseOrders.id, id));
      poCode = po.code;
    });
    await audit(
      "purchase.received",
      poCode,
      "Purchase received and stock increased atomically",
    );
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: failure(error, "Could not receive purchase order."),
    };
  }
}
export async function cancelPurchase(id: string): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };
    const [changed] = await db
      .update(purchaseOrders)
      .set({ status: "cancelled" })
      .where(
        and(eq(purchaseOrders.id, id), eq(purchaseOrders.status, "ordered")),
      )
      .returning({ code: purchaseOrders.poCode });
    if (!changed)
      return { ok: false, error: "Only an ordered purchase can be cancelled" };
    await audit("purchase.cancelled", changed.code, "Purchase order cancelled");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: failure(error, "Could not cancel purchase order."),
    };
  }
}

export async function createExpense(
  input: ExpenseInput,
): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };
    const parsed = expenseSchema.safeParse(input);
    if (!parsed.success)
      return {
        ok: false,
        error: parsed.error.issues[0]?.message || "Invalid expense",
      };
    const v = parsed.data,
      expenseCode = code("EXP");
    await db.insert(expenses).values({
      expenseCode,
      category: v.category,
      description: v.description,
      amount: String(v.amount),
      paymentMethod: v.paymentMethod,
      expenseDate: v.expenseDate,
    });
    await audit(
      "expense.created",
      expenseCode,
      `${v.category}: ${v.amount} MMK`,
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: failure(error, "Could not create expense.") };
  }
}
export async function updateExpense(
  id: string,
  input: ExpenseInput,
): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };
    const parsed = expenseSchema.safeParse(input);
    if (!parsed.success)
      return {
        ok: false,
        error: parsed.error.issues[0]?.message || "Invalid expense",
      };
    const v = parsed.data;
    const [changed] = await db
      .update(expenses)
      .set({
        category: v.category,
        description: v.description,
        amount: String(v.amount),
        paymentMethod: v.paymentMethod,
        expenseDate: v.expenseDate,
      })
      .where(eq(expenses.id, id))
      .returning({ code: expenses.expenseCode });
    if (!changed) return { ok: false, error: "Expense not found" };
    await audit("expense.updated", changed.code, "Expense updated");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: failure(error, "Could not update expense.") };
  }
}
export async function deleteExpense(id: string): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };
    const [changed] = await db
      .delete(expenses)
      .where(eq(expenses.id, id))
      .returning({ code: expenses.expenseCode });
    if (!changed) return { ok: false, error: "Expense not found" };
    await audit("expense.deleted", changed.code, "Expense deleted");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: failure(error, "Could not delete expense.") };
  }
}
