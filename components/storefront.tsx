"use client";
import { brandAssets } from "@/lib/brand-assets";
import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatMMK } from "@/lib/data";
import type { PublicCatalogItem } from "@/lib/services/stock.service";
import type { PublicBundleSet } from "@/lib/services/bundle.service";
import { Logo } from "./logo";
import {
  Search,
  ShoppingBag,
  ArrowRight,
  Check,
  Plus,
  Minus,
  Trash2,
  X,
  Camera,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { ModalPortal } from "@/components/modal-portal";
import { clientConfig } from "@/lib/client-config";

const departments = ["All", "PUBG Accounts", "Gaming Gadgets"] as const;
const gadgetTypes = [
  "All gadgets",
  "Gaming Headphones",
  "Cooling Fans",
  "Controllers",
  "Charging Gear",
  "Gaming Earbuds",
] as const;
const accountTypes = [
  "All accounts",
  "Starter Accounts",
  "Competitive Accounts",
  "Collector Accounts",
] as const;

export function Storefront({
  products,
  bundles,
}: {
  products: PublicCatalogItem[];
  bundles: PublicBundleSet[];
}) {
  const [department, setDepartment] =
    useState<(typeof departments)[number]>("All");
  const [gadgetType, setGadgetType] =
    useState<(typeof gadgetTypes)[number]>("All gadgets");
  const [accountType, setAccountType] =
    useState<(typeof accountTypes)[number]>("All accounts");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [compare, setCompare] = useState<string[]>([]);
  const [galleryModal, setGalleryModal] = useState<{
    title: string;
    images: string[];
    activeIndex: number;
  } | null>(null);

  const totalCartCount = useMemo(
    () => Object.values(cart).reduce((sum, qty) => sum + qty, 0),
    [cart],
  );

  const cartSubtotal = useMemo(() => {
    return Object.entries(cart).reduce((sum, [sku, qty]) => {
      const p = products.find((prod) => prod.sku === sku);
      return sum + (p ? p.price * qty : 0);
    }, 0);
  }, [cart, products]);

  const checkoutQuery = useMemo(() => {
    return Object.entries(cart)
      .map(([sku, qty]) => `${sku}:${qty}`)
      .join(",");
  }, [cart]);

  const getProductQty = (sku: string) => cart[sku] || 0;

  const updateCartQty = (sku: string, delta: number, maxQty: number = 20) => {
    setCart((prev) => {
      const current = prev[sku] || 0;
      const nextQty = current + delta;
      if (nextQty <= 0) {
        const next = { ...prev };
        delete next[sku];
        return next;
      }
      return {
        ...prev,
        [sku]: Math.min(nextQty, maxQty),
      };
    });
  };

  const removeFromCart = (sku: string) => {
    setCart((prev) => {
      const next = { ...prev };
      delete next[sku];
      return next;
    });
  };

  const cartProducts = useMemo(() => {
    return Object.entries(cart)
      .map(([sku, qty]) => {
        const p = products.find((prod) => prod.sku === sku);
        return p ? { product: p, quantity: qty } : null;
      })
      .filter(Boolean) as { product: PublicCatalogItem; quantity: number }[];
  }, [cart, products]);

  const hasDigitalInCart = cartProducts.some(
    (i) => i.product.category === "PUBG Accounts",
  );
  const hasPhysicalInCart = cartProducts.some(
    (i) => i.product.category !== "PUBG Accounts",
  );
  const isCartMixed = hasDigitalInCart && hasPhysicalInCart;

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        const matchesDept = department === "All" || p.category === department;
        const matchesGadget =
          department !== "Gaming Gadgets" ||
          gadgetType === "All gadgets" ||
          p.subcategory === gadgetType;
        const matchesAccount =
          department !== "PUBG Accounts" ||
          accountType === "All accounts" ||
          p.subcategory === accountType;
        const matchesQuery =
          `${p.name} ${p.brand} ${p.subcategory} ${p.tagline}`
            .toLowerCase()
            .includes(query.toLowerCase());
        return matchesDept && matchesGadget && matchesAccount && matchesQuery;
      }),
    [products, department, gadgetType, accountType, query],
  );

  return (
    <div className="min-h-screen bg-[#f4f2ec]">
      {totalCartCount > 0 && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCartDrawerOpen(true)}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/95 backdrop-blur-md px-4 py-3 text-xs font-bold text-black shadow-2xl hover:bg-white transition active:scale-95"
          >
            <ShoppingBag size={14} />
            <span>Bag ({totalCartCount})</span>
          </button>
          <Link
            href={`/shop/checkout?skus=${checkoutQuery}`}
            className="flex items-center gap-2 rounded-full bg-[#c7f36b] px-5 py-3 text-xs font-black text-black shadow-2xl hover:bg-[#b8e858] transition active:scale-95"
          >
            <span>
              Checkout {totalCartCount} item{totalCartCount > 1 ? "s" : ""} · {formatMMK(cartSubtotal)}
            </span>
            <ArrowRight size={14} />
          </Link>
        </div>
      )}
      <header className="sticky top-0 z-40 border-b border-[#dcd9cf] bg-[#f4f2ec]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <Logo />
          <nav className="hidden gap-7 text-sm font-semibold md:flex">
            <Link href="/shop">Shop</Link>
            <a href="#products">Products</a>
            <a href="#bundles">Bundles</a>
            <Link href="/warranty">Warranty</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/warranty"
              className="rounded-full border border-[#dcd9cf] bg-white/65 px-3 py-2 text-[11px] font-bold md:hidden"
            >
              Warranty
            </Link>
            <button
              type="button"
              aria-label="Open shopping bag"
              onClick={() => setCartDrawerOpen(true)}
              className="relative grid h-10 w-10 place-items-center rounded-full bg-black text-white hover:bg-neutral-800 transition active:scale-95"
            >
              <ShoppingBag size={17} />
              {totalCartCount > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#ff6b35] px-1 text-[10px] font-black text-white shadow-xs">
                  {totalCartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-5 pb-10 pt-12 md:pt-20">
        <p className="eyebrow">{clientConfig.brand.fullName}</p>
        <div className="mt-3 grid gap-6 md:grid-cols-[1fr_.45fr] md:items-end">
          <h1 className="display max-w-4xl text-5xl font-semibold leading-[.95] md:text-7xl">
            Play better.
            <br />
            <span className="text-[#77776f]">Shop with confidence.</span>
          </h1>
          <div>
            <div className="space-y-2.5 text-xs sm:text-sm leading-relaxed text-[#5c5d57]">
              <p className="font-semibold text-black">
                100% မူရင်းပစ္စည်းများ • Official Store မှ တိုက်ရိုက်ရရှိသော ပစ္စည်းများ
              </p>
              <p>
                PUBG Mobile Verified Accounts များနှင့် Gaming Gadgets များကို မြန်မာ Gamer များအတွက် သေချာရွေးချယ်ပေးထားပါတယ်။
              </p>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 rounded-xl bg-[#f5f4ed] p-2.5 text-[11px] font-medium text-neutral-800 border border-[#e5e2d8]">
                <span>🎮 PUBG Mobile Accounts</span>
                <span>❄️ Cooling Fans</span>
                <span>🎧 Gaming Headphones & Earphones</span>
                <span>🎮 Controllers & Gaming Accessories</span>
              </div>
              <p className="text-[11px] text-[#77776f]">
                စသည့်ပစ္စည်းများကို ယုံကြည်စိတ်ချစွာ ဝယ်ယူနိုင်ပါတယ်။
              </p>
            </div>
            <a
              href="#products"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#c7f36b] px-5 py-3 text-xs font-bold text-black"
            >
              ပစ္စည်းများ ကြည့်ရှုမယ် <ArrowRight size={15} />
            </a>
          </div>
        </div>
        <div className="relative mt-8 aspect-[16/7] w-full overflow-hidden rounded-[26px] border border-[#ddd9ce] shadow-xl md:aspect-[2.6/1]">
          <Image
            src={brandAssets.store}
            alt="MH OP Minimalist Flagship Store & Showroom"
            fill
            priority
            sizes="(max-width: 1280px) 100vw, 1280px"
            className="object-cover"
          />
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/85 via-black/30 to-transparent p-5 sm:p-8 md:p-10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ff6b35] px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white">
                Official Store Direct
              </span>
              <span className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-[10px] font-bold text-white backdrop-blur-md">
                100% Authentic Warranty
              </span>
            </div>
            <h2 className="mt-2 text-lg font-bold text-white sm:text-xl md:text-2xl">
              MH OP Mobile Gaming Experience & Hardware Boutique
            </h2>
            <p className="mt-0.5 text-xs text-white/75 sm:text-sm">
              Premium cooling tech, esports accessories & instant digital account transfers
            </p>
          </div>
        </div>
      </section>
      <section id="products" className="mx-auto max-w-7xl px-5">
        <div className="space-y-4">
          <div className="rounded-[24px] border border-white/80 bg-white/65 p-2 shadow-[8px_10px_24px_rgba(72,70,58,0.10),-6px_-6px_18px_rgba(255,255,255,0.85)] backdrop-blur-xl">
            <label className="flex min-h-14 items-center gap-3 rounded-[18px] bg-[#f7f6f1] px-3 sm:px-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[#55584f] shadow-sm">
                <Search size={16} />
              </span>
              <span className="sr-only">Search the MH OP shop</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="What are you looking for?"
                className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-[#8b8d85]"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear shop search"
                  onClick={() => setQuery("")}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#666960] hover:bg-white"
                >
                  <X size={15} />
                </button>
              )}
            </label>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {departments.map((category) => (
                <button
                  onClick={() => {
                    setDepartment(category);
                    setGadgetType("All gadgets");
                    setAccountType("All accounts");
                  }}
                  key={category}
                  className={`whitespace-nowrap rounded-full px-4 py-2.5 text-xs font-bold transition ${department === category ? "bg-black text-white shadow-md" : "border border-[#dedbd1] bg-white/65 text-[#5e6158]"}`}
                >
                  {category}
                </button>
              ))}
            </div>
            <p className="shrink-0 text-[11px] font-semibold text-[#777a71]">
              {filtered.length} result{filtered.length === 1 ? "" : "s"}
            </p>
          </div>
          {department === "Gaming Gadgets" && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {gadgetTypes.map((type) => (
                <button
                  onClick={() => setGadgetType(type)}
                  key={type}
                  className={`whitespace-nowrap rounded-full px-3 py-2 text-[11px] font-bold ${gadgetType === type ? "bg-[#c7f36b]" : "bg-[#f1efe8]"}`}
                >
                  {type}
                </button>
              ))}
            </div>
          )}
          {department === "PUBG Accounts" && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {accountTypes.map((type) => (
                <button
                  onClick={() => setAccountType(type)}
                  key={type}
                  className={`whitespace-nowrap rounded-full px-3 py-2 text-[11px] font-bold ${accountType === type ? "bg-[#c7f36b]" : "bg-[#f1efe8]"}`}
                >
                  {type}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-4 px-5 py-7 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p, index) => (
          <article
            key={p.variantId}
            className="group overflow-hidden rounded-[22px] border border-[#ddd9ce] bg-[#fffef9]"
          >
            <div
              className={`relative aspect-[4/3] overflow-hidden bg-[#e8e6df] ${
                p.images && p.images.length > 1 ? "cursor-pointer" : ""
              }`}
              onClick={() => {
                if (p.images && p.images.length > 1) {
                  setGalleryModal({
                    title: p.name,
                    images: p.images,
                    activeIndex: 0,
                  });
                }
              }}
            >
              <Image
                src={p.image}
                alt={p.name}
                fill
                priority={index < 2}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                unoptimized={typeof p.image === "string" && p.image.startsWith("/api/media")}
              />
              {p.images && p.images.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setGalleryModal({
                      title: p.name,
                      images: p.images!,
                      activeIndex: 0,
                    });
                  }}
                  className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-black/75 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs backdrop-blur-md hover:bg-black transition"
                >
                  <Camera size={12} /> {p.images.length} photos
                </button>
              )}
              <button
                aria-label={`${compare.includes(p.sku) ? "Remove" : "Add"} ${p.name} ${compare.includes(p.sku) ? "from" : "to"} comparison`}
                onClick={() =>
                  setCompare((x) =>
                    x.includes(p.sku)
                      ? x.filter((i) => i !== p.sku)
                      : x.length < 3
                        ? [...x, p.sku]
                        : x,
                  )
                }
                className={`absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full ${compare.includes(p.sku) ? "bg-[#c7f36b]" : "bg-white/90"}`}
              >
                {compare.includes(p.sku) ? (
                  <Check size={16} />
                ) : (
                  <Plus size={16} />
                )}
              </button>
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">
                    {p.brand} · {p.subcategory}
                  </p>
                  <h2 className="display mt-1 text-2xl font-semibold">
                    {p.name}
                  </h2>
                </div>
                <span
                  className={`pill ${p.availability === "sold_out" ? "bg-[#f1f0eb] text-[#73766d]" : p.availability === "low" ? "bg-[#fff1ec] text-[#a84422]" : "bg-[#effbdc] text-[#416c17]"}`}
                >
                  {p.availability === "sold_out"
                    ? "Sold out"
                    : p.availability === "low"
                      ? "Only a few left"
                      : "Available"}
                </span>
              </div>
              <p className="mt-2 text-sm text-[#77776f]">{p.tagline}</p>
              {p.specs.length > 0 && (
                <div className="mt-5 grid grid-cols-3 gap-2">
                  {p.specs.map((s) => (
                    <div
                      key={s.label}
                      className="rounded-xl bg-[#f1efe8] p-2.5"
                    >
                      <p className="text-[9px] font-bold uppercase tracking-wider text-[#888]">
                        {s.label}
                      </p>
                      <p className="mt-1 text-xs font-bold">{s.value}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-5 flex items-end justify-between gap-2">
                <div>
                  <p className="text-[10px] text-[#888]">
                    {getProductQty(p.sku) > 1
                      ? `${getProductQty(p.sku)} × ${formatMMK(p.price)}`
                      : "From"}
                  </p>
                  <p className="display text-xl font-bold">
                    {formatMMK(
                      getProductQty(p.sku) > 1
                        ? p.price * getProductQty(p.sku)
                        : p.price,
                    )}
                  </p>
                </div>

                {p.availability === "sold_out" ? (
                  <span className="rounded-full bg-[#f1f0eb] px-4 py-2.5 text-xs font-bold text-[#888]">
                    Sold out
                  </span>
                ) : p.category === "PUBG Accounts" ? (
                  getProductQty(p.sku) > 0 ? (
                    <button
                      type="button"
                      onClick={() => removeFromCart(p.sku)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#376911] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#2b520d] transition active:scale-95"
                    >
                      <Check size={13} />
                      <span>In bag</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => updateCartQty(p.sku, 1, 1)}
                      className="rounded-full bg-black px-4 py-2.5 text-xs font-bold text-white hover:bg-neutral-800 transition active:scale-95"
                    >
                      Add to bag
                    </button>
                  )
                ) : (
                  getProductQty(p.sku) > 0 ? (
                    <div className="flex items-center gap-1 rounded-full border border-[#dcd9cf] bg-white p-1 shadow-xs">
                      <button
                        type="button"
                        aria-label={`Decrease quantity of ${p.name}`}
                        onClick={() => updateCartQty(p.sku, -1)}
                        className="grid h-7 w-7 place-items-center rounded-full bg-[#f1efe8] text-black hover:bg-[#e4e1d7] active:scale-95 transition"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="min-w-6 text-center text-xs font-black">
                        {getProductQty(p.sku)}
                      </span>
                      <button
                        type="button"
                        aria-label={`Increase quantity of ${p.name}`}
                        disabled={getProductQty(p.sku) >= 20}
                        onClick={() => updateCartQty(p.sku, 1, 20)}
                        className="grid h-7 w-7 place-items-center rounded-full bg-black text-white hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => updateCartQty(p.sku, 1, 20)}
                      className="rounded-full bg-black px-4 py-2.5 text-xs font-bold text-white hover:bg-neutral-800 transition active:scale-95"
                    >
                      Add to bag
                    </button>
                  )
                )}
              </div>
            </div>
          </article>
        ))}
        {!filtered.length && (
          <div className="rounded-[24px] border border-dashed border-[#d6d2c7] bg-white/45 px-6 py-14 text-center sm:col-span-2 lg:col-span-3">
            <p className="display text-xl font-bold">No products found</p>
            <p className="mt-2 text-sm text-[#777a71]">
              Try a different search or browse all products.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setDepartment("All");
                setGadgetType("All gadgets");
                setAccountType("All accounts");
              }}
              className="mt-5 rounded-full bg-black px-5 py-2.5 text-xs font-bold text-white"
            >
              Show all products
            </button>
          </div>
        )}
      </section>
      {bundles.length > 0 && (
        <section id="bundles" className="mx-auto mb-14 max-w-7xl px-5">
          <div className="mb-5">
            <p className="eyebrow">Better together</p>
            <h2 className="display mt-2 text-4xl font-semibold">Bundle Sets</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {bundles.map((bundle) => (
              <article
                key={bundle.id}
                className="overflow-hidden rounded-[24px] bg-[#181914] p-7 text-white"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="eyebrow !text-[#c7f36b]">
                      Save {formatMMK(bundle.savings)}
                    </p>
                    <h3 className="display mt-2 text-3xl font-semibold">
                      {bundle.name}
                    </h3>
                  </div>
                  <span className="pill border-white/10 bg-white/10 text-white">
                    {bundle.availability === "sold_out"
                      ? "Sold out"
                      : bundle.availability === "low"
                        ? "Limited availability"
                        : "Available"}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-white/60">
                  {bundle.description}
                </p>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {bundle.items.map((item) => (
                    <div
                      key={item.sku}
                      className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs"
                    >
                      <b>
                        {item.quantity}× {item.name}
                      </b>
                      <p className="mt-1 font-mono text-[9px] text-white/40">
                        {item.sku}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex items-end justify-between">
                  <div>
                    <p className="text-xs text-white/35 line-through">
                      {formatMMK(bundle.retailValue)}
                    </p>
                    <p className="display text-2xl font-bold">
                      {formatMMK(bundle.bundlePrice)}
                    </p>
                  </div>
                  <Link
                    aria-disabled={bundle.availability === "sold_out"}
                    href={
                      bundle.availability !== "sold_out"
                        ? `/shop/checkout?bundleIds=${bundle.id}`
                        : "#"
                    }
                    className={`rounded-full bg-[#c7f36b] px-5 py-3 text-xs font-bold text-black ${bundle.availability === "sold_out" ? "pointer-events-none opacity-40" : ""}`}
                  >
                    {bundle.availability !== "sold_out"
                      ? "Buy bundle"
                      : "Sold out"}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      <footer className="border-t bg-white/45 px-5 py-8 text-center text-xs text-[#77776f]">
        {clientConfig.brand.fullName} · Built by{" "}
        <span className="font-bold text-black">
          {clientConfig.developer.name}
        </span>
      </footer>
      {compare.length > 0 && (
        <div className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-center gap-3 rounded-2xl bg-black p-3 text-white shadow-2xl">
          <div className="flex -space-x-2">
            {compare.map((sku) => {
              const p = products.find((x) => x.sku === sku)!;
              return (
                <Image
                  key={sku}
                  src={p.image}
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full border-2 border-black object-cover"
                  alt=""
                  unoptimized={typeof p.image === "string" && p.image.startsWith("/api/media")}
                />
              );
            })}
          </div>
          <p className="flex-1 text-xs font-bold">
            {compare.length} selected for comparison
          </p>
          <Link
            href={`/shop/compare?skus=${compare.join(",")}`}
            className="rounded-full bg-[#c7f36b] px-4 py-2 text-xs font-bold text-black"
          >
            Compare
          </Link>
          <button aria-label="Clear comparison" onClick={() => setCompare([])}>
            <X size={16} />
          </button>
        </div>
      )}

      {galleryModal && (
        <ModalPortal
          isOpen={Boolean(galleryModal)}
          onClose={() => setGalleryModal(null)}
        >
          <div
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 p-2 sm:p-4 backdrop-blur-md transition-opacity"
            role="dialog"
            aria-modal="true"
            aria-label={galleryModal.title}
            onClick={(e) => {
              if (e.target === e.currentTarget) setGalleryModal(null);
            }}
          >
            <div className="relative flex max-h-[92dvh] w-full max-w-4xl flex-col items-center">
              <div className="mb-2.5 sm:mb-3 flex w-full items-center justify-between text-white px-1">
                <div>
                  <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#c7f36b]">
                    Verified Account Screenshots
                  </p>
                  <h3 className="text-sm font-bold text-white sm:text-lg line-clamp-1">
                    {galleryModal.title}
                  </h3>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-xs">
                    {galleryModal.activeIndex + 1} / {galleryModal.images.length}
                  </span>
                  <button
                    type="button"
                    aria-label="Close modal"
                    onClick={() => setGalleryModal(null)}
                    className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="relative flex aspect-[16/10] w-full max-h-[58dvh] sm:max-h-[70vh] items-center justify-center overflow-hidden rounded-2xl bg-black">
                <img
                  src={galleryModal.images[galleryModal.activeIndex]}
                  alt={`${galleryModal.title} screenshot ${galleryModal.activeIndex + 1}`}
                  className="max-h-full max-w-full object-contain"
                />

                {galleryModal.images.length > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label="Previous image"
                      onClick={() =>
                        setGalleryModal((prev) =>
                          prev
                            ? {
                                ...prev,
                                activeIndex:
                                  (prev.activeIndex - 1 + prev.images.length) %
                                  prev.images.length,
                              }
                            : null,
                        )
                      }
                      className="absolute left-2 sm:left-3 top-1/2 grid h-9 w-9 sm:h-10 sm:w-10 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white hover:bg-black shadow-lg backdrop-blur-xs"
                    >
                      <ChevronLeft size={20} />
                    </button>

                    <button
                      type="button"
                      aria-label="Next image"
                      onClick={() =>
                        setGalleryModal((prev) =>
                          prev
                            ? {
                                ...prev,
                                activeIndex:
                                  (prev.activeIndex + 1) % prev.images.length,
                              }
                            : null,
                        )
                      }
                      className="absolute right-2 sm:right-3 top-1/2 grid h-9 w-9 sm:h-10 sm:w-10 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white hover:bg-black shadow-lg backdrop-blur-xs"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </>
                )}
              </div>

              {galleryModal.images.length > 1 && (
                <div className="mt-2.5 sm:mt-3 flex max-w-full gap-2 overflow-x-auto overscroll-contain p-1">
                  {galleryModal.images.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      aria-label={`View screenshot ${idx + 1}`}
                      onClick={() =>
                        setGalleryModal((prev) =>
                          prev ? { ...prev, activeIndex: idx } : null,
                        )
                      }
                      className={`relative h-12 w-16 sm:h-14 sm:w-20 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                        galleryModal.activeIndex === idx
                          ? "border-[#c7f36b] scale-105"
                          : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img
                        src={img}
                        alt={`Thumbnail ${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ModalPortal>
      )}

      {cartDrawerOpen && (
        <ModalPortal
          isOpen={cartDrawerOpen}
          onClose={() => setCartDrawerOpen(false)}
        >
          <div
            className="fixed inset-0 z-[100] flex justify-end bg-black/60 backdrop-blur-xs transition-opacity duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget) setCartDrawerOpen(false);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Shopping bag"
              onClick={(e) => e.stopPropagation()}
              className="relative flex h-full w-full max-w-md flex-col bg-[#fbfaf6] shadow-2xl animate-in slide-in-from-right duration-200"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-[#dedbd1] px-5 py-4">
                <div className="flex items-center gap-2">
                  <ShoppingBag size={18} />
                  <h2 className="text-base font-bold">Shopping Bag</h2>
                  <span className="rounded-full bg-[#eeece4] px-2 py-0.5 text-xs font-black text-[#666]">
                    {totalCartCount}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="Close shopping bag"
                  onClick={() => setCartDrawerOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-xl text-[#666] hover:bg-[#eeece4] transition active:scale-95"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-4">
                {isCartMixed && (
                  <div className="rounded-2xl border border-[#ffcdbe] bg-[#fff2ee] p-3.5 text-xs text-[#b83814]">
                    <p className="font-bold">⚠️ Mixed Cart Detected</p>
                    <p className="mt-1 leading-5">
                      PUBG Accounts (prepaid) and Physical Gadgets (COD) must be ordered separately.
                    </p>
                  </div>
                )}

                {cartProducts.length === 0 ? (
                  <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
                    <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#eeece4] text-[#888]">
                      <ShoppingBag size={28} />
                    </div>
                    <p className="mt-4 text-sm font-bold">Your bag is empty</p>
                    <p className="mt-1 text-xs text-[#777]">
                      Add gaming gadgets or accounts from the store.
                    </p>
                  </div>
                ) : (
                  cartProducts.map(({ product: p, quantity }) => (
                    <div
                      key={p.sku}
                      className="flex items-center gap-3 rounded-2xl border border-[#e5e2d8] bg-white p-3 shadow-xs"
                    >
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#eee]">
                        <Image
                          src={p.image}
                          alt={p.name}
                          fill
                          sizes="64px"
                          className="object-cover"
                          unoptimized={
                            typeof p.image === "string" &&
                            p.image.startsWith("/api/media")
                          }
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs font-bold text-black">{p.name}</p>
                        <p className="text-[11px] text-[#777]">
                          {p.storage || p.color || p.subcategory}
                        </p>
                        <p className="mt-1 text-xs font-black text-black">
                          {formatMMK(p.price * quantity)}
                        </p>
                      </div>

                      {p.category === "PUBG Accounts" ? (
                        <button
                          type="button"
                          aria-label={`Remove ${p.name}`}
                          onClick={() => removeFromCart(p.sku)}
                          className="grid h-8 w-8 place-items-center rounded-lg text-[#888] hover:bg-rose-50 hover:text-rose-600 transition active:scale-95"
                        >
                          <Trash2 size={15} />
                        </button>
                      ) : (
                        <div className="flex items-center gap-1 rounded-full border border-[#dcd9cf] bg-[#f7f6f1] p-0.5">
                          <button
                            type="button"
                            aria-label={`Decrease quantity of ${p.name}`}
                            onClick={() => updateCartQty(p.sku, -1)}
                            className="grid h-6 w-6 place-items-center rounded-full bg-white text-black hover:bg-neutral-100 shadow-xs active:scale-95 transition"
                          >
                            <Minus size={11} />
                          </button>
                          <span className="min-w-5 text-center text-xs font-black">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            aria-label={`Increase quantity of ${p.name}`}
                            disabled={quantity >= 20}
                            onClick={() => updateCartQty(p.sku, 1, 20)}
                            className="grid h-6 w-6 place-items-center rounded-full bg-black text-white hover:bg-neutral-800 disabled:opacity-30 active:scale-95 transition"
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Drawer Footer */}
              {cartProducts.length > 0 && (
                <div className="border-t border-[#dedbd1] bg-[#f6f5ef] p-5 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-[#666]">Subtotal</span>
                    <span className="font-mono text-lg font-black text-black">
                      {formatMMK(cartSubtotal)}
                    </span>
                  </div>
                  <Link
                    href={`/shop/checkout?skus=${checkoutQuery}`}
                    onClick={() => setCartDrawerOpen(false)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#c7f36b] py-3.5 text-xs font-black text-black shadow-lg hover:bg-[#b8e858] transition active:scale-95"
                  >
                    <span>Checkout ({totalCartCount} item{totalCartCount > 1 ? "s" : ""})</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
