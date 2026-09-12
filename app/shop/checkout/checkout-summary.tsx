"use client";

import { useState } from "react";
import Image from "next/image";
import { formatMMK } from "@/lib/data";
import { ChevronDown, ChevronUp, ShoppingBag, Sparkles, Tag } from "lucide-react";

export interface CheckoutSummaryItem {
  product: {
    sku: string;
    name: string;
    image: string;
    price: number;
    category: string;
    storage?: string | null;
    color?: string | null;
    subcategory?: string | null;
    waitingTime?: string | null;
  };
  quantity: number;
  sku: string;
}

export interface CheckoutSummaryBundle {
  id: string;
  name: string;
  bundlePrice: number;
  savings: number;
  items: Array<{
    sku: string;
    name: string;
    quantity: number;
  }>;
}

interface CheckoutSummaryProps {
  selectedItems: CheckoutSummaryItem[];
  selectedBundles: CheckoutSummaryBundle[];
  total: number;
  digitalOnly: boolean;
  variant?: "mobile" | "desktop";
}

export function CheckoutSummary({
  selectedItems,
  selectedBundles,
  total,
  digitalOnly,
  variant = "desktop",
}: CheckoutSummaryProps) {
  const [isOpen, setIsOpen] = useState(false);

  const totalItemCount =
    selectedItems.reduce((sum, i) => sum + i.quantity, 0) +
    selectedBundles.reduce(
      (sum, b) =>
        sum + b.items.reduce((itemSum, bi) => itemSum + bi.quantity, 0),
      0,
    );

  const content = (
    <div className="space-y-4">
      {/* Items list */}
      <div className="divide-y divide-[#eceae2] -my-1">
        {selectedItems.map(({ product: p, quantity }) => (
          <div key={p.sku} className="flex items-center gap-3.5 py-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-[#e5e3da] bg-white">
              <Image
                src={p.image}
                alt={p.name}
                fill
                sizes="56px"
                className="object-cover"
                unoptimized={
                  typeof p.image === "string" && p.image.startsWith("/api/media")
                }
              />
              {quantity > 1 && (
                <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-black px-1 text-[10px] font-black text-white shadow-sm">
                  {quantity}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs sm:text-sm font-bold text-[#1f1f1d]">
                {p.name}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[#77776f]">
                <span>{p.storage || p.color || p.subcategory || p.category}</span>
                {p.waitingTime && (
                  <>
                    <span>·</span>
                    <span className="font-semibold text-[#1c55b5]">
                      ⏳ {p.waitingTime}
                    </span>
                  </>
                )}
                <span>·</span>
                <span className="font-semibold text-black">
                  Qty: {quantity}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="font-mono text-xs sm:text-sm font-bold text-black">
                {formatMMK(p.price * quantity)}
              </p>
              {quantity > 1 && (
                <p className="text-[10px] text-[#77776f]">
                  {formatMMK(p.price)} each
                </p>
              )}
            </div>
          </div>
        ))}

        {selectedBundles.map((bundle) => (
          <div key={bundle.id} className="py-3">
            <div className="rounded-xl border border-[#e3e0d5] bg-[#f8f7f2] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Tag size={13} className="text-[#45830d]" />
                  <p className="text-xs sm:text-sm font-bold text-[#1f1f1d]">
                    {bundle.name}
                  </p>
                </div>
                <p className="font-mono text-xs sm:text-sm font-bold text-black shrink-0">
                  {formatMMK(bundle.bundlePrice)}
                </p>
              </div>
              <p className="mt-1 text-[11px] text-[#666] leading-relaxed">
                {bundle.items
                  .map((item) => `${item.quantity}× ${item.name}`)
                  .join(" · ")}
              </p>
              <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-[#45830d]">
                <Sparkles size={11} />
                <span>Bundle saving: {formatMMK(bundle.savings)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Subtotal row */}
      <div className="border-t border-[#e5e2d8] pt-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs sm:text-sm font-bold text-[#666]">
            Items Subtotal
          </span>
          <span className="display font-mono text-lg sm:text-xl font-bold text-black">
            {formatMMK(total)}
          </span>
        </div>
        {digitalOnly ? (
          <p className="mt-1.5 text-[11px] text-[#77776f]">
            ⚡ Instant digital account handover · No delivery fee
          </p>
        ) : (
          <p className="mt-1.5 text-[11px] text-[#77776f]">
            📦 Delivery fee &amp; COD calculated below based on destination
          </p>
        )}
      </div>
    </div>
  );

  // Mobile Collapsible Bar View
  if (variant === "mobile") {
    return (
      <div className="overflow-hidden rounded-2xl border border-[#dedbd1] bg-[#fbfaf6] shadow-xs">
        {/* Header Toggle Bar */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          className="flex w-full items-center justify-between p-4 text-left transition hover:bg-[#f5f3ec] active:bg-[#f0eee6]"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black text-white">
              <ShoppingBag size={16} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-bold text-black">
                <span>Order summary</span>
                <span className="rounded-full bg-[#e8e6df] px-1.5 py-0.5 text-[10px]">
                  {totalItemCount} {totalItemCount === 1 ? "item" : "items"}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-[#77776f]">
                <span>{isOpen ? "Hide details" : "Tap to review items"}</span>
                {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </div>
            </div>
          </div>

          <div className="text-right shrink-0 pl-2">
            <p className="font-mono text-sm sm:text-base font-extrabold text-black">
              {formatMMK(total)}
            </p>
          </div>
        </button>

        {/* Expandable Content Body */}
        {isOpen && (
          <div className="border-t border-[#dedbd1] bg-white p-4 animate-in fade-in slide-in-from-top-2 duration-200">
            {content}
          </div>
        )}
      </div>
    );
  }

  // Desktop Sidebar Card View
  return (
    <div className="card p-6 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-[#e5e2d8]">
        <div className="flex items-center gap-2">
          <ShoppingBag size={16} className="text-[#666]" />
          <p className="eyebrow !m-0">Order summary</p>
        </div>
        <span className="rounded-full bg-[#f1efe8] px-2.5 py-0.5 text-xs font-bold text-[#555]">
          {totalItemCount} {totalItemCount === 1 ? "item" : "items"}
        </span>
      </div>
      <div className="mt-4">{content}</div>
    </div>
  );
}
