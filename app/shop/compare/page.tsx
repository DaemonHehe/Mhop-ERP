import Link from "next/link";
import Image from "next/image";
import { formatMMK } from "@/lib/data";
import { Logo } from "@/components/logo";
import { getPublicCatalogAction } from "@/app/actions/public";

export const dynamic = "force-dynamic";
export default async function Compare({
  searchParams,
}: {
  searchParams: Promise<{ skus?: string }>;
}) {
  const { skus } = await searchParams;
  const products = await getPublicCatalogAction();
  const normalized =
    skus?.split(",").filter(Boolean) || products.slice(0, 2).map((p) => p.sku);
  const picked = normalized
    .map((sku) => products.find((p) => p.sku === sku))
    .filter(Boolean)
    .slice(0, 3) as typeof products;
  return (
    <main className="min-h-screen p-5 md:p-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <Logo />
          <Link href="/shop" className="pill">
            ← Back to shop
          </Link>
        </div>
        <p className="eyebrow mt-14">Side by side</p>
        <h1 className="display mt-2 text-5xl font-semibold">
          Compare your shortlist.
        </h1>
        {picked.length === 0 ? (
          <div className="card mt-8 p-8 text-sm text-[#77776f]">
            Choose products from the shop before comparing.
          </div>
        ) : (
          <div className="mt-8 overflow-x-auto">
            <div
              className="grid min-w-[720px] gap-3"
              style={{
                gridTemplateColumns: `160px repeat(${picked.length}, minmax(180px,1fr))`,
              }}
            >
              <div />
              {picked.map((p) => (
                <div key={p.sku} className="card overflow-hidden">
                  <div className="relative aspect-video w-full">
                    <Image
                      src={p.image}
                      fill
                      sizes="(max-width: 768px) 220px, 30vw"
                      className="object-cover"
                      alt=""
                      unoptimized={typeof p.image === "string" && p.image.startsWith("/api/media")}
                    />
                  </div>
                  <div className="p-4">
                    <p className="text-xs text-[#77776f]">
                      {p.brand} · {p.subcategory}
                    </p>
                    <h2 className="display text-xl font-bold">{p.name}</h2>
                    <p className="mt-2 text-sm font-bold">
                      {formatMMK(p.price)}
                    </p>
                  </div>
                </div>
              ))}
              {[
                "Color",
                "Warranty",
                ...(picked[0]?.specs.map((s) => s.label) || []),
              ].map((row, ri) => (
                <div className="contents" key={row}>
                  <div className="flex items-center border-b py-4 text-xs font-bold text-[#77776f]">
                    {row}
                  </div>
                  {picked.map((p) => (
                    <div
                      key={p.sku}
                      className="border-b p-4 text-sm font-semibold"
                    >
                      {ri === 0
                        ? p.color || "—"
                        : ri === 1
                          ? `${p.warranty} months`
                          : p.specs[ri - 2]?.value || "—"}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
