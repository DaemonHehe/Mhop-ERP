import Link from "next/link";
import Image from "next/image";
import { Logo } from "@/components/logo";
import { formatMMK } from "@/lib/data";
import { getPublicCommerceAction } from "@/app/actions/public";
import { CheckoutForm } from "./checkout-form";
export const dynamic = "force-dynamic";
export default async function Checkout({
  searchParams,
}: {
  searchParams: Promise<{ skus?: string; bundleIds?: string }>;
}) {
  const { skus, bundleIds } = await searchParams;
  const { products, bundles } = await getPublicCommerceAction();
  const selected = (skus?.split(",") || [])
    .map((sku) =>
      products.find((p) => p.sku === sku && p.availability !== "sold_out"),
    )
    .filter(Boolean) as typeof products;
  const selectedBundles = (bundleIds?.split(",") || [])
    .map((id) =>
      bundles.find(
        (bundle) => bundle.id === id && bundle.availability !== "sold_out",
      ),
    )
    .filter(Boolean) as typeof bundles;
  const total =
    selected.reduce((sum, p) => sum + p.price, 0) +
    selectedBundles.reduce((sum, b) => sum + b.bundlePrice, 0);
  const bundleProducts = selectedBundles.flatMap((bundle) =>
    bundle.items
      .map((item) => products.find((p) => p.sku === item.sku))
      .filter(Boolean),
  ) as typeof products;
  const allProducts = [...selected, ...bundleProducts],
    digitalOnly =
      allProducts.length > 0 &&
      allProducts.every((p) => p.category === "PUBG Accounts");
  const empty = selected.length === 0 && selectedBundles.length === 0;
  return (
    <main className="min-h-screen p-5 md:p-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <Logo />
          <Link href="/shop" className="pill">
            ← Continue shopping
          </Link>
        </div>
        <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_420px]">
          <section>
            <CheckoutForm
              total={total}
              skus={selected.map((p) => p.sku)}
              bundleIds={selectedBundles.map((b) => b.id)}
              disabled={empty}
              digitalOnly={digitalOnly}
            />
          </section>
          <aside className="card h-fit p-5">
            <p className="eyebrow">Order summary</p>
            <div className="mt-4 space-y-3">
              {selected.map((p) => (
                <div key={p.id} className="flex items-center gap-3">
                  <Image
                    src={p.image}
                    alt=""
                    width={56}
                    height={56}
                    className="h-14 w-14 rounded-xl object-cover"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-bold">{p.name}</p>
                    <p className="text-xs text-[#77776f]">
                      {p.storage || p.color}
                    </p>
                  </div>
                  <p className="text-xs font-bold">{formatMMK(p.price)}</p>
                </div>
              ))}
              {selectedBundles.map((bundle) => (
                <div key={bundle.id} className="rounded-xl bg-[#f1efe8] p-3">
                  <div className="flex justify-between">
                    <p className="text-sm font-bold">{bundle.name}</p>
                    <p className="text-xs font-bold">
                      {formatMMK(bundle.bundlePrice)}
                    </p>
                  </div>
                  <p className="mt-1 text-[10px] text-[#777]">
                    {bundle.items
                      .map((item) => `${item.quantity}× ${item.name}`)
                      .join(" · ")}
                  </p>
                  <p className="mt-1 text-[10px] font-bold text-[#45830d]">
                    Bundle saving {formatMMK(bundle.savings)}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-between border-t pt-5">
              <span className="font-bold">Subtotal</span>
              <span className="display text-xl font-bold">
                {formatMMK(total)}
              </span>
            </div>
            {digitalOnly && (
              <p className="mt-2 text-xs text-[#77776f]">
                Secure digital handover · No delivery fee
              </p>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
