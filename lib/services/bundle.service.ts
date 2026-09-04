import { and, desc, eq, inArray } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db";
import { bundles, products, productVariants } from "@/db/schema";
import { bundleSchema } from "@/lib/validation/schemas";
import { products as demoProducts } from "@/lib/data";
import { audit } from "./audit.service";
import type { ActionResult } from "./stock.service";

export type BundleInput = z.input<typeof bundleSchema>;
export interface BundleItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  stock: number;
  image: string;
}
export interface BundleSet {
  id: string;
  name: string;
  description: string;
  bundlePrice: number;
  retailValue: number;
  savings: number;
  available: number;
  items: BundleItem[];
}
export type PublicBundleSet = Omit<BundleSet, "available" | "items"> & {
  availability: "available" | "low" | "sold_out";
  items: Omit<BundleItem, "stock">[];
};

export function toPublicBundle(bundle: BundleSet): PublicBundleSet {
  const { available, items, ...publicBundle } = bundle;
  return {
    ...publicBundle,
    availability:
      available < 1 ? "sold_out" : available <= 2 ? "low" : "available",
    items: items.map(({ stock, ...item }) => {
      void stock;
      return item;
    }),
  };
}
type StoredItem = { sku: string; quantity?: number; qty?: number };
const number = (value: string | number) => Number(value);
const lines = (value: unknown): StoredItem[] =>
  Array.isArray(value)
    ? value.filter(
        (x): x is StoredItem =>
          !!x &&
          typeof x === "object" &&
          typeof (x as StoredItem).sku === "string",
      )
    : [];

export async function getBundles(): Promise<BundleSet[]> {
  if (!db) {
    const skus = ["GMS-G8-GALILEO", "MEMO-DL05-RGB", "MD-CHU2-DSP"];
    const items = demoProducts
      .filter((p) => skus.includes(p.sku))
      .map((p) => ({
        sku: p.sku,
        name: p.name,
        quantity: 1,
        unitPrice: p.price,
        stock: p.stock,
        image: p.image,
      }));
    const retailValue = items.reduce((s, x) => s + x.unitPrice, 0);
    return [
      {
        id: "demo-rank-push",
        name: "Rank Push Kit",
        description:
          "Controller, phone cooler, and gaming earbuds for longer competitive sessions.",
        bundlePrice: 359000,
        retailValue,
        savings: Math.max(0, retailValue - 359000),
        available: Math.min(...items.map((x) => x.stock)),
        items,
      },
    ];
  }

  const records = await db
    .select()
    .from(bundles)
    .where(eq(bundles.isActive, true))
    .orderBy(desc(bundles.id));

  const requested = [
    ...new Set(
      records.flatMap((row) => lines(row.itemsJson).map((item) => item.sku)),
    ),
  ];

  const catalog = requested.length
    ? await db
        .select({
          sku: productVariants.sku,
          name: products.name,
          price: productVariants.price,
          stock: productVariants.stockQuantity,
          image: products.imageUrl,
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(
          and(
            inArray(productVariants.sku, requested),
            eq(productVariants.isActive, true),
            eq(products.isActive, true),
          ),
        )
    : [];

  const bySku = new Map(catalog.map((item) => [item.sku, item]));

  return records
    .map((row) => {
      const items = lines(row.itemsJson)
        .map((line) => {
          const item = bySku.get(line.sku);
          const quantity = Number(line.quantity || line.qty || 1);
          return item
            ? {
                sku: item.sku,
                name: item.name,
                quantity,
                unitPrice: number(item.price),
                stock: Number(item.stock),
                image: item.image || "/placeholder.svg",
              }
            : null;
        })
        .filter((item): item is BundleItem => !!item);

      const retailValue = items.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0,
      );
      const bundlePrice = number(row.bundlePrice);

      return {
        id: row.id,
        name: row.name,
        description: row.description || "",
        bundlePrice,
        retailValue,
        savings: Math.max(0, retailValue - bundlePrice),
        available: items.length
          ? Math.min(
              ...items.map((item) => Math.floor(item.stock / item.quantity)),
            )
          : 0,
        items,
      };
    })
    .filter((bundle) => bundle.items.length >= 2);
}

export async function getPublicBundles(): Promise<PublicBundleSet[]> {
  const bundleSets = await getBundles();
  return bundleSets.map(toPublicBundle);
}

async function validateCatalog(input: BundleInput) {
  const parsed = bundleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message || "Invalid bundle",
    };
  }
  if (!db) {
    return { ok: false as const, error: "Database is not configured." };
  }

  const skus = parsed.data.items.map((x) => x.sku);
  const catalog = await db
    .select({ sku: productVariants.sku, price: productVariants.price })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(
      and(
        inArray(productVariants.sku, skus),
        eq(productVariants.isActive, true),
        eq(products.isActive, true),
      ),
    );

  if (catalog.length !== skus.length) {
    return {
      ok: false as const,
      error: "One or more bundle products are unavailable",
    };
  }

  const prices = new Map(catalog.map((x) => [x.sku, number(x.price)]));
  const retail = parsed.data.items.reduce(
    (sum, x) => sum + (prices.get(x.sku) || 0) * x.quantity,
    0,
  );

  if (parsed.data.bundlePrice > retail) {
    return {
      ok: false as const,
      error: "Bundle price cannot exceed the combined retail value",
    };
  }

  return { ok: true as const, data: parsed.data, retail };
}

function failed(error: unknown) {
  const e = error as { code?: string };
  if (error instanceof Error && !e.code) return error.message;
  console.error("[MH OP bundles]", error);
  return "The bundle operation could not be completed. Try again.";
}

export async function createBundle(input: BundleInput): Promise<ActionResult> {
  try {
    const checked = await validateCatalog(input);
    if (!checked.ok) return checked;

    const savings = checked.retail - checked.data.bundlePrice;
    const [created] = await db!
      .insert(bundles)
      .values({
        name: checked.data.name,
        description: checked.data.description || null,
        bundlePrice: String(checked.data.bundlePrice),
        savingsAmount: String(savings),
        itemsJson: checked.data.items,
      })
      .returning({ id: bundles.id });

    await audit(
      "bundle.created",
      created.id,
      `${checked.data.name} created with ${checked.data.items.length} product lines`,
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: failed(error) };
  }
}

export async function updateBundle(
  id: string,
  input: BundleInput,
): Promise<ActionResult> {
  try {
    const checked = await validateCatalog(input);
    if (!checked.ok) return checked;

    const [changed] = await db!
      .update(bundles)
      .set({
        name: checked.data.name,
        description: checked.data.description || null,
        bundlePrice: String(checked.data.bundlePrice),
        savingsAmount: String(checked.retail - checked.data.bundlePrice),
        itemsJson: checked.data.items,
      })
      .where(and(eq(bundles.id, id), eq(bundles.isActive, true)))
      .returning({ id: bundles.id });

    if (!changed) return { ok: false, error: "Bundle not found" };

    await audit("bundle.updated", id, `${checked.data.name} updated`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: failed(error) };
  }
}

export async function deleteBundle(id: string): Promise<ActionResult> {
  try {
    if (!db) return { ok: false, error: "Database is not configured." };

    const [changed] = await db
      .update(bundles)
      .set({ isActive: false })
      .where(and(eq(bundles.id, id), eq(bundles.isActive, true)))
      .returning({ name: bundles.name });

    if (!changed)
      return { ok: false, error: "Bundle not found or already deleted" };

    await audit(
      "bundle.deleted",
      id,
      `${changed.name} removed from the storefront`,
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: failed(error) };
  }
}
