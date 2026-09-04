import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  bundles,
  customers,
  deviceUnits,
  orderBundleSets,
  orderItems,
  orders,
  productVariants,
  products,
  staffAlerts,
} from "@/db/schema";
import { orders as demoOrders } from "@/lib/data";
import {
  calculateOrderShipping,
  clientConfig,
  type ShippingZone,
} from "@/lib/client-config";
import { orderSchema, shipmentSchema } from "@/lib/validation/schemas";
import { audit } from "./audit.service";
import type { ActionResult } from "./stock.service";
import { allocateDiscountedUnits } from "@/lib/order-pricing";
import { evaluateWarrantyPolicy } from "@/lib/warranty-policy";

export interface OperationalOrder {
  id: string;
  orderCode?: string;
  customer: string;
  channel: "Web" | "Telegram" | "POS";
  amount: number;
  payment: "Verified" | "Pending" | "Rejected" | "Refunded";
  fulfillment:
    "New" | "Confirmed" | "Packing" | "Dispatched" | "Delivered" | "Cancelled";
  item: string;
  created: string;
  createdAt?: Date;
  phone?: string;
  address?: string | null;
  trackingNumber?: string | null;
  shippingCarrier?: string | null;
  telegramUserId?: string | null;
  paymentSlipUrl?: string | null;
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

export async function getOrders(): Promise<OperationalOrder[]> {
  if (!db) return demoOrders;

  const rows = await db.select().from(orders).orderBy(desc(orders.createdAt));
  const ids = rows.map((row) => row.id);
  const itemRows = ids.length
    ? await db
        .select({
          orderId: orderItems.orderId,
          name: products.name,
          quantity: orderItems.quantity,
        })
        .from(orderItems)
        .innerJoin(products, eq(products.id, orderItems.productId))
        .where(inArray(orderItems.orderId, ids))
    : [];
  const bundleRows = ids.length
    ? await db
        .select({
          orderId: orderBundleSets.orderId,
          name: orderBundleSets.bundleName,
        })
        .from(orderBundleSets)
        .where(inArray(orderBundleSets.orderId, ids))
    : [];
  const itemLabels = new Map<string, string[]>();
  for (const item of itemRows) {
    const list = itemLabels.get(item.orderId) || [];
    list.push(`${item.quantity > 1 ? `${item.quantity}× ` : ""}${item.name}`);
    itemLabels.set(item.orderId, list);
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
    channel: o.telegramUserId ? ("Telegram" as const) : ("Web" as const),
    amount: num(o.totalAmount),
    payment: title(o.paymentStatus) as OperationalOrder["payment"],
    fulfillment: title(o.fulfillmentStatus) as OperationalOrder["fulfillment"],
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
    paidAmount: order.paymentStatus === "verified" ? num(order.totalAmount) : 0,
    outstandingBalance:
      order.paymentStatus === "verified" ? 0 : num(order.totalAmount),
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

    const skus = String(form.get("skus") || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, 25);
    const bundleIds = String(form.get("bundleIds") || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, 10);
    if (!skus.length && !bundleIds.length) {
      return {
        ok: false,
        error: "Your order does not contain any products or bundles",
      };
    }
    const individualQuantities = new Map<string, number>();
    for (const sku of skus) {
      individualQuantities.set(sku, (individualQuantities.get(sku) || 0) + 1);
    }
    const orderCode = `MHOP-${new Date()
      .toISOString()
      .slice(2, 10)
      .replaceAll("-", "")}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

    const { shippingZone, paymentMethod, ...customer } = parsed.data;

    await db.transaction(async (tx) => {
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
          variantId: productVariants.id,
          sku: productVariants.sku,
          price: productVariants.price,
          cost: productVariants.costPrice,
          stock: productVariants.stockQuantity,
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
        if (quantity < 1 || item.stock < quantity)
          throw new Error(`${item.sku} does not have enough stock`);
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
      const shippingFee = calculateOrderShipping(
        subtotal,
        shippingZone as ShippingZone,
        digitalOnly,
      );
      const total = subtotal + shippingFee;
      const [customerProfile] = await tx
        .insert(customers)
        .values({
          name: customer.customerName,
          phone: customer.phone,
          primaryAddress: digitalOnly ? null : customer.shippingAddress || null,
        })
        .onConflictDoUpdate({
          target: customers.phone,
          set: {
            name: customer.customerName,
            ...(!digitalOnly && customer.shippingAddress
              ? { primaryAddress: customer.shippingAddress }
              : {}),
            isActive: true,
            updatedAt: new Date(),
          },
        })
        .returning({ id: customers.id });
      if (!customerProfile)
        throw new Error("Customer profile could not be saved");
      const [created] = await tx
        .insert(orders)
        .values({
          ...customer,
          customerId: customerProfile.id,
          totalAmount: String(total),
          shippingZone,
          shippingFee: String(shippingFee),
          shippingCarrier: digitalOnly
            ? "Digital handover"
            : clientConfig.shipping.courier,
          paymentMethod,
          orderCode,
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
            const [createdItem] = await tx
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
            if (item.category === "PUBG Accounts") {
              const [account] = await tx
                .select({ id: deviceUnits.id })
                .from(deviceUnits)
                .where(
                  and(
                    eq(deviceUnits.variantId, item.variantId),
                    eq(deviceUnits.status, "in_stock"),
                  ),
                )
                .limit(1)
                .for("update");
              if (!account)
                throw new Error(`${item.sku} has no available account record`);
              await tx
                .update(orderItems)
                .set({ deviceUnitId: account.id })
                .where(eq(orderItems.id, createdItem.id));
              await tx
                .update(deviceUnits)
                .set({ status: "reserved" })
                .where(eq(deviceUnits.id, account.id));
            }
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
    });

    await audit(
      "order.created",
      orderCode,
      `Order created for ${parsed.data.customerName}`,
    );
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

    await db.transaction(async (tx) => {
      const changed = await tx
        .update(orders)
        .set({ paymentStatus: decision })
        .where(eq(orders.id, orderId))
        .returning({ code: orders.orderCode });

      if (!changed[0]) throw new Error("Order not found");

      await tx.insert(staffAlerts).values({
        type: `payment.${decision}`,
        title: `Payment ${decision}`,
        body: `Payment review completed for ${changed[0].code}`,
        targetCode: changed[0].code,
      });
    });

    await audit(`payment.${decision}`, orderId, `Payment marked ${decision}`);
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
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorOf(error) };
  }
}

export async function updateFulfillment(
  orderId: string,
  status: "confirmed" | "packing" | "dispatched" | "delivered" | "cancelled",
): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };

    const updated = await db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          code: orders.orderCode,
          status: orders.fulfillmentStatus,
          deliveredAt: orders.deliveredAt,
        })
        .from(orders)
        .where(eq(orders.id, orderId))
        .for("update");
      if (!current) throw new Error("Order not found");
      if (current.status === "cancelled")
        throw new Error("A cancelled order cannot be reopened");
      if (status === "cancelled") {
        const items = await tx
          .select({
            variantId: orderItems.variantId,
            quantity: orderItems.quantity,
            deviceUnitId: orderItems.deviceUnitId,
          })
          .from(orderItems)
          .where(eq(orderItems.orderId, orderId));
        for (const item of items) {
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

    const [updated] = await db
      .update(orders)
      .set({
        trackingNumber: parsed.data.trackingNumber,
        shippingCarrier: parsed.data.carrier,
        fulfillmentStatus: "dispatched",
      })
      .where(eq(orders.id, orderId))
      .returning({ code: orders.orderCode });

    if (!updated) return { ok: false, error: "Order not found" };

    await audit(
      "order.dispatched",
      updated.code,
      `${parsed.data.carrier}: ${parsed.data.trackingNumber}`,
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorOf(error) };
  }
}
