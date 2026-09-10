import { and, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import type { z } from "zod";
import {
  deviceUnits,
  orderItems,
  orders,
  productVariants,
  products,
} from "@/db/schema";
import { products as demoProducts } from "@/lib/data";
import { audit } from "./audit.service";
import { catalogItemSchema } from "@/lib/validation/schemas";

export type ActionResult<T = undefined> =
  { ok: true; data?: T } | { ok: false; error: string };

export interface InventoryItem {
  id: string;
  variantId: string;
  name: string;
  brand: string;
  category: string;
  subcategory: string;
  image: string;
  images?: string[];
  sku: string;
  color: string | null;
  storage: string | null;
  ram: string | null;
  condition: string;
  price: number;
  cost: number;
  stock: number;
  warranty: number;
  tagline: string;
  specs: { label: string; value: string }[];
  description: string;
  lowStockThreshold: number;
  listingStatus?: string;
}

export type PublicAvailability = "available" | "low" | "sold_out";
export type PublicCatalogItem = Omit<
  InventoryItem,
  "cost" | "stock" | "lowStockThreshold" | "condition"
> & { availability: PublicAvailability };

export function toPublicCatalogItem(item: InventoryItem): PublicCatalogItem {
  const {
    cost: _cost,
    stock,
    lowStockThreshold,
    condition: _condition,
    ...publicItem
  } = item;
  void _cost;
  void _condition;
  return {
    ...publicItem,
    availability:
      item.category === "PUBG Accounts"
        ? item.listingStatus === "available" ? "available" : "sold_out"
        : stock < 1 ? "sold_out" : stock <= lowStockThreshold ? "low" : "available",
  };
}

export type CatalogItemInput = z.input<typeof catalogItemSchema>;

const internalCondition = (category: "Gaming Gadgets" | "PUBG Accounts") =>
  category === "PUBG Accounts"
    ? "Verified Digital Account"
    : "Brand New Sealed";

const errorOf = (error: unknown) => {
  if (error instanceof Error && !(error as Error & { code?: string }).code)
    return error.message;
  console.error("[MH OP stock operation]", error);
  return "The stock operation could not be completed. Try again.";
};

const num = (value: string | number) => Number(value);

export async function getDashboardSnapshot() {
  if (!db) {
    return {
      mode: "demo" as const,
      revenue: 12_840_000,
      grossProfit: 2_910_000,
      orders: 18,
      stock: 127,
      lowStock: demoProducts.filter((p) => p.stock <= 3).length,
    };
  }

  const [[orderStats], [stockStats], [profitStats]] = await Promise.all([
    db
      .select({
        revenue: sql<string>`coalesce(sum(case when ${orders.paymentStatus}='verified' then ${orders.totalAmount} else 0 end),0)`,
        count: sql<number>`count(*)`,
      })
      .from(orders),
    db
      .select({
        stock: sql<number>`coalesce(sum(${productVariants.stockQuantity}),0)`,
        low: sql<number>`count(*) filter (where ${productVariants.stockQuantity} <= ${productVariants.lowStockThreshold})`,
      })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(
        and(eq(products.isActive, true), eq(productVariants.isActive, true), eq(products.category, "Gaming Gadgets")),
      ),
    db
      .select({
        profit: sql<string>`coalesce(sum((${orderItems.unitPrice}-${orderItems.costSnapshot})*${orderItems.quantity}),0)`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(eq(orders.paymentStatus, "verified")),
  ]);

  return {
    mode: "database" as const,
    revenue: num(orderStats.revenue),
    grossProfit: num(profitStats.profit),
    orders: Number(orderStats.count),
    stock: Number(stockStats.stock),
    lowStock: Number(stockStats.low),
  };
}

export async function getInventory(): Promise<InventoryItem[]> {
  if (!db) {
    return demoProducts.map((p) => ({
      ...p,
      variantId: p.id,
      listingStatus: "available",
      color: p.color || null,
      storage: p.storage || null,
      ram: p.ram || null,
      description: p.tagline,
      lowStockThreshold: 3,
    }));
  }

  const rows = await db
    .select({
      id: products.id,
      variantId: productVariants.id,
      name: products.name,
      brand: products.brand,
      category: products.category,
      subcategory: products.subcategory,
      image: products.imageUrl,
      imageUrls: products.imageUrls,
      sku: productVariants.sku,
      color: productVariants.color,
      storage: productVariants.storage,
      ram: productVariants.ram,
      condition: productVariants.condition,
      price: productVariants.price,
      cost: productVariants.costPrice,
      stock: productVariants.stockQuantity,
      listingStatus: productVariants.listingStatus,
      warranty: productVariants.warrantyMonths,
      description: products.description,
      lowStockThreshold: productVariants.lowStockThreshold,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(
      and(eq(products.isActive, true), eq(productVariants.isActive, true)),
    );

  return rows.map((r) => {
    const primaryImage =
      r.image ||
      (Array.isArray(r.imageUrls) && (r.imageUrls as string[])[0]) ||
      "/placeholder.svg";
    const allImages =
      Array.isArray(r.imageUrls) && r.imageUrls.length > 0
        ? (r.imageUrls as string[])
        : primaryImage && primaryImage !== "/placeholder.svg"
          ? [primaryImage]
          : [];
    return {
      ...r,
      image: primaryImage,
      images: allImages,
      price: num(r.price),
      cost: num(r.cost),
      tagline: `${r.brand} ${r.category}`,
      specs: [],
      description: r.description || "",
      lowStockThreshold: Number(r.lowStockThreshold),
      stock: Number(r.stock),
      warranty: Number(r.warranty),
    };
  });
}

export async function getPublicCatalog(): Promise<PublicCatalogItem[]> {
  const inventory = await getInventory();
  return inventory.map(toPublicCatalogItem);
}

function mutationError(error: unknown, fallback: string) {
  const candidate = error as { code?: string; constraint?: string };
  if (candidate?.code === "23505")
    return candidate.constraint?.includes("sku")
      ? "That SKU already exists."
      : "That account identifier already exists.";
  if (candidate?.code === "23503")
    return "This record is used by another operation and cannot be deleted.";
  console.error("[MH OP stock mutation]", error);
  return fallback;
}

export async function createCatalogItem(
  input: CatalogItemInput,
): Promise<ActionResult<{ variantId: string }>> {
  try {
    if (!db)
      return {
        ok: false,
        error: "Database is not configured. Add DATABASE_URL to .env.local.",
      };
    const parsed = catalogItemSchema.safeParse(input);
    if (!parsed.success)
      return {
        ok: false,
        error: parsed.error.issues[0]?.message || "Invalid product details",
      };
    const value = parsed.data;
    if (value.category === "PUBG Accounts" && value.listingStatus === "reserved")
      return { ok: false, error: "Only an order can reserve a listing" };
    const primaryImg =
      value.imageUrl ||
      (value.imageUrls && value.imageUrls[0]) ||
      null;
    const allImgs =
      value.imageUrls && value.imageUrls.length > 0
        ? value.imageUrls
        : primaryImg
          ? [primaryImg]
          : [];
    const variantId = await db.transaction(async (tx) => {
      const [product] = await tx
        .insert(products)
        .values({
          name: value.name,
          brand: value.brand,
          category: value.category,
          subcategory: value.subcategory,
          description: value.description || null,
          imageUrl: primaryImg,
          imageUrls: allImgs,
          baseCost: String(value.costPrice),
        })
        .returning({ id: products.id });
      const [variant] = await tx
        .insert(productVariants)
        .values({
          productId: product.id,
          sku: value.sku,
          color: value.color || null,
          condition: internalCondition(value.category),
          price: String(value.price),
          costPrice: String(value.costPrice),
          warrantyMonths: value.warrantyMonths,
          stockQuantity:
            value.category === "PUBG Accounts" ? 0 : value.stockQuantity,
          lowStockThreshold: value.category === "PUBG Accounts" ? 0 : value.lowStockThreshold,
          listingStatus: value.listingStatus,
        })
        .returning({ id: productVariants.id });
      return variant.id;
    });
    await audit(
      "catalog.created",
      value.sku,
      `${value.category} listing created`,
    );
    return { ok: true, data: { variantId } };
  } catch (error) {
    return {
      ok: false,
      error: mutationError(error, "Could not create the listing. Try again."),
    };
  }
}

export async function updateCatalogItem(
  variantId: string,
  input: CatalogItemInput,
): Promise<ActionResult> {
  try {
    if (!db)
      return {
        ok: false,
        error: "Database is not configured. Add DATABASE_URL to .env.local.",
      };
    const parsed = catalogItemSchema.safeParse(input);
    if (!parsed.success)
      return {
        ok: false,
        error: parsed.error.issues[0]?.message || "Invalid product details",
      };
    const value = parsed.data;
    await db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          productId: productVariants.productId,
          category: products.category,
          listingStatus: productVariants.listingStatus,
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(
          and(
            eq(productVariants.id, variantId),
            eq(productVariants.isActive, true),
          ),
        )
        .for("update");
      if (!current) throw new Error("Listing not found");
      if (current.category === "PUBG Accounts" &&
          ((current.listingStatus === "reserved" && value.listingStatus !== "reserved") ||
           (current.listingStatus !== "reserved" && value.listingStatus === "reserved")))
        throw new Error("Reserved listing status is managed by its order");
      if (current.category !== value.category)
        throw new Error("A listing category cannot be changed after creation");
      const primaryImg =
        value.imageUrl ||
        (value.imageUrls && value.imageUrls[0]) ||
        null;
      const allImgs =
        value.imageUrls && value.imageUrls.length > 0
          ? value.imageUrls
          : primaryImg
            ? [primaryImg]
            : [];
      await tx
        .update(products)
        .set({
          name: value.name,
          brand: value.brand,
          subcategory: value.subcategory,
          description: value.description || null,
          imageUrl: primaryImg,
          imageUrls: allImgs,
          baseCost: String(value.costPrice),
        })
        .where(eq(products.id, current.productId));
      await tx
        .update(productVariants)
        .set({
          sku: value.sku,
          color: value.color || null,
          condition: internalCondition(value.category),
          price: String(value.price),
          costPrice: String(value.costPrice),
          warrantyMonths: value.warrantyMonths,
          stockQuantity:
            value.category === "PUBG Accounts"
              ? 0
              : value.stockQuantity,
          lowStockThreshold: value.category === "PUBG Accounts" ? 0 : value.lowStockThreshold,
          listingStatus: value.listingStatus,
        })
        .where(eq(productVariants.id, variantId));
    });
    await audit("catalog.updated", value.sku, "Listing details updated");
    return { ok: true };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("category") ||
        error.message.includes("not found"))
    )
      return { ok: false, error: error.message };
    return {
      ok: false,
      error: mutationError(error, "Could not update the listing. Try again."),
    };
  }
}

export async function deleteCatalogItem(
  variantId: string,
): Promise<ActionResult> {
  try {
    if (!db)
      return {
        ok: false,
        error: "Database is not configured. Add DATABASE_URL to .env.local.",
      };
    const [updated] = await db
      .update(productVariants)
      .set({ isActive: false })
      .where(
        and(
          eq(productVariants.id, variantId),
          eq(productVariants.isActive, true),
        ),
      )
      .returning({ sku: productVariants.sku });
    if (!updated)
      return { ok: false, error: "Listing not found or already deleted." };
    await audit(
      "catalog.deleted",
      updated.sku,
      "Listing removed from all sales surfaces",
    );
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: mutationError(error, "Could not delete the listing. Try again."),
    };
  }
}

export async function adjustStock(
  variantId: string,
  delta: number,
): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };
    if (!Number.isInteger(delta) || Math.abs(delta) > 10000) {
      return { ok: false, error: "Invalid stock adjustment" };
    }

    const [catalog] = await db
      .select({ category: products.category })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(eq(productVariants.id, variantId))
      .limit(1);
    if (!catalog) return { ok: false, error: "Variant not found" };
    if (catalog.category === "PUBG Accounts")
      return {
        ok: false,
        error: "PUBG resale listings have sale statuses, not stock quantities.",
      };

    const [updated] = await db
      .update(productVariants)
      .set({
        stockQuantity: sql`greatest(0, ${productVariants.stockQuantity} + ${delta})`,
      })
      .where(eq(productVariants.id, variantId))
      .returning({
        sku: productVariants.sku,
        stock: productVariants.stockQuantity,
      });

    if (!updated) return { ok: false, error: "Variant not found" };

    await audit(
      "inventory.adjusted",
      updated.sku,
      `Stock changed by ${delta}; new quantity ${updated.stock}`,
    );

    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorOf(error) };
  }
}

export async function assignDeviceToOrder(
  orderItemId: string,
  deviceUnitId: string,
): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };

    await db.transaction(async (tx) => {
      const [item] = await tx
        .select({
          orderId: orderItems.orderId,
          variantId: orderItems.variantId,
          deviceUnitId: orderItems.deviceUnitId,
        })
        .from(orderItems)
        .where(eq(orderItems.id, orderItemId))
        .for("update");
      if (!item || item.deviceUnitId) {
        throw new Error(
          "Order item was not found or already has an assigned unit",
        );
      }

      const [order] = await tx
        .select({
          paymentStatus: orders.paymentStatus,
          fulfillmentStatus: orders.fulfillmentStatus,
        })
        .from(orders)
        .where(eq(orders.id, item.orderId))
        .for("update");
      if (!order) throw new Error("Order not found");
      if (order.paymentStatus !== "verified")
        throw new Error("Approve the payment before assigning stock");
      if (order.fulfillmentStatus !== "packing")
        throw new Error("Stock can only be assigned while an order is packing");

      const [unit] = await tx
        .select()
        .from(deviceUnits)
        .where(
          and(
            eq(deviceUnits.id, deviceUnitId),
            eq(deviceUnits.status, "in_stock"),
          ),
        )
        .for("update");
      if (!unit) throw new Error("Device is unavailable or already assigned");
      if (unit.variantId !== item.variantId)
        throw new Error("The selected unit does not match this order item");

      const [listing] = await tx.select({ category: products.category }).from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(eq(productVariants.id, item.variantId));
      if (listing?.category === "PUBG Accounts")
        throw new Error("PUBG sales use the listed player account; no stocked unit is assigned");

      await tx
        .update(orderItems)
        .set({ deviceUnitId })
        .where(eq(orderItems.id, orderItemId));
      await tx
        .update(deviceUnits)
        .set({ status: "reserved" })
        .where(eq(deviceUnits.id, deviceUnitId));
    });

    await audit(
      "device.assigned",
      deviceUnitId,
      `Assigned to order item ${orderItemId}`,
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorOf(error) };
  }
}

export async function assignDeviceByIdentifier(
  orderId: string,
  identifier: string,
): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };

    const clean = identifier.trim();
    if (clean.length < 3 || clean.length > 120) {
      return {
        ok: false,
        error: "Enter a valid serial or IMEI",
      };
    }

    let assignedCode = "";

    await db.transaction(async (tx) => {
      const [currentOrder] = await tx
        .select({
          code: orders.orderCode,
          paymentStatus: orders.paymentStatus,
          fulfillmentStatus: orders.fulfillmentStatus,
        })
        .from(orders)
        .where(eq(orders.id, orderId))
        .for("update");
      if (!currentOrder) throw new Error("Order not found");
      if (currentOrder.paymentStatus !== "verified")
        throw new Error("Approve the payment before assigning stock");
      if (currentOrder.fulfillmentStatus !== "packing")
        throw new Error("Stock can only be assigned while an order is packing");

      const [unit] = await tx
        .select()
        .from(deviceUnits)
        .where(
          and(
            or(
              eq(deviceUnits.serialNumber, clean),
              eq(deviceUnits.imeiNumber, clean),
            ),
            eq(deviceUnits.status, "in_stock"),
          ),
        )
        .for("update");

      if (!unit) {
        throw new Error("No available physical unit matches that identifier");
      }

      const [item] = await tx
        .select()
        .from(orderItems)
        .where(
          and(
            eq(orderItems.orderId, orderId),
            eq(orderItems.variantId, unit.variantId),
            isNull(orderItems.deviceUnitId),
          ),
        )
        .limit(1)
        .for("update");

      if (!item) {
        throw new Error(
          "This unit variant does not match an unassigned order item",
        );
      }

      const [listing] = await tx.select({ category: products.category }).from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(eq(productVariants.id, item.variantId));
      if (listing?.category === "PUBG Accounts")
        throw new Error("PUBG sales use the listed player account; no stocked unit is assigned");

      await tx
        .update(orderItems)
        .set({ deviceUnitId: unit.id })
        .where(eq(orderItems.id, item.id));

      await tx
        .update(deviceUnits)
        .set({ status: "reserved" })
        .where(eq(deviceUnits.id, unit.id));

      assignedCode = currentOrder.code;
    });

    await audit(
      "device.assigned",
      assignedCode,
      `Assigned identifier ${clean}`,
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorOf(error) };
  }
}
