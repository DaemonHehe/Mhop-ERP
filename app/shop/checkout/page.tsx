import Link from "next/link";
import { Logo } from "@/components/logo";
import { getPublicCommerceAction } from "@/app/actions/public";
import { CheckoutForm } from "./checkout-form";
import { CheckoutSummary } from "./checkout-summary";
export const dynamic = "force-dynamic";
export default async function Checkout({
  searchParams,
}: {
  searchParams: Promise<{ skus?: string; bundleIds?: string }>;
}) {
  const { skus, bundleIds } = await searchParams;
  const { products, bundles } = await getPublicCommerceAction();

  const rawSkus = skus?.split(",").map((s) => s.trim()).filter(Boolean) || [];
  const qtyMap = new Map<string, number>();
  for (const token of rawSkus) {
    const [sku, qtyStr] = token.split(":");
    const cleanSku = (sku || "").trim();
    if (!cleanSku) continue;
    const count = qtyStr ? Math.max(1, parseInt(qtyStr, 10) || 1) : 1;
    qtyMap.set(cleanSku, (qtyMap.get(cleanSku) || 0) + count);
  }

  const selectedItems = Array.from(qtyMap.entries())
    .map(([sku, requestedQty]) => {
      const p = products.find(
        (prod) => prod.sku === sku && prod.availability !== "sold_out",
      );
      if (!p) return null;
      const quantity =
        p.category === "PUBG Accounts" ? 1 : Math.max(1, requestedQty);
      return { product: p, quantity, sku };
    })
    .filter(Boolean) as {
    product: (typeof products)[number];
    quantity: number;
    sku: string;
  }[];

  const selectedBundles = (bundleIds?.split(",") || [])
    .map((id) =>
      bundles.find(
        (bundle) => bundle.id === id && bundle.availability !== "sold_out",
      ),
    )
    .filter(Boolean) as typeof bundles;

  const productsSubtotal = selectedItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );
  const bundlesSubtotal = selectedBundles.reduce(
    (sum, b) => sum + b.bundlePrice,
    0,
  );
  const total = productsSubtotal + bundlesSubtotal;

  const bundleProducts = selectedBundles.flatMap((bundle) =>
    bundle.items
      .map((item) => products.find((p) => p.sku === item.sku))
      .filter(Boolean),
  ) as typeof products;
  const allProducts = [...selectedItems.map((i) => i.product), ...bundleProducts];
  const hasDigital = allProducts.some((p) => p.category === "PUBG Accounts");
  const hasPhysical = allProducts.some((p) => p.category !== "PUBG Accounts");
  const isMixedCart = hasDigital && hasPhysical;
  const digitalOnly = hasDigital && !hasPhysical;
  const empty = selectedItems.length === 0 && selectedBundles.length === 0;

  return (
    <main className="min-h-screen px-3.5 py-4 sm:px-6 sm:py-8 lg:p-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <Logo />
          <Link href="/shop" className="pill text-xs px-3 py-1.5 sm:px-4 sm:py-2">
            ← Continue shopping
          </Link>
        </div>
        {isMixedCart && (
          <div className="mt-6 rounded-2xl border border-[#ffcdbe] bg-[#fff2ee] p-4 sm:p-5 text-xs sm:text-sm text-[#b83814]">
            <p className="font-bold">⚠️ Mixed Cart Detected · ပစ္စည်းအမျိုးအစား ခွဲခြား၍ ဝယ်ယူပေးပါရန်</p>
            <p className="mt-1 leading-relaxed">
              PUBG Accounts (Digital delivery with 100% prepayment) and Physical Gaming Gadgets (Royal Express shipping with 5,000 MMK deposit &amp; COD) cannot be ordered in the same checkout. Please return to shop and checkout digital accounts and physical gadgets separately.
            </p>
          </div>
        )}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-8">
          {/* Mobile Order Summary: placed at top on phone screens */}
          <div className="lg:hidden">
            <CheckoutSummary
              selectedItems={selectedItems}
              selectedBundles={selectedBundles}
              total={total}
              digitalOnly={digitalOnly}
              variant="mobile"
            />
          </div>

          <section>
            <CheckoutForm
              total={total}
              skus={selectedItems.map((item) => `${item.sku}:${item.quantity}`)}
              bundleIds={selectedBundles.map((b) => b.id)}
              disabled={empty || isMixedCart}
              digitalOnly={digitalOnly}
              isMixedCart={isMixedCart}
            />
          </section>

          {/* Desktop Order Summary: sticky right column */}
          <aside className="hidden lg:block">
            <div className="sticky top-8">
              <CheckoutSummary
                selectedItems={selectedItems}
                selectedBundles={selectedBundles}
                total={total}
                digitalOnly={digitalOnly}
                variant="desktop"
              />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
