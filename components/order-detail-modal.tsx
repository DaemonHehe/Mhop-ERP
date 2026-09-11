"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { X, CircleAlert } from "lucide-react";
import { ModalPortal } from "@/components/modal-portal";
import {
  getOrderByIdAction,
  type InventoryItem,
  type OperationalOrder,
} from "@/app/actions/store";
import {
  OrderDetailView,
  type OrderDetailData,
} from "@/components/order-detail-view";

export interface OrderDetailModalProps {
  orderId: string | null;
  isOpen: boolean;
  onClose: () => void;
  initialOrder?: OperationalOrder | null;
  inventory?: InventoryItem[];
}

export function OrderDetailModal({
  orderId,
  isOpen,
  onClose,
  initialOrder,
  inventory = [],
}: OrderDetailModalProps) {
  const [fullOrder, setFullOrder] = useState<OrderDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Map<string, OrderDetailData>>(new Map());

  const loadOrder = useCallback(
    async (id: string, force = false) => {
      if (!force && cacheRef.current.has(id)) {
        setFullOrder(cacheRef.current.get(id)!);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await getOrderByIdAction(id);
        if (!data) {
          setError("Order could not be found.");
        } else {
          cacheRef.current.set(id, data as OrderDetailData);
          setFullOrder(data as OrderDetailData);
        }
      } catch (err) {
        console.error("[OrderDetailModal load error]", err);
        setError("Failed to load full order details.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (isOpen && orderId) {
      // If already in cache, load immediately
      if (cacheRef.current.has(orderId)) {
        setFullOrder(cacheRef.current.get(orderId)!);
        setLoading(false);
      } else {
        setFullOrder(null);
        loadOrder(orderId);
      }
    } else if (!isOpen) {
      setFullOrder(null);
      setError(null);
    }
  }, [isOpen, orderId, loadOrder]);

  if (!isOpen || !orderId) return null;

  return (
    <ModalPortal isOpen={isOpen} onClose={onClose}>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-2 sm:p-4 md:p-6 backdrop-blur-sm transition-opacity duration-200"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Details for order ${initialOrder?.orderCode || orderId}`}
          onClick={(e) => e.stopPropagation()}
          className="relative flex h-full max-h-[94dvh] sm:max-h-[92vh] w-full max-w-5xl flex-col rounded-3xl border border-neutral-200 bg-[#fbfaf6] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Scrollable Body */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-6">
            {fullOrder ? (
              <div className="animate-in fade-in duration-150">
              <OrderDetailView
                order={fullOrder}
                inventory={inventory}
                onClose={onClose}
                isModal={true}
                onRefresh={() => loadOrder(orderId, true)}
              />
            </div>
          ) : loading ? (
            /* Clean, stable skeleton placeholder with identical layout to OrderDetailView */
            <div className="space-y-6">
              {/* Skeleton Top Bar */}
              <div className="flex items-center justify-between border-b border-[#dedbd1] pb-4">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-lg font-black text-black">
                    {initialOrder?.orderCode || "Loading..."}
                  </span>
                  <div className="h-6 w-20 animate-pulse rounded-full bg-neutral-200" />
                </div>
                <button
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-3.5 py-2 text-xs font-bold text-neutral-800 shadow-sm hover:bg-neutral-100"
                >
                  <X size={16} /> Close
                </button>
              </div>

              {/* Skeleton Header Card */}
              <div className="rounded-3xl border border-[#dedbd1] bg-white p-6 shadow-sm">
                <div className="space-y-3">
                  <div className="h-4 w-24 animate-pulse rounded bg-neutral-200" />
                  <div className="h-8 w-64 animate-pulse rounded bg-neutral-200" />
                  <div className="h-3 w-40 animate-pulse rounded bg-neutral-200" />
                </div>
              </div>

              {/* Skeleton Financial Matrix */}
              <div className="rounded-3xl border border-[#dedbd1] bg-[#fbfaf6] p-6 shadow-sm space-y-3">
                <div className="h-4 w-36 animate-pulse rounded bg-neutral-200" />
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="h-24 animate-pulse rounded-2xl bg-neutral-200/80" />
                  <div className="h-24 animate-pulse rounded-2xl bg-neutral-200/80" />
                  <div className="h-24 animate-pulse rounded-2xl bg-neutral-200/80" />
                </div>
              </div>

              {/* Skeleton Cards Grid */}
              <div className="grid gap-6 md:grid-cols-2">
                <div className="h-44 animate-pulse rounded-3xl bg-neutral-200/80" />
                <div className="h-44 animate-pulse rounded-3xl bg-neutral-200/80" />
              </div>
            </div>
          ) : error ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-center">
              <CircleAlert size={36} className="text-rose-600" />
              <p className="font-bold text-rose-900">{error}</p>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => loadOrder(orderId, true)}
                  className="rounded-xl bg-black px-4 py-2 text-xs font-bold text-white hover:bg-neutral-800"
                >
                  Retry
                </button>
                <button
                  onClick={onClose}
                  className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-800 hover:bg-neutral-50"
                >
                  Close
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  </ModalPortal>
  );
}
