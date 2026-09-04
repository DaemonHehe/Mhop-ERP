"use server";
import { unstable_cache } from "next/cache";
import { lookupWarranty } from "@/lib/services/order.service";
import { getPublicCatalog } from "@/lib/services/stock.service";
import { getPublicBundles } from "@/lib/services/bundle.service";
import { allowRequest } from "@/lib/security/rate-limit";
import { warrantyLookupSchema } from "@/lib/validation/schemas";

const loadPublicCommerce = unstable_cache(
  async () => {
    const [products, bundles] = await Promise.all([
      getPublicCatalog(),
      getPublicBundles(),
    ]);
    return { products, bundles };
  },
  ["mh-op-public-commerce"],
  { revalidate: 60, tags: ["public-commerce"] },
);

export async function lookupWarrantyAction(input: {
  orderCode: string;
  phone: string;
}) {
  if (!(await allowRequest("warranty-lookup", 30, 10 * 60_000))) {
    return {
      ok: false as const,
      error:
        "Too many lookup attempts. Please wait a few minutes and try again.",
    };
  }
  const parsed = warrantyLookupSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false as const,
      error: "Enter a valid MH OP order code and phone number.",
    };
  const result = await lookupWarranty(parsed.data.orderCode, parsed.data.phone);
  return result
    ? { ok: true as const, data: result }
    : {
        ok: false as const,
        error:
          "No matching order was found. Check the order code and phone number.",
      };
}

export async function getPublicCatalogAction() {
  return (await loadPublicCommerce()).products;
}

export async function getPublicBundlesAction() {
  return (await loadPublicCommerce()).bundles;
}

export async function getPublicCommerceAction() {
  return loadPublicCommerce();
}
