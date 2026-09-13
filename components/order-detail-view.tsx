"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ModalPortal } from "@/components/modal-portal";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Coins,
  Edit,
  Loader2,
  Lock,
  Package,
  PackageCheck,
  Plus,
  Printer,
  RotateCcw,
  ShieldCheck,
  Truck,
  UploadCloud,
  User,
  X,
  ExternalLink,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Check,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { formatMMK } from "@/lib/data";
import {
  addShipmentAction,
  assignDeviceByIdentifierAction,
  confirmCodCollectionAction,
  deleteOrderAction,
  postDispatchCorrectionAction,
  preDispatchEditOrderAction,
  recordFailedDeliveryAction,
  recordPaymentAction,
  recordRefundReversalAction,
  rejectPaymentAction,
  updateFulfillmentAction,
  updateOrderPackedImageAction,
  verifyPaymentAction,
  reviewPayment,
  type InventoryItem,
} from "@/app/actions/store";
import { DESTINATIONS_BY_STATE } from "@/lib/shipping/destinations-data";
import { calculateRoyalDelivery } from "@/lib/shipping/royal-rates";

export interface OrderDetailItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  serialNumber?: string | null;
  category?: string | null;
  imei?: string | null;
  serial?: string | null;
}

export interface OrderDetailPayment {
  id: string;
  orderId: string;
  paymentType: string;
  amount: number;
  paymentMethod: string;
  status: string;
  reference: string | null;
  slipUrl: string | null;
  recordedBy: string;
  verifiedBy: string | null;
  verifiedAt: Date | string | null;
  notes: string | null;
  createdAt: Date | string;
}

export interface OrderDetailAllocation {
  id: string;
  batchCode: string;
  settlementDate: Date | string;
  allocatedCollected: number;
  allocatedCourierFee: number;
  netPayout?: number;
  netOrderPayout?: number;
  reversalReason?: string | null;
}

export interface OrderDetailCustomer {
  id: string;
  name: string;
  phone?: string | null;
  telegramUserId?: string | null;
  tier?: string | null;
  points?: number | null;
}

export interface OrderDetailData {
  id: string;
  orderCode: string;
  customerName: string;
  phone: string;
  telegramUserId?: string | null;
  streetAddress?: string | null;
  shippingAddress?: string | null;
  destinationCity: string | null;
  destinationState?: string | null;
  shippingCarrier?: string | null;
  trackingNumber?: string | null;
  paymentSlipUrl?: string | null;
  packedImageUrl?: string | null;
  packedImageUrls?: string[];
  paymentStatus?: string | null;
  packedWeightKg?: number | null;
  internalNotes?: string | null;
  orderSource?: string | null;
  isDigitalOnly?: boolean;
  subtotal?: number;
  shippingFee: number;
  discount?: number;
  totalAmount: number;
  requiredDeposit: number;
  depositPaid?: number;
  customerPaidAmount?: number;
  codAmount: number;
  customerBalance: number;
  expectedCourierCost: number;
  actualCourierCost?: number | null;
  fulfillmentStatus: string;
  customerPaymentStatus: string;
  courierSettlementStatus: string;
  commercialFrozen?: boolean;
  createdAt: Date | string;
  deliveredAt?: Date | string | null;
  paymentMethod?: string | null;
  customer?: OrderDetailCustomer | null;
  items?: OrderDetailItem[];
  payments?: OrderDetailPayment[];
  allocations?: OrderDetailAllocation[];
  canDeleteOrder?: boolean;
}

interface OrderDetailViewProps {
  order: OrderDetailData;
  inventory: InventoryItem[];
  onClose?: () => void;
  isModal?: boolean;
  onRefresh?: () => void;
  onDeleted?: () => void;
}

export function OrderDetailView({
  order,
  inventory,
  onClose,
  isModal = false,
  onRefresh,
  onDeleted,
}: OrderDetailViewProps) {
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Modal States
  const [preEditOpen, setPreEditOpen] = useState(false);
  const [postCorrectOpen, setPostCorrectOpen] = useState(false);
  const [failedDeliveryOpen, setFailedDeliveryOpen] = useState(false);
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [slipModalOpen, setSlipModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [slipZoom, setSlipZoom] = useState(1);
  const [slipRotation, setSlipRotation] = useState(0);
  const [slipViewingUrl, setSlipViewingUrl] = useState<string | null>(null);
  const [trackingInput, setTrackingInput] = useState(order.trackingNumber || "");
  const [isEditingTracking, setIsEditingTracking] = useState(false);
  const [serialInput, setSerialInput] = useState("");
  const [assigningSerial, setAssigningSerial] = useState(false);
  const [localPackedImage, setLocalPackedImage] = useState<string | null>(order.packedImageUrl || null);
  const [isUploadingPacked, setIsUploadingPacked] = useState(false);
  const packedFileInputRef = useRef<HTMLInputElement>(null);
  const [slipViewingTitle, setSlipViewingTitle] = useState("Customer Payment Slip");

  useEffect(() => {
    setTrackingInput(order.trackingNumber || "");
  }, [order.trackingNumber]);

  useEffect(() => {
    setLocalPackedImage(order.packedImageUrl || null);
  }, [order.packedImageUrl]);

  const handleUploadPackedPhoto = async (file: File) => {
    if (file.size > 15 * 1024 * 1024) {
      notify("Image exceeds the 15MB limit.", "error");
      return;
    }
    if (!file.type.startsWith("image/")) {
      notify("Please select a valid image file (JPG, PNG, WebP).", "error");
      return;
    }

    setIsUploadingPacked(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to upload packaging photo");
      }

      const updateRes = await updateOrderPackedImageAction(order.id, data.url, [data.url]);
      if (!updateRes.ok) {
        throw new Error(updateRes.error || "Failed to save packaging photo to order");
      }

      setLocalPackedImage(data.url);
      notify("Packaging proof photo uploaded successfully!", "success");
      onRefresh?.();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Packaging photo upload failed", "error");
    } finally {
      setIsUploadingPacked(false);
    }
  };

  const handleRemovePackedPhoto = async () => {
    startTransition(async () => {
      const res = await updateOrderPackedImageAction(order.id, null, []);
      if (res.ok) {
        setLocalPackedImage(null);
        notify("Packaging proof photo removed.", "success");
        onRefresh?.();
      } else {
        notify(res.error || "Failed to remove packaging photo", "error");
      }
    });
  };

  // Close slip modal on ESC key
  useEffect(() => {
    if (!slipModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSlipModalOpen(false);
        setSlipZoom(1);
        setSlipRotation(0);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [slipModalOpen]);

  const notify = (text: string, type: "success" | "error" = "success") => {
    setNotice({ text, type });
    setTimeout(() => setNotice(null), 6000);
  };

  const handleFulfillment = (status: Parameters<typeof updateFulfillmentAction>[1]) => {
    startTransition(async () => {
      const res = await updateFulfillmentAction(order.id, status);
      if (res.ok) {
        notify(`Fulfillment moved to ${status}`);
        onRefresh?.();
      } else {
        notify(res.error || "Fulfillment update failed", "error");
      }
    });
  };

  const handleDispatchWithTracking = (customTracking?: string) => {
    const code = (customTracking ?? trackingInput).trim();
    if (!code) {
      notify("Please enter a tracking number", "error");
      return;
    }
    startTransition(async () => {
      const res = await addShipmentAction(order.id, {
        trackingNumber: code,
        carrier: order.shippingCarrier || "Royal Express",
      });
      if (res.ok) {
        notify("Order dispatched with Royal Express tracking!");
        setIsEditingTracking(false);
        onRefresh?.();
      } else {
        notify(res.error || "Failed to dispatch order", "error");
      }
    });
  };

  const handleAssignSerial = (customSerial?: string) => {
    const code = (customSerial ?? serialInput).trim();
    if (!code) {
      notify("Please enter a Serial number or IMEI", "error");
      return;
    }
    startTransition(async () => {
      const res = await assignDeviceByIdentifierAction(order.id, code);
      if (res.ok) {
        notify("Serial / IMEI assigned to order item!");
        setSerialInput("");
        setAssigningSerial(false);
        onRefresh?.();
      } else {
        notify(res.error || "Failed to assign Serial / IMEI", "error");
      }
    });
  };

  const handleVerifyPayment = (paymentId: string) => {
    startTransition(async () => {
      const res = await verifyPaymentAction(paymentId);
      if (res.ok) {
        notify("Payment successfully verified.");
        onRefresh?.();
      } else {
        notify(res.error || "Failed to verify payment", "error");
      }
    });
  };

  const handleRejectPayment = (paymentId: string) => {
    const reason = prompt("Enter reason for rejecting this payment:");
    if (reason === null) return;
    startTransition(async () => {
      const res = await rejectPaymentAction(paymentId, reason);
      if (res.ok) {
        notify("Payment rejected.");
        onRefresh?.();
      } else {
        notify(res.error || "Failed to reject payment", "error");
      }
    });
  };

  const handleConfirmCod = () => {
    const confirmPrompt = confirm(
      `Confirm that Royal Express has delivered order ${order.orderCode} and collected ${formatMMK(order.codAmount)} COD from the customer?\n\nThis will zero the customer balance and record courier-held funds.`,
    );
    if (!confirmPrompt) return;

    startTransition(async () => {
      const res = await confirmCodCollectionAction(order.id, order.codAmount);
      if (res.ok) {
        notify("Royal Express COD collection confirmed.");
        onRefresh?.();
      } else {
        notify(res.error || "Failed to confirm COD collection", "error");
      }
    });
  };

  const handleRefundReversal = (paymentId: string, amount: number) => {
    const reason = prompt(
      `Enter reason for refund reversal of ${formatMMK(amount)} for payment ${paymentId}:`,
    );
    if (!reason?.trim()) return;

    startTransition(async () => {
      const res = await recordRefundReversalAction(paymentId, reason.trim());
      if (res.ok) {
        notify("Refund reversal recorded.");
        onRefresh?.();
      } else {
        notify(res.error || "Failed to record refund reversal", "error");
      }
    });
  };

  const handleReviewOrderPayment = (decision: "verified" | "rejected") => {
    startTransition(async () => {
      const res = await reviewPayment(order.id, decision);
      if (res.ok) {
        notify(decision === "verified" ? "Payment slip verified! Order moved to Packing." : "Payment slip rejected.");
        onRefresh?.();
      } else {
        notify(res.error || "Failed to review payment slip", "error");
      }
    });
  };

  const totalAmount = order.totalAmount ?? 0;
  const customerPaid = order.customerPaidAmount ?? 0;
  const requiredDeposit =
    (order.requiredDeposit != null && order.requiredDeposit > 0)
      ? order.requiredDeposit
      : (order.isDigitalOnly ? totalAmount : Math.min(10000, totalAmount));

  // If customerBalance was recorded as 0 in DB but customer has not paid full amount, compute real balance
  const customerBalance =
    (order.customerBalance != null && order.customerBalance > 0)
      ? order.customerBalance
      : (customerPaid >= totalAmount ? 0 : Math.max(0, totalAmount - customerPaid));

  // If codAmount was 0 in DB for a physical order that is not fully paid, compute real COD
  const codAmount =
    (order.codAmount != null && order.codAmount > 0)
      ? order.codAmount
      : (!order.isDigitalOnly && customerBalance > 0
          ? Math.max(0, totalAmount - Math.max(customerPaid, requiredDeposit))
          : 0);

  const shippingFee = order.shippingFee ?? 0;
  const subtotal = Math.max(0, totalAmount - shippingFee);

  // Status badges
  const paymentStatusColor: Record<string, string> = {
    unpaid: "bg-rose-50 text-rose-700 border-rose-200",
    deposit_pending: "bg-amber-50 text-amber-800 border-amber-200",
    deposit_verified: "bg-sky-50 text-sky-800 border-sky-200",
    cod_collected: "bg-teal-50 text-teal-800 border-teal-200",
    fully_paid: "bg-emerald-50 text-emerald-800 border-emerald-200",
    overpaid: "bg-purple-50 text-purple-800 border-purple-200",
    refunded: "bg-gray-100 text-gray-700 border-gray-300",
  };

  const settlementStatusColor: Record<string, string> = {
    not_applicable: "bg-gray-100 text-gray-600 border-gray-200",
    unsettled: "bg-amber-50 text-amber-800 border-amber-200",
    allocated_partial: "bg-blue-50 text-blue-800 border-blue-200",
    settled: "bg-emerald-50 text-emerald-800 border-emerald-200",
    discrepancy: "bg-rose-50 text-rose-800 border-rose-200",
  };

  return (
    <div className={`mx-auto max-w-6xl space-y-6 ${isModal ? "p-1 pb-6" : "pb-12"}`}>
      {/* Top Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-3.5 py-2 text-xs font-bold text-neutral-800 shadow-sm transition hover:bg-neutral-100"
            >
              <X size={16} /> Close Modal
            </button>
          ) : (
            <Link
              href="/orders"
              className="inline-flex items-center gap-2 rounded-xl border border-[#dedbd1] bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
            >
              <ArrowLeft size={16} /> Back to Orders
            </Link>
          )}

          {isModal && (
            <Link
              href={`/orders/${order.id}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-3.5 py-2 text-xs font-bold text-neutral-700 shadow-sm transition hover:bg-neutral-50"
            >
              <ExternalLink size={13} /> Full Page
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!order.commercialFrozen && ["new", "confirmed", "packing", "packed"].includes(order.fulfillmentStatus) && (
            <button
              onClick={() => setPreEditOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-sky-300 bg-sky-50 px-3.5 py-2 text-xs font-bold text-sky-800 hover:bg-sky-100"
            >
              <Edit size={14} /> Edit Pre-dispatch Terms
            </button>
          )}

          {order.commercialFrozen && (
            <button
              onClick={() => setPostCorrectOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
            >
              <Edit size={14} /> Post-dispatch Correction
            </button>
          )}

          {["dispatched", "delivered"].includes(order.fulfillmentStatus) && (
            <button
              onClick={() => setFailedDeliveryOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
            >
              <RotateCcw size={14} /> Record Failed Delivery
            </button>
          )}

          <Link
            href={`/shop/orders/${order.orderCode}/receipt`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-xl bg-black px-4 py-2 text-xs font-bold text-white hover:bg-gray-800"
          >
            <Printer size={14} /> View / Print Receipt
          </Link>
          {order.canDeleteOrder && (
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-800 transition hover:bg-rose-100"
            >
              <Trash2 size={14} /> Delete order
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div
          className={`rounded-2xl border p-4 text-xs font-bold ${
            notice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Main Order Header Box */}
      <div className="rounded-3xl border border-[#dedbd1] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-gray-100 px-2.5 py-1 text-[11px] font-extrabold uppercase text-gray-700">
                {order.orderSource}
              </span>
              {order.commercialFrozen && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                  <Lock size={12} /> Commercial Frozen
                </span>
              )}
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-black">
              {order.orderCode}
            </h1>
            <p className="mt-1 text-xs text-gray-500">
              Placed on {new Date(order.createdAt).toLocaleString("en-US", { timeZone: "Asia/Yangon" })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border px-3.5 py-2 text-right">
              <p className="text-[10px] uppercase font-bold text-gray-500">Fulfillment</p>
              <p className="text-sm font-black capitalize text-black">{order.fulfillmentStatus}</p>
            </div>

            <div
              className={`rounded-xl border px-3.5 py-2 text-right ${
                paymentStatusColor[order.customerPaymentStatus] || "bg-gray-50"
              }`}
            >
              <p className="text-[10px] uppercase font-bold">Customer Payment</p>
              <p className="text-sm font-black capitalize">
                {order.customerPaymentStatus.replaceAll("_", " ")}
              </p>
            </div>

            <div
              className={`rounded-xl border px-3.5 py-2 text-right ${
                settlementStatusColor[order.courierSettlementStatus] || "bg-gray-50"
              }`}
            >
              <p className="text-[10px] uppercase font-bold">Royal Settlement</p>
              <p className="text-sm font-black capitalize">
                {order.courierSettlementStatus.replaceAll("_", " ")}
              </p>
            </div>
          </div>
        </div>

        {/* Fulfillment Stepper & Quick Action */}
        <div className="mt-6 border-t pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
              <Package size={16} />
              <span>Next Fulfillment Step:</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {order.fulfillmentStatus === "new" && (
                <button
                  disabled={pending || !["deposit_verified", "cod_collected", "fully_paid"].includes(order.customerPaymentStatus)}
                  onClick={() => handleFulfillment("packing")}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
                >
                  Confirm & Move to Packing
                </button>
              )}

              {order.fulfillmentStatus === "packing" && (
                <div className="flex flex-wrap items-center gap-2">
                  {!order.isDigitalOnly && (
                    assigningSerial ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={serialInput}
                          onChange={(e) => setSerialInput(e.target.value)}
                          placeholder="Scan / enter Serial or IMEI"
                          disabled={pending}
                          className="h-9 w-48 sm:w-60 rounded-xl border border-violet-300 bg-white px-3 font-mono text-xs font-bold text-black outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-600 disabled:bg-neutral-100"
                          autoFocus
                        />
                        <button
                          type="button"
                          disabled={pending || !serialInput.trim()}
                          onClick={() => handleAssignSerial()}
                          className="rounded-xl bg-violet-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-40 shadow-xs"
                        >
                          Assign
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAssigningSerial(false);
                            setSerialInput("");
                          }}
                          className="rounded-xl border border-neutral-300 bg-white px-2.5 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-100"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAssigningSerial(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-violet-300 bg-violet-50 px-3.5 py-2 text-xs font-bold text-violet-900 hover:bg-violet-100 transition shadow-2xs"
                      >
                        <PackageCheck size={14} />
                        <span>Include Serial or IMEI</span>
                      </button>
                    )
                  )}

                  <button
                    disabled={pending}
                    onClick={() => handleFulfillment("packed")}
                    className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-40 shadow-xs"
                  >
                    Confirm Items Packed
                  </button>
                </div>
              )}

              {order.fulfillmentStatus === "packed" && (
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Quick packaging photo trigger */}
                  {localPackedImage ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSlipViewingUrl(localPackedImage);
                        setSlipViewingTitle("Packaging Proof Photo");
                        setSlipZoom(1);
                        setSlipRotation(0);
                        setSlipModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-violet-300 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-900 hover:bg-violet-100 transition shadow-2xs"
                    >
                      <Camera size={14} className="text-violet-700" />
                      <span>Packaging Photo Attached</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isUploadingPacked || pending}
                      onClick={() => packedFileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100 transition shadow-2xs disabled:opacity-50"
                    >
                      {isUploadingPacked ? (
                        <Loader2 size={14} className="animate-spin text-amber-700" />
                      ) : (
                        <UploadCloud size={14} className="text-amber-700" />
                      )}
                      <span>{isUploadingPacked ? "Uploading Photo..." : "Upload Packing Photo"}</span>
                    </button>
                  )}

                  {order.isDigitalOnly ? (
                    <button
                      disabled={pending}
                      onClick={() => handleFulfillment("dispatched")}
                      className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-40"
                    >
                      Complete Secure Handover
                    </button>
                  ) : order.trackingNumber ? (
                    <button
                      disabled={pending}
                      onClick={() => handleFulfillment("dispatched")}
                      className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-40"
                    >
                      Mark Dispatched to Royal Express ({order.trackingNumber})
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={trackingInput}
                        onChange={(e) => setTrackingInput(e.target.value)}
                        placeholder="Royal Tracking (e.g. REX-000000)"
                        disabled={pending}
                        className="h-9 w-52 sm:w-64 rounded-xl border border-sky-300 bg-white px-3 font-mono text-xs font-bold text-black outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600 disabled:bg-neutral-100"
                      />
                      <button
                        disabled={pending || !trackingInput.trim()}
                        onClick={() => handleDispatchWithTracking()}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-40 shadow-xs"
                      >
                        <Truck size={14} />
                        <span>Save Tracking & Mark Dispatched</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {order.fulfillmentStatus === "dispatched" && (
                <>
                  {order.customerPaymentStatus !== "cod_collected" && order.customerPaymentStatus !== "fully_paid" && (
                    <button
                      disabled={pending}
                      onClick={handleConfirmCod}
                      className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-40"
                    >
                      Confirm COD Collected ({formatMMK(codAmount)})
                    </button>
                  )}
                  <button
                    disabled={pending}
                    onClick={() => handleFulfillment("delivered")}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
                  >
                    Mark Order Delivered
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Financials & Royal Express Accounting Matrix */}
      <div className="rounded-3xl border border-[#dedbd1] bg-[#fbfaf6] p-5 sm:p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-black flex items-center gap-2">
            <Coins size={16} /> Financial Overview
          </h2>
          <p className="text-xs text-gray-500">Order total, customer deposit, and Royal Express settlement</p>
        </div>

        {/* 3 Clear Primary Numbers */}
        <div className="grid gap-3 sm:grid-cols-3">
          {/* 1. Order Total */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-xs">
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-neutral-400">
              1. Order Total · စုစုပေါင်း
            </span>
            <p className="mt-1 text-2xl font-black text-black">
              {formatMMK(totalAmount)}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {formatMMK(subtotal)} items + {formatMMK(shippingFee)} deli ({order.destinationCity || "Yangon"})
            </p>
          </div>

          {/* 2. Customer Deposit */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-amber-800">
                2. Deposit (Pay Now) · စရန်ငွေ
              </span>
              <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                customerPaid >= requiredDeposit && requiredDeposit > 0
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-900"
              }`}>
                {customerPaid >= requiredDeposit && requiredDeposit > 0
                  ? "Paid"
                  : "Due Now"}
              </span>
            </div>
            <p className="mt-1 text-2xl font-black text-amber-900">
              {formatMMK(requiredDeposit)}
            </p>
            <p className="mt-1 text-xs text-amber-800/80">
              Paid: {formatMMK(customerPaid)} · Balance due: {formatMMK(customerBalance)}
            </p>
          </div>

          {/* 3. Courier COD */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-800">
                3. COD (On Delivery) · ကျန်ငွေ
              </span>
              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-900">
                {codAmount > 0 ? "Collect on delivery" : "Fully settled"}
              </span>
            </div>
            <p className="mt-1 text-2xl font-black text-emerald-900">
              {formatMMK(codAmount)}
            </p>
            <p className="mt-1 text-xs text-emerald-800/80">
              Customer pays remaining balance to courier upon delivery
            </p>
          </div>
        </div>
      </div>

      {/* Customer, Delivery, Payment Slip & Packaging Proof */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {/* Customer Information */}
        <div className="rounded-3xl border border-[#dedbd1] bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-black flex items-center gap-2">
            <User size={16} /> Customer Information
          </h2>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b">
              <span className="text-gray-500">Name:</span>
              <span className="font-bold text-black">{order.customerName}</span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="text-gray-500">Phone:</span>
              <span className="font-mono font-bold text-black">{order.phone}</span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="text-gray-500">Telegram ID:</span>
              <span className="font-mono text-black">{order.telegramUserId || "None"}</span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="text-gray-500">Customer Profile:</span>
              <span>{order.customer ? `${order.customer.name} (#${order.customer.id.slice(0, 6)})` : "Guest"}</span>
            </div>
          </div>
        </div>

        {/* Delivery Logistics */}
        <div className="rounded-3xl border border-[#dedbd1] bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-black flex items-center gap-2">
            <Truck size={16} /> Royal Express Shipping & Tracking
          </h2>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b">
              <span className="text-gray-500">Destination:</span>
              <span className="font-bold text-black">
                {order.destinationCity}
                {order.destinationState ? ` (${order.destinationState})` : ""}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="text-gray-500">Street Address:</span>
              <span className="text-black text-right max-w-xs">{order.streetAddress || order.shippingAddress || "None"}</span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="text-gray-500">Carrier:</span>
              <span className="font-bold text-black">{order.shippingCarrier || "Royal Express"}</span>
            </div>
            <div className="py-1 border-b space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Tracking Number:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-black">
                    {order.trackingNumber || <span className="text-rose-600">Not assigned yet</span>}
                  </span>
                  {!order.isDigitalOnly && !["delivered", "cancelled"].includes(order.fulfillmentStatus) && !isEditingTracking && (
                    <button
                      type="button"
                      onClick={() => {
                        setTrackingInput(order.trackingNumber || "");
                        setIsEditingTracking(true);
                      }}
                      className="rounded-md border border-neutral-300 bg-neutral-50 px-2 py-0.5 text-[10px] font-bold text-neutral-700 hover:bg-neutral-100 hover:text-black"
                    >
                      {order.trackingNumber ? "Edit" : "+ Assign"}
                    </button>
                  )}
                </div>
              </div>
              {isEditingTracking && (
                <div className="flex items-center gap-1.5 pt-1">
                  <input
                    type="text"
                    value={trackingInput}
                    onChange={(e) => setTrackingInput(e.target.value)}
                    placeholder="REX-000000"
                    disabled={pending}
                    className="h-8 flex-1 rounded-lg border border-neutral-300 bg-white px-2 font-mono text-xs font-bold text-black outline-none focus:border-black"
                  />
                  <button
                    type="button"
                    disabled={pending || !trackingInput.trim()}
                    onClick={() => handleDispatchWithTracking()}
                    className="rounded-lg bg-sky-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-sky-700 disabled:opacity-40"
                  >
                    Save & Dispatch
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingTracking(false)}
                    className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-[11px] font-bold text-neutral-600 hover:bg-neutral-100"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Payment Slip Card */}
        <div className="rounded-3xl border border-[#dedbd1] bg-white p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-black flex items-center gap-2">
                <ImageIcon size={16} /> Customer Payment Slip
              </h2>
              <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                order.paymentSlipUrl ? "bg-sky-100 text-sky-800" : "bg-neutral-100 text-neutral-500"
              }`}>
                {order.paymentSlipUrl ? "Slip Uploaded" : "No Slip"}
              </span>
            </div>

            {order.paymentSlipUrl ? (
              <div className="mt-3 space-y-2.5">
                <div
                  onClick={() => {
                    setSlipViewingUrl(`/api/orders/${order.id}/slip`);
                    setSlipViewingTitle("Customer Payment Slip");
                    setSlipZoom(1);
                    setSlipRotation(0);
                    setSlipModalOpen(true);
                  }}
                  className="group relative h-48 w-full cursor-pointer overflow-hidden rounded-2xl border border-[#dedbd0] bg-[#f8f7f2] flex items-center justify-center transition hover:border-black"
                >
                  <img
                    src={`/api/orders/${order.id}/slip`}
                    alt={`Payment slip for order ${order.orderCode}`}
                    className="h-full w-full object-contain p-1 transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-black shadow-lg">
                      <ZoomIn size={14} /> Click to zoom slip
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSlipViewingUrl(`/api/orders/${order.id}/slip`);
                      setSlipViewingTitle("Customer Payment Slip");
                      setSlipZoom(1);
                      setSlipRotation(0);
                      setSlipModalOpen(true);
                    }}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#dedbd0] bg-[#faf9f5] py-2 text-xs font-bold text-black transition hover:bg-[#eae8df]"
                  >
                    <ZoomIn size={14} /> Inspect & Zoom
                  </button>
                  <a
                    href={`/api/orders/${order.id}/slip`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center rounded-xl border border-[#dedbd0] bg-[#faf9f5] p-2 text-neutral-600 transition hover:bg-[#eae8df]"
                    title="Open image in new tab"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-[#faf9f5] p-5 text-center">
                <div className="rounded-full bg-neutral-200/60 p-3 text-neutral-400">
                  <ImageIcon size={24} />
                </div>
                <p className="mt-2 text-xs font-bold text-neutral-700">No Payment Slip Uploaded</p>
                <p className="mt-1 text-[11px] text-neutral-500 max-w-[210px]">
                  Customer has not submitted a transfer receipt yet.
                </p>
              </div>
            )}
          </div>

          {/* Quick Approval Actions (If slip exists and payment status is pending or unpaid) */}
          {order.paymentSlipUrl && ["unpaid", "deposit_pending"].includes(order.customerPaymentStatus) && (
            <div className="border-t pt-3 flex items-center gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => handleReviewOrderPayment("rejected")}
                className="flex-1 rounded-xl border border-rose-300 bg-rose-50 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
              >
                <X size={13} className="inline mr-1" /> Reject
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => handleReviewOrderPayment("verified")}
                className="flex-1 rounded-xl bg-[#c7f36b] py-2 text-xs font-bold text-black transition hover:bg-[#b8e55e] disabled:opacity-50 shadow-xs"
              >
                <Check size={13} className="inline mr-1" /> Approve Deposit
              </button>
            </div>
          )}
        </div>

        {/* Packaging Proof & Inspection Card */}
        <div className="rounded-3xl border border-[#dedbd1] bg-white p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-black flex items-center gap-2">
                <Camera size={16} /> Packaging Proof
              </h2>
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                  localPackedImage
                    ? "bg-emerald-100 text-emerald-800"
                    : ["packed", "packing"].includes(order.fulfillmentStatus)
                      ? "bg-amber-100 text-amber-800"
                      : "bg-neutral-100 text-neutral-500"
                }`}
              >
                {localPackedImage
                  ? "Photo Attached"
                  : ["packed", "packing"].includes(order.fulfillmentStatus)
                    ? "Photo Pending"
                    : "No Photo"}
              </span>
            </div>

            {localPackedImage ? (
              <div className="mt-3 space-y-2.5">
                <div
                  onClick={() => {
                    setSlipViewingUrl(localPackedImage);
                    setSlipViewingTitle("Packaging Proof Photo");
                    setSlipZoom(1);
                    setSlipRotation(0);
                    setSlipModalOpen(true);
                  }}
                  className="group relative h-48 w-full cursor-pointer overflow-hidden rounded-2xl border border-[#dedbd0] bg-[#f8f7f2] flex items-center justify-center transition hover:border-black"
                >
                  <img
                    src={localPackedImage}
                    alt={`Packaging proof for order ${order.orderCode}`}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-black shadow-lg">
                      <ZoomIn size={14} /> Click to zoom photo
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSlipViewingUrl(localPackedImage);
                      setSlipViewingTitle("Packaging Proof Photo");
                      setSlipZoom(1);
                      setSlipRotation(0);
                      setSlipModalOpen(true);
                    }}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#dedbd0] bg-[#faf9f5] py-2 text-xs font-bold text-black transition hover:bg-[#eae8df]"
                  >
                    <ZoomIn size={14} /> Inspect & Zoom
                  </button>
                  <a
                    href={localPackedImage}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center rounded-xl border border-[#dedbd0] bg-[#faf9f5] p-2 text-neutral-600 transition hover:bg-[#eae8df]"
                    title="Open packaging image in new tab"
                  >
                    <ExternalLink size={14} />
                  </a>
                  {order.fulfillmentStatus !== "cancelled" && (
                    <button
                      type="button"
                      disabled={pending || isUploadingPacked}
                      onClick={handleRemovePackedPhoto}
                      className="flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-600 transition hover:bg-rose-100 disabled:opacity-40"
                      title="Remove packaging photo"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-3 flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-[#faf9f5] p-5 text-center">
                <div className="rounded-full bg-neutral-200/60 p-3 text-neutral-400">
                  <Camera size={24} />
                </div>
                <p className="mt-2 text-xs font-bold text-neutral-700">
                  No Packaging Photo
                </p>
                <p className="mt-1 text-[11px] text-neutral-500 max-w-[210px]">
                  Attach a parcel or contents photo before dispatching to courier.
                </p>
                {order.fulfillmentStatus !== "cancelled" && (
                  <button
                    type="button"
                    disabled={isUploadingPacked || pending}
                    onClick={() => packedFileInputRef.current?.click()}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-black px-3.5 py-2 text-xs font-bold text-white hover:bg-neutral-800 disabled:opacity-50 transition"
                  >
                    {isUploadingPacked ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <UploadCloud size={13} />
                    )}
                    <span>{isUploadingPacked ? "Uploading..." : "Upload Photo"}</span>
                  </button>
                )}
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={packedFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleUploadPackedPhoto(e.target.files[0]);
                  e.target.value = "";
                }
              }}
            />
          </div>

          {/* Bottom Quick Upload Action if photo exists and order is still in packing or packed */}
          {localPackedImage && ["packing", "packed"].includes(order.fulfillmentStatus) && (
            <div className="border-t pt-3 flex items-center gap-2">
              <button
                type="button"
                disabled={isUploadingPacked || pending}
                onClick={() => packedFileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-neutral-300 bg-[#faf9f5] py-2 text-xs font-bold text-black transition hover:bg-[#eae8df] disabled:opacity-50"
              >
                {isUploadingPacked ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <UploadCloud size={13} />
                )}
                <span>Replace Packaging Photo</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Order Items Table */}
      <div className="rounded-3xl border border-[#dedbd1] bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-black flex items-center gap-2">
          <Package size={16} /> Order Items
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="pb-2 font-bold uppercase">Item / Product</th>
                <th className="pb-2 font-bold uppercase">SKU</th>
                <th className="pb-2 font-bold uppercase text-center">Qty</th>
                <th className="pb-2 font-bold uppercase text-right">Unit Price</th>
                <th className="pb-2 font-bold uppercase text-right">Total</th>
                <th className="pb-2 font-bold uppercase">Serial / IMEI</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {order.items?.map((item: OrderDetailItem) => (
                <tr key={item.id} className="py-2.5">
                  <td className="py-2.5 font-bold text-black">{item.name}</td>
                  <td className="py-2.5 font-mono text-gray-600">{item.sku}</td>
                  <td className="py-2.5 text-center font-bold">{item.quantity}</td>
                  <td className="py-2.5 text-right font-mono">{formatMMK(item.unitPrice)}</td>
                  <td className="py-2.5 text-right font-mono font-bold">
                    {formatMMK(item.unitPrice * item.quantity)}
                  </td>
                  <td className="py-2.5 font-mono text-xs">
                    {item.imei || item.serial ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                        <span>{item.imei || item.serial}</span>
                      </span>
                    ) : order.fulfillmentStatus === "packing" && !order.isDigitalOnly ? (
                      <button
                        type="button"
                        onClick={() => setAssigningSerial(true)}
                        className="inline-flex items-center gap-1 rounded-md border border-dashed border-violet-300 bg-violet-50/80 px-2 py-0.5 text-[10px] font-bold text-violet-700 hover:border-violet-500 hover:bg-violet-100 transition"
                      >
                        <Plus size={10} />
                        <span>Include Serial / IMEI</span>
                      </button>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Ledger Card */}
      <div className="rounded-3xl border border-[#dedbd1] bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-black flex items-center gap-2">
              <ShieldCheck size={16} /> Immutable Order Payment Ledger
            </h2>
            <p className="text-xs text-gray-500">
              Tracks deposits, COD collections, reversals, and refunds without altering sales vouchers.
            </p>
          </div>
          <button
            onClick={() => setRecordPaymentOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border bg-black px-3.5 py-1.5 text-xs font-bold text-white hover:bg-gray-800"
          >
            <Plus size={14} /> Record Payment
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="pb-2 font-bold uppercase">Date</th>
                <th className="pb-2 font-bold uppercase">Type</th>
                <th className="pb-2 font-bold uppercase text-right">Amount</th>
                <th className="pb-2 font-bold uppercase">Method</th>
                <th className="pb-2 font-bold uppercase">Status</th>
                <th className="pb-2 font-bold uppercase">Verified By</th>
                <th className="pb-2 font-bold uppercase">Notes / Ref</th>
                <th className="pb-2 font-bold uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {order.payments?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-gray-400">
                    No payment entries recorded yet.
                  </td>
                </tr>
              ) : (
                order.payments?.map((payment: OrderDetailPayment) => (
                  <tr key={payment.id} className="py-2.5">
                    <td className="py-2.5 text-gray-600 whitespace-nowrap">
                      {new Date(payment.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 font-bold uppercase text-gray-800">
                      {payment.paymentType.replaceAll("_", " ")}
                    </td>
                    <td
                      className={`py-2.5 text-right font-mono font-bold ${
                        payment.amount < 0 ? "text-rose-600" : "text-black"
                      }`}
                    >
                      {formatMMK(payment.amount)}
                    </td>
                    <td className="py-2.5 uppercase font-semibold text-gray-600">
                      {payment.paymentMethod}
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase border ${
                          payment.status === "verified"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : payment.status === "pending"
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-rose-50 text-rose-800 border-rose-200"
                        }`}
                      >
                        {payment.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-gray-600">{payment.verifiedBy || "—"}</td>
                    <td className="py-2.5 text-gray-500 max-w-xs truncate">
                      {payment.notes || payment.reference || "—"}
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      {(payment.slipUrl || (payment.paymentType === "deposit" && order.paymentSlipUrl)) && (
                        <button
                          type="button"
                          onClick={() => {
                            const url = payment.slipUrl?.startsWith("http")
                              ? payment.slipUrl
                              : `/api/orders/${order.id}/slip`;
                            setSlipViewingUrl(url);
                            setSlipZoom(1);
                            setSlipRotation(0);
                            setSlipModalOpen(true);
                          }}
                          className="mr-1.5 inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-white px-2 py-1 text-[11px] font-bold text-neutral-700 shadow-2xs hover:bg-neutral-50 transition"
                          title="View customer payment slip"
                        >
                          <ImageIcon size={12} /> Slip
                        </button>
                      )}
                      {payment.status === "pending" && (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleVerifyPayment(payment.id)}
                            className="rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-emerald-700"
                          >
                            Verify
                          </button>
                          <button
                            onClick={() => handleRejectPayment(payment.id)}
                            className="rounded-lg border border-rose-300 px-2 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {payment.status === "verified" && payment.amount > 0 && (
                        <button
                          onClick={() => handleRefundReversal(payment.id, payment.amount)}
                          className="rounded-lg border border-gray-300 px-2 py-1 text-[11px] font-bold text-gray-600 hover:bg-gray-100"
                        >
                          Reverse / Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Courier Settlement Allocations (if any) */}
      {(order.allocations?.length ?? 0) > 0 && (
        <div className="rounded-3xl border border-[#dedbd1] bg-white p-6 shadow-sm space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-black flex items-center gap-2">
            <CheckCircle2 size={16} className="text-teal-600" /> Royal Express Settlement Payouts
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="pb-2 font-bold uppercase">Batch Code</th>
                  <th className="pb-2 font-bold uppercase">Date</th>
                  <th className="pb-2 font-bold uppercase text-right">Allocated COD</th>
                  <th className="pb-2 font-bold uppercase text-right">Courier Fee</th>
                  <th className="pb-2 font-bold uppercase text-right">Net Order Payout</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {order.allocations?.map((alloc: OrderDetailAllocation) => (
                  <tr key={alloc.id} className="py-2.5">
                    <td className="py-2.5 font-mono font-bold text-black">{alloc.batchCode}</td>
                    <td className="py-2.5 text-gray-600">
                      {new Date(alloc.settlementDate).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 text-right font-mono font-bold">
                      {formatMMK(alloc.allocatedCollected)}
                    </td>
                    <td className="py-2.5 text-right font-mono text-rose-600">
                      {formatMMK(alloc.allocatedCourierFee)}
                    </td>
                    <td className="py-2.5 text-right font-mono font-black text-teal-800">
                      {formatMMK(alloc.netOrderPayout ?? alloc.netPayout ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {/* 1. Record Payment Modal */}
      {recordPaymentOpen && (
        <RecordPaymentModal
          orderId={order.id}
          orderTotal={order.totalAmount}
          customerBalance={order.customerBalance}
          requiredDeposit={order.requiredDeposit}
          onClose={() => setRecordPaymentOpen(false)}
          onSuccess={() => {
            setRecordPaymentOpen(false);
            notify("Payment entry recorded.");
            onRefresh?.();
          }}
        />
      )}

      {/* 2. Pre-dispatch Edit Modal */}
      {preEditOpen && (
        <PreDispatchEditModal
          order={order}
          inventory={inventory}
          onClose={() => setPreEditOpen(false)}
          onSuccess={() => {
            setPreEditOpen(false);
            notify("Order terms successfully updated.");
            onRefresh?.();
          }}
        />
      )}

      {/* 3. Post-dispatch Correction Modal */}
      {postCorrectOpen && (
        <PostDispatchCorrectionModal
          order={order}
          onClose={() => setPostCorrectOpen(false)}
          onSuccess={() => {
            setPostCorrectOpen(false);
            notify("Post-dispatch notes updated.");
            onRefresh?.();
          }}
        />
      )}

      {/* 4. Failed Delivery Modal */}
      {failedDeliveryOpen && (
        <FailedDeliveryModal
          order={order}
          onClose={() => setFailedDeliveryOpen(false)}
          onSuccess={() => {
            setFailedDeliveryOpen(false);
            notify("Failed delivery / return recorded.");
            onRefresh?.();
          }}
        />
      )}

      {deleteOpen && (
        <DeleteOrderModal
          order={order}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => {
            setDeleteOpen(false);
            if (onDeleted) onDeleted();
            else window.location.assign("/orders");
          }}
        />
      )}

      {/* 5. Payment Slip Zoom & Inspection Modal */}
      {slipModalOpen && slipViewingUrl && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-3 sm:p-6 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => {
            setSlipModalOpen(false);
            setSlipZoom(1);
            setSlipRotation(0);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${slipViewingTitle} for order ${order.orderCode}`}
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-[#171815] text-white shadow-2xl animate-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#222420] px-5 py-3.5">
              <div className="flex items-center gap-3">
                <span className="rounded-lg bg-white/10 px-2.5 py-1 font-mono text-xs font-bold text-[#c7f36b]">
                  {order.orderCode}
                </span>
                <span className="text-xs text-neutral-300">
                  {slipViewingTitle} · {order.customerName}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSlipZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                  className="rounded-lg bg-white/10 p-2 text-white transition hover:bg-white/20"
                  title="Zoom out"
                >
                  <ZoomOut size={15} />
                </button>
                <span className="px-2 font-mono text-xs text-neutral-300">
                  {Math.round(slipZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setSlipZoom((z) => Math.min(3.5, Number((z + 0.25).toFixed(2))))}
                  className="rounded-lg bg-white/10 p-2 text-white transition hover:bg-white/20"
                  title="Zoom in"
                >
                  <ZoomIn size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSlipZoom(1);
                    setSlipRotation(0);
                  }}
                  className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold transition hover:bg-white/20"
                  title="Reset zoom and rotation"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setSlipRotation((r) => (r + 90) % 360)}
                  className="rounded-lg bg-white/10 p-2 text-white transition hover:bg-white/20"
                  title="Rotate 90 degrees clockwise"
                >
                  <RotateCw size={15} />
                </button>
                <a
                  href={slipViewingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-white/10 p-2 text-white transition hover:bg-white/20"
                  title="Open image in new tab"
                >
                  <ExternalLink size={15} />
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setSlipModalOpen(false);
                    setSlipZoom(1);
                    setSlipRotation(0);
                  }}
                  className="ml-2 rounded-lg bg-white/10 p-2 text-white transition hover:bg-rose-600"
                  title="Close inspector"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Image Pan / Zoom Stage */}
            <div className="relative flex min-h-[380px] max-h-[70vh] flex-1 select-none items-center justify-center overflow-auto bg-[#10110e] p-6">
              <img
                src={slipViewingUrl}
                alt={`Payment slip for order ${order.orderCode}`}
                style={{
                  transform: `scale(${slipZoom}) rotate(${slipRotation}deg)`,
                  transition: "transform 0.15s ease-out",
                }}
                className="max-h-full max-w-full origin-center object-contain shadow-2xl"
              />
            </div>

            {/* Modal Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#222420] px-5 py-3.5">
              {slipViewingTitle === "Packaging Proof Photo" ? (
                <>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-neutral-400">Fulfillment Status:</span>
                    <span className="font-bold uppercase tracking-wide text-white">
                      {order.fulfillmentStatus}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                      <Check size={14} /> Packaging Photo Verified
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSlipModalOpen(false);
                        setSlipZoom(1);
                        setSlipRotation(0);
                      }}
                      className="rounded-xl bg-white/10 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-white/20"
                    >
                      Close
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-neutral-400">Payment Status:</span>
                    <span className="font-bold uppercase tracking-wide text-white">
                      {order.customerPaymentStatus?.replaceAll("_", " ") || "unpaid"}
                    </span>
                    {order.requiredDeposit > 0 && (
                      <span className="text-neutral-400">
                        · Deposit Required: <strong className="text-[#c7f36b]">{formatMMK(order.requiredDeposit)}</strong>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {["unpaid", "deposit_pending"].includes(order.customerPaymentStatus) && (
                      <>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            handleReviewOrderPayment("rejected");
                            setSlipModalOpen(false);
                          }}
                          className="rounded-xl border border-rose-400/40 bg-rose-950/40 px-3.5 py-2 text-xs font-bold text-rose-300 transition hover:bg-rose-900/60 disabled:opacity-50"
                        >
                          <X size={13} className="inline mr-1" /> Reject Slip
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            handleReviewOrderPayment("verified");
                            setSlipModalOpen(false);
                          }}
                          className="rounded-xl bg-[#c7f36b] px-4 py-2 text-xs font-bold text-black transition hover:bg-[#b8e55e] disabled:opacity-50 shadow-md"
                        >
                          <Check size={13} className="inline mr-1" /> Approve & Move to Packing
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSlipModalOpen(false);
                        setSlipZoom(1);
                        setSlipRotation(0);
                      }}
                      className="rounded-xl bg-white/10 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-white/20"
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

// Modal Components below

function RecordPaymentModal({
  orderId,
  customerBalance,
  requiredDeposit,
  onClose,
  onSuccess,
}: {
  orderId: string;
  orderTotal: number;
  customerBalance: number;
  requiredDeposit: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [paymentType, setPaymentType] = useState<"deposit" | "cod_collection" | "direct_prepayment" | "direct_balance">("deposit");
  const [amount, setAmount] = useState(String(requiredDeposit || customerBalance));
  const [paymentMethod, setPaymentMethod] = useState("kbzpay");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [autoVerify, setAutoVerify] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await recordPaymentAction({
        orderId,
        paymentType,
        amount: Number(amount) || 0,
        paymentMethod,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        autoVerify,
      });
      if (res.ok) {
        onSuccess();
      } else {
        alert(res.error || "Failed to record payment");
      }
    });
  };

  return (
    <ModalPortal onClose={onClose}>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-2 sm:p-4 md:p-6 backdrop-blur-sm transition-opacity"
        role="dialog"
        aria-modal="true"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="flex max-h-[92dvh] sm:max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex shrink-0 items-center justify-between border-b p-4 sm:p-5">
            <h3 className="font-bold text-black text-sm sm:text-base">Record Payment Ledger Entry</h3>
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-1 flex-col min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 text-xs">
              <div>
                <label className="font-bold">Payment Type</label>
                <select
                  value={paymentType}
                  onChange={(e) =>
                    setPaymentType(
                      e.target.value as
                        | "deposit"
                        | "cod_collection"
                        | "direct_prepayment"
                        | "direct_balance",
                    )
                  }
                  className="mt-1 h-10 w-full rounded-xl border px-2.5 font-semibold text-xs"
                >
                  <option value="deposit">Deposit Payment</option>
                  <option value="cod_collection">COD Collection (Cash)</option>
                  <option value="direct_prepayment">Full Direct Prepayment</option>
                  <option value="direct_balance">Direct Balance Payment</option>
                </select>
              </div>

              <div>
                <label className="font-bold">Amount (MMK) *</label>
                <input
                  type="number"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border px-3 font-mono font-bold text-sm"
                />
              </div>

              <div>
                <label className="font-bold">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border px-2.5 text-xs font-medium"
                >
                  <option value="kbzpay">KBZPay</option>
                  <option value="wavepay">WavePay</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="cash_courier">Cash via Courier</option>
                  <option value="cash">Direct Cash</option>
                </select>
              </div>

              <div>
                <label className="font-bold">Bank / Transfer Reference</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. KBZ-TXN-12345"
                  className="mt-1 h-10 w-full rounded-xl border px-3 text-xs"
                />
              </div>

              <div>
                <label className="font-bold">Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional payment notes..."
                  className="mt-1 w-full rounded-xl border p-2.5 text-xs"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={autoVerify}
                  onChange={(e) => setAutoVerify(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="font-bold text-gray-700 text-xs">Auto-verify immediately (skip pending review)</span>
              </label>
            </div>

            <div className="flex shrink-0 flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t p-3.5 sm:p-4 bg-gray-50">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border px-4 py-2.5 font-bold text-gray-600 bg-white hover:bg-gray-100 min-h-[42px] text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || Number(amount) <= 0}
                className="rounded-xl bg-black px-5 py-2.5 font-bold text-white disabled:opacity-50 min-h-[42px] text-xs"
              >
                {pending ? "Recording..." : "Record Payment"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}

function PreDispatchEditModal({
  order,
  inventory,
  onClose,
  onSuccess,
}: {
  order: OrderDetailData;
  inventory: InventoryItem[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [customerName, setCustomerName] = useState(order.customerName);
  const [phone, setPhone] = useState(order.phone);
  const [shippingAddress, setShippingAddress] = useState(order.shippingAddress || "");
  const [selectedCity, setSelectedCity] = useState(order.destinationCity || "Yangon");
  const [packedWeightKg, setPackedWeightKg] = useState(order.packedWeightKg || 1.0);
  const [deliveryFee, setDeliveryFee] = useState(String(order.shippingFee));
  const [requiredDeposit, setRequiredDeposit] = useState(String(order.requiredDeposit));
  const [internalNotes, setInternalNotes] = useState(order.internalNotes || "");
  const [items, setItems] = useState<Array<{ sku: string; quantity: number; unitPrice: number }>>(
    order.items?.map((i: OrderDetailItem) => ({
      sku: i.sku,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })) || [],
  );

  const addItem = () => {
    const first = inventory[0];
    if (first) {
      setItems([...items, { sku: first.sku, quantity: 1, unitPrice: first.price }]);
    }
  };

  const removeItem = (idx: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== idx));
    }
  };

  const updateItem = (idx: number, updates: Partial<{ sku: string; quantity: number; unitPrice: number }>) => {
    setItems(
      items.map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item, ...updates };
        if (updates.sku) {
          const inv = inventory.find((x) => x.sku === updates.sku);
          if (inv) updated.unitPrice = inv.price;
        }
        return updated;
      }),
    );
  };

  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const total = subtotal + (Number(deliveryFee) || 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await preDispatchEditOrderAction(order.id, {
        customerName: customerName.trim(),
        phone: phone.trim(),
        shippingAddress: shippingAddress.trim(),
        destinationCity: selectedCity,
        packedWeightKg: Number(packedWeightKg),
        deliveryFee: Number(deliveryFee),
        requiredDeposit: Number(requiredDeposit),
        internalNotes: internalNotes.trim(),
        items,
      });

      if (res.ok) {
        onSuccess();
      } else {
        alert(res.error || "Failed to update pre-dispatch order");
      }
    });
  };

  return (
    <ModalPortal onClose={onClose}>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-2 sm:p-4 md:p-6 backdrop-blur-sm transition-opacity"
        role="dialog"
        aria-modal="true"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="flex max-h-[92dvh] sm:max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
          <div className="flex shrink-0 items-center justify-between border-b p-4 sm:px-6 sm:py-4">
            <h3 className="font-bold text-black text-sm sm:text-base">Edit Pre-dispatch Order Terms</h3>
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-1 flex-col min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 text-xs">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="font-bold">Customer Name</label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="mt-1 h-9 w-full rounded-xl border px-3"
              />
            </div>
            <div>
              <label className="font-bold">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 h-9 w-full rounded-xl border px-3"
              />
            </div>
          </div>

          <div>
            <label className="font-bold">Delivery Destination City</label>
            <select
              value={selectedCity}
              onChange={(e) => {
                setSelectedCity(e.target.value);
                const calc = calculateRoyalDelivery({ destinationCity: e.target.value });
                setDeliveryFee(String(calc.customerDeliveryFee));
              }}
              className="mt-1 h-9 w-full rounded-xl border px-3 font-semibold"
            >
              {DESTINATIONS_BY_STATE.map((g) => (
                <optgroup key={g.stateCode} label={g.stateName}>
                  {g.cities.map((c) => (
                    <option key={c.srNo} value={c.toCity}>
                      {c.toCity} ({formatMMK(c.normalPrice)})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold">Street Address</label>
            <textarea
              rows={2}
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              className="mt-1 w-full rounded-xl border p-2"
            />
          </div>

          {/* Items */}
          <div className="space-y-2 rounded-xl border p-3 bg-gray-50">
            <div className="flex justify-between items-center">
              <span className="font-bold uppercase">Items in Order</span>
              <button
                type="button"
                onClick={addItem}
                className="rounded border bg-white px-2 py-0.5 font-bold"
              >
                + Add Item
              </button>
            </div>
            {items.map((row, idx) => (
              <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded-lg border">
                <select
                  value={row.sku}
                  onChange={(e) => updateItem(idx, { sku: e.target.value })}
                  className="flex-1 h-8 rounded border px-1"
                >
                  {inventory.map((inv) => (
                    <option key={inv.sku} value={inv.sku}>
                      {inv.name} ({inv.sku})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={row.quantity}
                  onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) || 1 })}
                  className="w-16 h-8 rounded border text-center font-bold"
                />
                <input
                  type="number"
                  value={row.unitPrice}
                  onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) || 0 })}
                  className="w-24 h-8 rounded border text-right font-mono px-1"
                />
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  disabled={items.length === 1}
                  className="text-gray-400 hover:text-rose-600 disabled:opacity-30"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="font-bold">Packed Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={packedWeightKg}
                onChange={(e) => setPackedWeightKg(Number(e.target.value) || 1.0)}
                className="mt-1 h-9 w-full rounded-xl border px-3"
              />
            </div>

            <div>
              <label className="font-bold">Delivery Fee (MMK)</label>
              <input
                type="number"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(e.target.value)}
                className="mt-1 h-9 w-full rounded-xl border px-3"
              />
            </div>

            <div>
              <label className="font-bold">Required Deposit (MMK)</label>
              <input
                type="number"
                value={requiredDeposit}
                onChange={(e) => setRequiredDeposit(e.target.value)}
                className="mt-1 h-9 w-full rounded-xl border px-3 text-emerald-700 font-bold"
              />
            </div>
          </div>

          <div className="rounded-xl border bg-gray-50 p-3 flex justify-between font-bold">
            <span>New Order Total:</span>
            <span>{formatMMK(total)}</span>
          </div>

          <div>
            <label className="font-bold">Internal Notes</label>
            <textarea
              rows={2}
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              className="mt-1 w-full rounded-xl border p-2"
            />
          </div>

            </div>

            <div className="flex shrink-0 flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t p-3.5 sm:p-4 bg-gray-50">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border px-4 py-2.5 font-bold text-gray-600 bg-white hover:bg-gray-100 min-h-[42px] text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-xl bg-black px-5 py-2.5 font-bold text-white disabled:opacity-50 min-h-[42px] text-xs"
              >
                {pending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}

function PostDispatchCorrectionModal({
  order,
  onClose,
  onSuccess,
}: {
  order: OrderDetailData;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber || "");
  const [shippingCarrier, setShippingCarrier] = useState(order.shippingCarrier || "Royal Express");
  const [shippingAddress, setShippingAddress] = useState(order.shippingAddress || "");
  const [phone, setPhone] = useState(order.phone || "");
  const [reason, setReason] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      alert("Please provide a reason for the post-dispatch update.");
      return;
    }

    startTransition(async () => {
      const res = await postDispatchCorrectionAction(order.id, {
        trackingNumber: trackingNumber.trim() || undefined,
        shippingCarrier: shippingCarrier.trim() || undefined,
        shippingAddress: shippingAddress.trim() || undefined,
        phone: phone.trim() || undefined,
        reason: reason.trim(),
      });

      if (res.ok) {
        onSuccess();
      } else {
        alert(res.error || "Failed to update order notes");
      }
    });
  };

  return (
    <ModalPortal onClose={onClose}>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-2 sm:p-4 md:p-6 backdrop-blur-sm transition-opacity"
        role="dialog"
        aria-modal="true"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="flex max-h-[92dvh] sm:max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex shrink-0 items-center justify-between border-b p-4 sm:p-5">
            <h3 className="font-bold text-black text-sm sm:text-base">Post-dispatch Operational Update</h3>
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-1 flex-col min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-3 text-xs">
              <p className="text-gray-500">
                Commercial terms (pricing, quantities, deposit, and COD) are frozen after dispatch. Only logistics and notes can be edited.
              </p>

              <div>
                <label className="font-bold">Tracking Number</label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border px-3 font-mono font-bold text-sm"
                />
              </div>

              <div>
                <label className="font-bold">Shipping Carrier</label>
                <input
                  type="text"
                  value={shippingCarrier}
                  onChange={(e) => setShippingCarrier(e.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border px-3 text-xs"
                />
              </div>

              <div>
                <label className="font-bold">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border px-3 font-mono text-xs"
                />
              </div>

              <div>
                <label className="font-bold">Delivery Address Notes</label>
                <textarea
                  rows={2}
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  className="mt-1 w-full rounded-xl border p-2.5 text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-rose-700">Reason for Correction *</label>
                <textarea
                  rows={2}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Courier changed parcel tracking code..."
                  className="mt-1 w-full rounded-xl border border-rose-300 p-2.5 text-xs"
                />
              </div>
            </div>

            <div className="flex shrink-0 flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t p-3.5 sm:p-4 bg-gray-50">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border px-4 py-2.5 font-bold text-gray-600 bg-white hover:bg-gray-100 min-h-[42px] text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || !reason.trim()}
                className="rounded-xl bg-black px-5 py-2.5 font-bold text-white disabled:opacity-50 min-h-[42px] text-xs"
              >
                {pending ? "Saving..." : "Save Correction"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}

function DeleteOrderModal({
  order,
  onClose,
  onDeleted,
}: {
  order: OrderDetailData;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirmationCode, setConfirmationCode] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const confirmed = confirmationCode.trim() === order.orderCode;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await deleteOrderAction(order.id, {
        confirmationCode: confirmationCode.trim(),
        reason: reason.trim(),
      });
      if (result.ok) onDeleted();
      else setError(result.error || "Order could not be deleted.");
    });
  };

  return (
    <ModalPortal onClose={pending ? undefined : onClose}>
      <div
        className="fixed inset-0 z-[130] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-order-title"
        onClick={(event) => {
          if (!pending && event.target === event.currentTarget) onClose();
        }}
      >
        <div className="flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
          <div className="flex items-start justify-between gap-4 border-b border-rose-200 bg-rose-50 p-4 sm:p-5">
            <div className="flex gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rose-600 text-white">
                <TriangleAlert size={20} />
              </span>
              <div>
                <h2 id="delete-order-title" className="font-black text-rose-950">
                  Permanently delete {order.orderCode}?
                </h2>
                <p className="mt-1 text-xs leading-5 text-rose-800">
                  This is an administrator-only accounting reversal and cannot be undone.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={onClose}
              aria-label="Close delete confirmation"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-rose-200 bg-white text-rose-800 disabled:opacity-50"
            >
              <X size={17} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
              <div className="rounded-2xl border border-neutral-200 bg-[#faf9f5] p-4 text-xs leading-5 text-neutral-700">
                <p className="font-bold text-black">The system will reverse the whole order:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Return held gadget stock, serials, and PUBG listings to availability.</li>
                  <li>Remove payments and subtract this order from revenue and profit reports.</li>
                  <li>Recalculate the customer’s loyalty points and tier.</li>
                  <li>Detach Royal allocations and recalculate affected settlement batches.</li>
                  <li>Remove receipts, order items, alerts, and linked warranty tickets.</li>
                </ul>
                <p className="mt-2 font-semibold text-neutral-900">
                  The deletion reason and reversal totals remain in Activity Logs.
                </p>
              </div>

              {error && (
                <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">
                  {error}
                </p>
              )}

              <div>
                <label htmlFor="delete-order-reason" className="text-xs font-bold text-black">
                  Reason for deletion
                </label>
                <textarea
                  id="delete-order-reason"
                  required
                  minLength={3}
                  rows={2}
                  value={reason}
                  disabled={pending}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Example: Duplicate order entered by mistake"
                  className="mt-1.5 w-full rounded-xl border border-neutral-300 p-3 text-sm outline-none focus:border-rose-500 disabled:bg-neutral-100"
                />
              </div>

              <div>
                <label htmlFor="delete-order-code" className="text-xs font-bold text-black">
                  Type <span className="font-mono text-rose-700">{order.orderCode}</span> to confirm
                </label>
                <input
                  id="delete-order-code"
                  required
                  autoComplete="off"
                  value={confirmationCode}
                  disabled={pending}
                  onChange={(event) => setConfirmationCode(event.target.value)}
                  className="mt-1.5 h-12 w-full rounded-xl border border-neutral-300 px-3 font-mono text-sm font-bold outline-none focus:border-rose-500 disabled:bg-neutral-100"
                />
              </div>
            </div>

            <div className="grid shrink-0 grid-cols-2 gap-2 border-t bg-neutral-50 p-3 sm:flex sm:justify-end sm:p-4">
              <button
                type="button"
                disabled={pending}
                onClick={onClose}
                className="min-h-11 rounded-xl border border-neutral-300 bg-white px-4 text-xs font-bold text-neutral-700 disabled:opacity-50"
              >
                Keep order
              </button>
              <button
                type="submit"
                disabled={pending || !confirmed || reason.trim().length < 3}
                className="min-h-11 rounded-xl bg-rose-700 px-4 text-xs font-bold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pending ? "Reversing…" : "Delete & reverse"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}

function FailedDeliveryModal({
  order,
  onClose,
  onSuccess,
}: {
  order: OrderDetailData;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [returnCost, setReturnCost] = useState(String(order.expectedCourierCost || 4500));
  const [stockDisposition, setStockDisposition] = useState<"return_to_stock" | "write_off" | "customer_hold">("return_to_stock");
  const [depositDisposition, setDepositDisposition] = useState<"retain_fully" | "refund_fully" | "partial_refund">("retain_fully");
  const [refundAmount, setRefundAmount] = useState("0");
  const [reason, setReason] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      alert("Please provide the failed delivery return reason.");
      return;
    }

    startTransition(async () => {
      const res = await recordFailedDeliveryAction(order.id, {
        returnCost: Number(returnCost) || 0,
        stockDisposition,
        depositDisposition,
        refundAmount: Number(refundAmount) || 0,
        reason: reason.trim(),
      });

      if (res.ok) {
        onSuccess();
      } else {
        alert(res.error || "Failed to record returned delivery");
      }
    });
  };

  return (
    <ModalPortal onClose={onClose}>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-2 sm:p-4 md:p-6 backdrop-blur-sm transition-opacity"
        role="dialog"
        aria-modal="true"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="flex max-h-[92dvh] sm:max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex shrink-0 items-center justify-between border-b p-4 sm:p-5">
            <h3 className="font-bold text-black text-sm sm:text-base">Record Failed Delivery / Parcel Return</h3>
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-1 flex-col min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-3.5 text-xs">
              <div>
                <label className="font-bold">Courier Return Charge (MMK)</label>
                <input
                  type="number"
                  value={returnCost}
                  onChange={(e) => setReturnCost(e.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border px-3 font-mono font-bold text-sm"
                />
                <p className="text-[10px] text-gray-500 mt-0.5">Charged by Royal Express for returning parcel.</p>
              </div>

              <div>
                <label className="font-bold">Product Stock Disposition</label>
                <select
                  value={stockDisposition}
                  onChange={(e) =>
                    setStockDisposition(
                      e.target.value as "return_to_stock" | "write_off" | "customer_hold",
                    )
                  }
                  className="mt-1 h-10 w-full rounded-xl border px-2.5 font-semibold text-xs"
                >
                  <option value="return_to_stock">Restock items back to inventory</option>
                  <option value="write_off">Damaged / Write-off</option>
                  <option value="customer_hold">Hold for customer re-dispatch</option>
                </select>
              </div>

              <div>
                <label className="font-bold">Customer Deposit Disposition</label>
                <select
                  value={depositDisposition}
                  onChange={(e) =>
                    setDepositDisposition(
                      e.target.value as "retain_fully" | "refund_fully" | "partial_refund",
                    )
                  }
                  className="mt-1 h-10 w-full rounded-xl border px-2.5 font-semibold text-xs"
                >
                  <option value="retain_fully">Retain deposit (Covers return courier fee)</option>
                  <option value="refund_fully">Full refund to customer</option>
                  <option value="partial_refund">Partial refund</option>
                </select>
              </div>

              {depositDisposition === "partial_refund" && (
                <div>
                  <label className="font-bold">Partial Refund Amount (MMK)</label>
                  <input
                    type="number"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border px-3 text-xs"
                  />
                </div>
              )}

              <div>
                <label className="font-bold">Reason for Return *</label>
                <textarea
                  rows={2}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Customer unreachable, refused parcel, incorrect address..."
                  className="mt-1 w-full rounded-xl border p-2.5 text-xs"
                />
              </div>
            </div>

            <div className="flex shrink-0 flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t p-3.5 sm:p-4 bg-gray-50">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border px-4 py-2.5 font-bold text-gray-600 bg-white hover:bg-gray-100 min-h-[42px] text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || !reason.trim()}
                className="rounded-xl bg-rose-600 px-5 py-2.5 font-bold text-white hover:bg-rose-700 disabled:opacity-50 min-h-[42px] text-xs"
              >
                {pending ? "Recording..." : "Record Return"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
