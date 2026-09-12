"use client";
import { brandAssets } from "@/lib/brand-assets";
import { useMemo, useState, useRef, useEffect, useCallback } from "react";
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

const departments = [
  "All",
  "Gaming Gadgets",
  "PUBG Accounts",
  "Preorder Items",
] as const;
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
const preorderTypes = [
  "All preorders",
  "Upcoming Releases",
  "Preorder Gadgets",
  "Special Editions",
  "Custom Orders",
] as const;

function ProductCardGallery({
  product,
  priority,
  onOpenDetails,
}: {
  product: PublicCatalogItem;
  priority: boolean;
  onOpenDetails: (product: PublicCatalogItem, initialIndex: number) => void;
}) {
  const allImgs = useMemo(() => {
    if (product.images && product.images.length > 0) return product.images;
    if (product.image) return [product.image];
    return ["/placeholder.svg"];
  }, [product.images, product.image]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const mouseStartRef = useRef<{ x: number; y: number } | null>(null);
  const isMouseDownRef = useRef(false);
  const didSwipeRef = useRef(false);

  const nextImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (allImgs.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % allImgs.length);
  };

  const prevImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (allImgs.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + allImgs.length) % allImgs.length);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    didSwipeRef.current = false;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const t = e.changedTouches[0];
    const diffX = t.clientX - touchStartRef.current.x;
    const diffY = t.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (Math.abs(diffX) > 35 && Math.abs(diffX) > Math.abs(diffY)) {
      didSwipeRef.current = true;
      if (diffX < 0) {
        setCurrentIndex((prev) => (prev + 1) % allImgs.length);
      } else {
        setCurrentIndex((prev) => (prev - 1 + allImgs.length) % allImgs.length);
      }
    }
  };

  const onMouseDown = (e: React.MouseEvent) => {
    mouseStartRef.current = { x: e.clientX, y: e.clientY };
    isMouseDownRef.current = true;
    didSwipeRef.current = false;
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDownRef.current || !mouseStartRef.current) return;
    if (Math.abs(e.clientX - mouseStartRef.current.x) > 10) {
      didSwipeRef.current = true;
    }
  };

  const onMouseUp = (e: React.MouseEvent) => {
    if (!isMouseDownRef.current || !mouseStartRef.current) return;
    const diffX = e.clientX - mouseStartRef.current.x;
    isMouseDownRef.current = false;
    mouseStartRef.current = null;

    if (Math.abs(diffX) > 35) {
      didSwipeRef.current = true;
      if (diffX < 0) {
        setCurrentIndex((prev) => (prev + 1) % allImgs.length);
      } else {
        setCurrentIndex((prev) => (prev - 1 + allImgs.length) % allImgs.length);
      }
    }
  };

  const handleClick = () => {
    if (didSwipeRef.current) {
      didSwipeRef.current = false;
      return;
    }
    onOpenDetails(product, currentIndex);
  };

  if (allImgs.length <= 1) {
    return (
      <div
        className="relative aspect-[4/3] overflow-hidden bg-[#e8e6df] cursor-pointer"
        onClick={() => onOpenDetails(product, 0)}
      >
        <Image
          src={allImgs[0]}
          alt={product.name}
          fill
          priority={priority}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          unoptimized={
            typeof allImgs[0] === "string" &&
            allImgs[0].startsWith("/api/media")
          }
        />
      </div>
    );
  }

  return (
    <div
      className="relative aspect-[4/3] overflow-hidden bg-[#e8e6df] cursor-pointer select-none touch-pan-y group/card-gallery"
      onClick={handleClick}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={() => {
        isMouseDownRef.current = false;
        mouseStartRef.current = null;
      }}
    >
      {/* Sliding Image Track */}
      <div
        className="flex h-full w-full transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {allImgs.map((img, idx) => (
          <div key={idx} className="relative h-full w-full shrink-0">
            <Image
              src={img}
              alt={`${product.name} - Photo ${idx + 1}`}
              fill
              priority={priority && idx === 0}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="h-full w-full object-cover pointer-events-none"
              unoptimized={typeof img === "string" && img.startsWith("/api/media")}
            />
          </div>
        ))}
      </div>

      {/* Photos Count Badge */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenDetails(product, currentIndex);
        }}
        className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-black/75 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs backdrop-blur-md hover:bg-black transition"
      >
        <Camera size={12} /> {allImgs.length} photos
      </button>

      {/* Desktop Prev / Next Chevrons on hover */}
      <button
        type="button"
        aria-label="Previous photo"
        onClick={prevImage}
        className="absolute left-2 top-1/2 -translate-y-1/2 z-10 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white opacity-0 group-hover/card-gallery:opacity-100 hover:bg-black transition-opacity active:scale-95 shadow-md"
      >
        <ChevronLeft size={16} />
      </button>
      <button
        type="button"
        aria-label="Next photo"
        onClick={nextImage}
        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white opacity-0 group-hover/card-gallery:opacity-100 hover:bg-black transition-opacity active:scale-95 shadow-md"
      >
        <ChevronRight size={16} />
      </button>

      {/* Pagination Dots */}
      <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 backdrop-blur-xs">
        {allImgs.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to photo ${i + 1}`}
            onClick={(e) => {
              e.stopPropagation();
              setCurrentIndex(i);
            }}
            className={`h-1.5 rounded-full transition-all ${
              i === currentIndex
                ? "w-3.5 bg-white"
                : "w-1.5 bg-white/50 hover:bg-white/80"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

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
  const [preorderType, setPreorderType] =
    useState<(typeof preorderTypes)[number]>("All preorders");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [productDetail, setProductDetail] = useState<{
    product: PublicCatalogItem;
    activeImageIndex: number;
  } | null>(null);

  const openProductDetails = (
    product: PublicCatalogItem,
    initialImageIndex = 0,
  ) => {
    setProductDetail({
      product,
      activeImageIndex: initialImageIndex,
    });
  };

  const modalImages = useMemo(() => {
    if (!productDetail) return [];
    if (
      productDetail.product.images &&
      productDetail.product.images.length > 0
    ) {
      return productDetail.product.images;
    }
    if (productDetail.product.image) {
      return [productDetail.product.image];
    }
    return ["/placeholder.svg"];
  }, [productDetail]);

  const handleModalNext = useCallback(() => {
    if (!productDetail || modalImages.length <= 1) return;
    setProductDetail((prev) =>
      prev
        ? {
            ...prev,
            activeImageIndex: (prev.activeImageIndex + 1) % modalImages.length,
          }
        : null,
    );
  }, [productDetail, modalImages.length]);

  const handleModalPrev = useCallback(() => {
    if (!productDetail || modalImages.length <= 1) return;
    setProductDetail((prev) =>
      prev
        ? {
            ...prev,
            activeImageIndex:
              (prev.activeImageIndex - 1 + modalImages.length) %
              modalImages.length,
          }
        : null,
    );
  }, [productDetail, modalImages.length]);

  const modalTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const modalMouseStartRef = useRef<{ x: number; y: number } | null>(null);
  const modalIsDraggingRef = useRef(false);

  const onModalTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    modalTouchStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const onModalTouchEnd = (e: React.TouchEvent) => {
    if (!modalTouchStartRef.current) return;
    const t = e.changedTouches[0];
    const diffX = t.clientX - modalTouchStartRef.current.x;
    const diffY = t.clientY - modalTouchStartRef.current.y;
    modalTouchStartRef.current = null;

    if (Math.abs(diffX) > 35 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX < 0) {
        handleModalNext();
      } else {
        handleModalPrev();
      }
    }
  };

  const onModalMouseDown = (e: React.MouseEvent) => {
    modalMouseStartRef.current = { x: e.clientX, y: e.clientY };
    modalIsDraggingRef.current = true;
  };

  const onModalMouseUp = (e: React.MouseEvent) => {
    if (!modalIsDraggingRef.current || !modalMouseStartRef.current) return;
    const diffX = e.clientX - modalMouseStartRef.current.x;
    modalIsDraggingRef.current = false;
    modalMouseStartRef.current = null;

    if (Math.abs(diffX) > 35) {
      if (diffX < 0) {
        handleModalNext();
      } else {
        handleModalPrev();
      }
    }
  };

  const onModalMouseLeave = () => {
    modalIsDraggingRef.current = false;
    modalMouseStartRef.current = null;
  };

  useEffect(() => {
    if (!productDetail || modalImages.length <= 1) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleModalPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleModalNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [productDetail, modalImages.length, handleModalNext, handleModalPrev]);

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
        const matchesPreorder =
          department !== "Preorder Items" ||
          preorderType === "All preorders" ||
          p.subcategory === preorderType;
        const matchesQuery =
          `${p.name} ${p.brand} ${p.subcategory} ${p.tagline} ${p.waitingTime || ""}`
            .toLowerCase()
            .includes(query.toLowerCase());
        return (
          matchesDept &&
          matchesGadget &&
          matchesAccount &&
          matchesPreorder &&
          matchesQuery
        );
      }),
    [products, department, gadgetType, accountType, preorderType, query],
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
        <div className="relative mt-8 min-h-[220px] aspect-[16/9] sm:aspect-[16/7] w-full overflow-hidden rounded-[26px] border border-[#ddd9ce] shadow-xl md:aspect-[2.6/1]">
          <Image
            src={brandAssets.store}
            alt="MH OP Minimalist Flagship Store & Showroom"
            fill
            priority
            sizes="(max-width: 1280px) 100vw, 1280px"
            className="object-cover"
          />
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/45 to-transparent p-4 sm:p-7 md:p-10">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ff6b35] px-2.5 py-0.5 sm:px-3 sm:py-1 text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider text-white">
                Official Store Direct
              </span>
              <span className="inline-flex items-center rounded-full bg-white/20 px-2.5 py-0.5 sm:px-3 sm:py-1 text-[9px] sm:text-[10px] font-bold text-white backdrop-blur-md">
                100% Authentic Warranty
              </span>
            </div>
            <h2 className="mt-2 text-sm sm:text-xl md:text-2xl font-bold text-white leading-snug">
              မြန်မာ Gamer တွေအတွက် Quality, Authenticity & Trust ကို အဓိကထားတဲ့ Gaming Boutique
            </h2>
            <p className="mt-1 text-[11px] sm:text-xs md:text-sm text-white/85 leading-relaxed">
              Premium Cooling Technology, Esports Accessories နဲ့ Gaming Hardware တွေကို သေချာရွေးချယ်ပေးထားပြီး PUBG Mobile Accounts တွေကိုလည်း လုံခြုံ၊ မြန်ဆန်၊ စိတ်ချယုံကြည်စွာ ဝယ်ယူရောင်းချနိုင်အောင် ဝန်ဆောင်မှုပေးနေပါတယ်။
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
                    setPreorderType("All preorders");
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
          {department === "Preorder Items" && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {preorderTypes.map((type) => (
                <button
                  onClick={() => setPreorderType(type)}
                  key={type}
                  className={`whitespace-nowrap rounded-full px-3 py-2 text-[11px] font-bold ${preorderType === type ? "bg-[#c7f36b]" : "bg-[#f1efe8]"}`}
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
            className="group flex flex-col justify-between overflow-hidden rounded-[22px] border border-[#ddd9ce] bg-[#fffef9] transition duration-300 hover:border-[#bbb7aa] hover:shadow-lg"
          >
            <div>
              <ProductCardGallery
                product={p}
                priority={index < 2}
                onOpenDetails={openProductDetails}
              />
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="eyebrow">
                      {p.brand} · {p.subcategory}
                    </p>
                    <button
                      type="button"
                      onClick={() => openProductDetails(p)}
                      className="mt-1 block text-left group/title w-full"
                    >
                      <h2 className="display text-2xl font-semibold group-hover/title:text-[#416c17] transition line-clamp-1">
                        {p.name}
                      </h2>
                    </button>
                  </div>
                  <span
                    className={`pill shrink-0 ${
                      p.category === "Preorder Items"
                        ? "bg-[#e8f2fc] text-[#1c55b5]"
                        : p.availability === "sold_out"
                          ? "bg-[#f1f0eb] text-[#73766d]"
                          : p.availability === "low"
                            ? "bg-[#fff1ec] text-[#a84422]"
                            : "bg-[#effbdc] text-[#416c17]"
                    }`}
                  >
                    {p.category === "Preorder Items"
                      ? `Preorder · ${p.waitingTime || "7-14 days"}`
                      : p.availability === "sold_out"
                        ? "Sold out"
                        : p.availability === "low"
                          ? "Only a few left"
                          : "Available"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[#5c5d57] line-clamp-2 leading-relaxed">
                  {p.description || p.tagline}
                </p>
                <button
                  type="button"
                  onClick={() => openProductDetails(p)}
                  className="mt-2.5 inline-flex items-center gap-1 text-xs font-bold text-[#416c17] hover:underline"
                >
                  <span>View details</span>
                  <ArrowRight size={12} />
                </button>
                {p.specs.length > 0 && (
                  <div className="mt-4 grid grid-cols-3 gap-2">
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
              </div>
            </div>
            <div className="p-5 pt-0 mt-auto border-t border-[#f0eee6] pt-4 flex items-end justify-between gap-2">
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
                      {p.category === "Preorder Items" ? "Preorder" : "Add to bag"}
                    </button>
                  )
                )}
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
                setPreorderType("All preorders");
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

      {productDetail && (
        <ModalPortal
          isOpen={Boolean(productDetail)}
          onClose={() => setProductDetail(null)}
        >
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-2 sm:p-4 md:p-6 backdrop-blur-md transition-opacity duration-200"
            role="dialog"
            aria-modal="true"
            aria-label={productDetail.product.name}
            onClick={(e) => {
              if (e.target === e.currentTarget) setProductDetail(null);
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative flex max-h-[94dvh] w-full max-w-4xl flex-col rounded-3xl border border-[#dedbd1] bg-[#fffef9] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            >
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-[#eee] bg-white px-5 py-4 sm:px-6">
                <div className="min-w-0 flex-1 pr-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#f1efe8] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#666]">
                      {productDetail.product.category}
                    </span>
                    <span className="text-xs text-[#777]">
                      {productDetail.product.brand} · {productDetail.product.subcategory}
                    </span>
                  </div>
                  <h2 className="display mt-1 truncate text-lg sm:text-2xl font-bold text-[#1f1f1d]">
                    {productDetail.product.name}
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label="Close details"
                  onClick={() => setProductDetail(null)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#dedbd1] text-[#777] hover:bg-[#f1efe8] hover:text-black transition active:scale-95"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body: 2 Columns on desktop, scrollable */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">
                <div className="grid gap-6 md:grid-cols-2 md:gap-8">
                  {/* Left Column: Image Viewer */}
                  <div className="space-y-3">
                    {(() => {
                      const allImgs = modalImages;
                      const currentIdx = Math.min(
                        productDetail.activeImageIndex,
                        Math.max(0, allImgs.length - 1),
                      );
                      return (
                        <>
                          {/* Swipeable Main Image Frame */}
                          <div
                            className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-[#f1efe8] border border-[#e2dfd5] select-none touch-pan-y group/modal-gallery cursor-grab active:cursor-grabbing"
                            onTouchStart={onModalTouchStart}
                            onTouchEnd={onModalTouchEnd}
                            onMouseDown={onModalMouseDown}
                            onMouseUp={onModalMouseUp}
                            onMouseLeave={onModalMouseLeave}
                          >
                            {/* Sliding Track */}
                            <div
                              className="flex h-full w-full transition-transform duration-300 ease-out"
                              style={{
                                transform: `translateX(-${currentIdx * 100}%)`,
                              }}
                            >
                              {allImgs.map((img, idx) => (
                                <div
                                  key={idx}
                                  className="relative h-full w-full shrink-0 flex items-center justify-center p-2"
                                >
                                  <img
                                    src={img}
                                    alt={`${productDetail.product.name} - Photo ${idx + 1}`}
                                    className="h-full w-full object-contain pointer-events-none select-none"
                                    draggable={false}
                                  />
                                </div>
                              ))}
                            </div>

                            {allImgs.length > 1 && (
                              <>
                                {/* Prev Button */}
                                <button
                                  type="button"
                                  aria-label="Previous image"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleModalPrev();
                                  }}
                                  className="absolute left-2.5 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white hover:bg-black/90 backdrop-blur-xs transition shadow-md active:scale-95"
                                >
                                  <ChevronLeft size={20} />
                                </button>

                                {/* Next Button */}
                                <button
                                  type="button"
                                  aria-label="Next image"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleModalNext();
                                  }}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white hover:bg-black/90 backdrop-blur-xs transition shadow-md active:scale-95"
                                >
                                  <ChevronRight size={20} />
                                </button>

                                {/* Pagination Dots at Bottom Center */}
                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 backdrop-blur-md">
                                  {allImgs.map((_, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      aria-label={`Go to photo ${i + 1}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setProductDetail((prev) =>
                                          prev
                                            ? { ...prev, activeImageIndex: i }
                                            : null,
                                        );
                                      }}
                                      className={`h-1.5 rounded-full transition-all ${
                                        i === currentIdx
                                          ? "w-5 bg-white"
                                          : "w-1.5 bg-white/50 hover:bg-white/90"
                                      }`}
                                    />
                                  ))}
                                </div>

                                {/* Counter Pill */}
                                <div className="absolute top-3 right-3 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs backdrop-blur-md">
                                  {currentIdx + 1} / {allImgs.length}
                                </div>

                                {/* Mobile Swipe Hint */}
                                <div className="sm:hidden absolute top-3 left-3 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[9px] font-medium text-white/90 backdrop-blur-md pointer-events-none">
                                  <span>⇄ Swipe</span>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Thumbnail Row */}
                          {allImgs.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-1 pt-0.5">
                              {allImgs.map((img, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() =>
                                    setProductDetail((prev) =>
                                      prev
                                        ? { ...prev, activeImageIndex: idx }
                                        : null,
                                    )
                                  }
                                  className={`relative h-14 w-18 shrink-0 overflow-hidden rounded-xl border-2 transition active:scale-95 ${
                                    currentIdx === idx
                                      ? "border-[#416c17] ring-2 ring-[#416c17]/30 scale-105"
                                      : "border-transparent opacity-60 hover:opacity-100 hover:border-[#ccc]"
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
                        </>
                      );
                    })()}
                  </div>

                  {/* Right Column: Details & Specs */}
                  <div className="flex flex-col space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-[#777]">
                        SKU: {productDetail.product.sku}
                      </span>
                      <span
                        className={`pill ${
                          productDetail.product.category === "Preorder Items"
                            ? "bg-[#e8f2fc] text-[#1c55b5]"
                            : productDetail.product.availability === "sold_out"
                              ? "bg-[#f1f0eb] text-[#73766d]"
                              : productDetail.product.availability === "low"
                                ? "bg-[#fff1ec] text-[#a84422]"
                                : "bg-[#effbdc] text-[#416c17]"
                        }`}
                      >
                        {productDetail.product.category === "Preorder Items"
                          ? "Preorder Open"
                          : productDetail.product.availability === "sold_out"
                            ? "Sold out"
                            : productDetail.product.availability === "low"
                              ? "Only a few left"
                              : "Available"}
                      </span>
                    </div>

                    <div className="rounded-2xl border border-[#dedbd1] bg-[#fbfaf6] p-4">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#888]">
                        Price
                      </span>
                      <p className="display text-2xl sm:text-3xl font-black text-black">
                        {formatMMK(productDetail.product.price)}
                      </p>
                    </div>

                    {/* Specs & Highlights */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {productDetail.product.category === "Preorder Items" && (
                        <div className="rounded-xl border border-[#b8d4f8] bg-[#f0f6ff] p-2.5 col-span-2">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-[#1c55b5]">
                            Estimated Waiting Time
                          </span>
                          <span className="mt-0.5 block font-bold text-[#144294] text-sm">
                            ⏳ {productDetail.product.waitingTime || "7-14 business days"}
                          </span>
                        </div>
                      )}
                      <div className="rounded-xl border border-[#e5e2d8] bg-white p-2.5">
                        <span className="block text-[10px] font-bold uppercase text-[#888]">
                          Warranty
                        </span>
                        <span className="mt-0.5 block font-bold text-black">
                          {productDetail.product.warranty > 0
                            ? `${productDetail.product.warranty} Months Warranty`
                            : "Direct Verified Handover"}
                        </span>
                      </div>
                      {productDetail.product.color && (
                        <div className="rounded-xl border border-[#e5e2d8] bg-white p-2.5">
                          <span className="block text-[10px] font-bold uppercase text-[#888]">
                            Color / Edition
                          </span>
                          <span className="mt-0.5 block font-bold text-black truncate">
                            {productDetail.product.color}
                          </span>
                        </div>
                      )}
                      <div className="rounded-xl border border-[#e5e2d8] bg-white p-2.5 col-span-2">
                        <span className="block text-[10px] font-bold uppercase text-[#888]">
                          Authenticity & Trust
                        </span>
                        <span className="mt-0.5 block font-bold text-[#416c17]">
                          ✓ 100% Genuine · Official Store Direct
                        </span>
                      </div>
                    </div>

                    {/* Description Block */}
                    <div className="rounded-2xl border border-[#e5e2d8] bg-white p-4 sm:p-5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#777] mb-2.5">
                        Product Description
                      </h4>
                      {productDetail.product.description ? (
                        <div className="text-xs sm:text-sm text-[#333] whitespace-pre-line leading-relaxed font-normal">
                          {productDetail.product.description}
                        </div>
                      ) : (
                        <p className="text-xs sm:text-sm text-[#777] italic leading-relaxed">
                          {productDetail.product.tagline ||
                            "Authentic gaming hardware curated for Myanmar gamers. Guaranteed original quality."}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer: Action / Add to Bag */}
              <div className="shrink-0 border-t border-[#eee] bg-[#fbfaf6] px-5 py-3.5 sm:px-6 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#666]">In bag:</span>
                  <span className="font-bold text-black text-sm">
                    {getProductQty(productDetail.product.sku)} item
                    {getProductQty(productDetail.product.sku) === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {productDetail.product.availability === "sold_out" ? (
                    <span className="rounded-full bg-[#f1f0eb] px-5 py-2.5 text-xs font-bold text-[#888]">
                      Sold out
                    </span>
                  ) : productDetail.product.category === "PUBG Accounts" ? (
                    getProductQty(productDetail.product.sku) > 0 ? (
                      <button
                        type="button"
                        onClick={() =>
                          removeFromCart(productDetail.product.sku)
                        }
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#376911] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#2b520d] transition active:scale-95"
                      >
                        <Check size={14} />
                        <span>In bag (Click to remove)</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          updateCartQty(productDetail.product.sku, 1, 1)
                        }
                        className="rounded-full bg-black px-6 py-2.5 text-xs font-bold text-white hover:bg-neutral-800 transition active:scale-95"
                      >
                        Add to bag
                      </button>
                    )
                  ) : (
                    <div className="flex items-center gap-2">
                      {getProductQty(productDetail.product.sku) > 0 ? (
                        <div className="flex items-center gap-1.5 rounded-full border border-[#dcd9cf] bg-white p-1 shadow-xs">
                          <button
                            type="button"
                            aria-label={`Decrease quantity of ${productDetail.product.name}`}
                            onClick={() =>
                              updateCartQty(productDetail.product.sku, -1)
                            }
                            className="grid h-7 w-7 place-items-center rounded-full bg-[#f1efe8] text-black hover:bg-[#e4e1d7] active:scale-95 transition"
                          >
                            <Minus size={13} />
                          </button>
                          <span className="min-w-6 text-center text-xs font-black">
                            {getProductQty(productDetail.product.sku)}
                          </span>
                          <button
                            type="button"
                            aria-label={`Increase quantity of ${productDetail.product.name}`}
                            disabled={
                              getProductQty(productDetail.product.sku) >= 20
                            }
                            onClick={() =>
                              updateCartQty(productDetail.product.sku, 1, 20)
                            }
                            className="grid h-7 w-7 place-items-center rounded-full bg-black text-white hover:bg-neutral-800 disabled:opacity-30 active:scale-95 transition"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            updateCartQty(productDetail.product.sku, 1, 20)
                          }
                          className="rounded-full bg-black px-6 py-2.5 text-xs font-bold text-white hover:bg-neutral-800 transition active:scale-95"
                        >
                          {productDetail.product.category === "Preorder Items"
                            ? "Preorder Now"
                            : "Add to bag"}
                        </button>
                      )}
                    </div>
                  )}

                  {totalCartCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setProductDetail(null);
                        setCartDrawerOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#c7f36b] px-4 py-2.5 text-xs font-bold text-black hover:bg-[#b8e858] transition active:scale-95 shadow-sm"
                    >
                      <ShoppingBag size={14} />
                      <span>View bag ({totalCartCount})</span>
                    </button>
                  )}
                </div>
              </div>
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
