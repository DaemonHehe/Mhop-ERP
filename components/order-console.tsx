"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Check,
  CheckCircle2,
  CircleDollarSign,
  Coins,
  Image as ImageIcon,
  MapPin,
  PackageCheck,
  Plus,
  ShieldCheck,
  Truck,
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ExternalLink,
} from "lucide-react";
import { formatMMK } from "@/lib/data";
import type { InventoryItem, OperationalOrder } from "@/app/actions/store";
import {
  addShipmentAction,
  assignDeviceByIdentifierAction,
  confirmCodCollectionAction,
  reviewPayment,
  updateFulfillmentAction,
} from "@/app/actions/store";
import { ModalPortal } from "@/components/modal-portal";
import { CreateOrderDialog } from "@/components/create-order-dialog";
import { OrderDetailModal } from "@/components/order-detail-modal";

const filters = [
  "All",
  "New",
  "Packing",
  "Packed",
  "Dispatched",
  "Cancelled",
] as const;
type Filter = (typeof filters)[number];

const stageOf = (order: OperationalOrder): Exclude<Filter, "All"> => {
  if (order.fulfillment === "New") return "New";
  if (["Confirmed", "Packing"].includes(order.fulfillment)) return "Packing";
  if (order.fulfillment === "Packed") return "Packed";
  if (order.fulfillment === "Cancelled") return "Cancelled";
  return "Dispatched";
};

const stageStyles: Record<Exclude<Filter, "All">, string> = {
  New: "border-amber-300 bg-amber-50 text-amber-900",
  Packing: "border-sky-300 bg-sky-50 text-sky-900",
  Packed: "border-violet-300 bg-violet-50 text-violet-900",
  Dispatched: "border-emerald-300 bg-emerald-50 text-emerald-900",
  Cancelled: "border-rose-300 bg-rose-50 text-rose-900",
};

const workflow = [
  { name: "New", helper: "Review payment", icon: CircleDollarSign },
  { name: "Packing", helper: "Prepare items", icon: PackageCheck },
  { name: "Packed", helper: "Ready to send", icon: ShieldCheck },
  { name: "Dispatched", helper: "Staff complete", icon: Truck },
] as const;

export function OrderConsole({
  orders,
  inventory = [],
}: {
  orders: OperationalOrder[];
  inventory?: InventoryItem[];
}) {
  const [activeId, setActiveId] = useState(orders[0]?.id || "");
  const [filter, setFilter] = useState<Filter>("All");
  const [notice, setNotice] = useState("");
  const [tracking, setTracking] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [slipModalOpen, setSlipModalOpen] = useState(false);
  const [slipZoom, setSlipZoom] = useState(1);
  const [slipRotation, setSlipRotation] = useState(0);
  const [editingTracking, setEditingTracking] = useState(false);
  const [pending, startTransition] = useTransition();

  // Order Detail Modal (Click Triggered)
  const [modalOrderId, setModalOrderId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const modalOrder = useMemo(
    () => orders.find((o) => o.id === modalOrderId) || null,
    [orders, modalOrderId],
  );

  const handleRowClick = (order: OperationalOrder) => {
    setActiveId(order.id);
    setNotice("");
    setIdentifier("");
    setTracking(order.trackingNumber || "");
    setEditingTracking(false);

    setModalOrderId(order.id);
    setModalOpen(true);
  };

  const counts = useMemo(
    () =>
      Object.fromEntries(
        filters.map((item) => [
          item,
          item === "All"
            ? orders.length
            : orders.filter((order) => stageOf(order) === item).length,
        ]),
      ) as Record<Filter, number>,
    [orders],
  );
  const visible =
    filter === "All"
      ? orders
      : orders.filter((order) => stageOf(order) === filter);
  const active =
    visible.find((order) => order.id === activeId) || visible[0] || orders[0];

  useEffect(() => {
    setTracking(active?.trackingNumber || "");
    setEditingTracking(false);
  }, [active?.id, active?.trackingNumber]);

  const act = (
    operation: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) =>
    startTransition(async () => {
      setNotice("");
      const result = await operation();
      setNotice(result.ok ? success : result.error || "Update failed");
    });

  if (!orders.length)
    return (
      <div className="card p-8 text-center text-sm text-[#77776f]">
        No orders yet.
      </div>
    );

  const stage = stageOf(active);
  const currentStep = workflow.findIndex((step) => step.name === stage);
  const canReview = ["Pending", "Rejected"].includes(active.payment);
  const canReject = active.payment === "Pending";
  const isPaymentApproved =
    active.payment === "Verified" ||
    active.payment.toLowerCase().includes("verified") ||
    ["Deposit Verified", "Cod Collected", "Fully Paid"].includes(active.payment) ||
    ["verified", "deposit_verified", "cod_collected", "fully_paid"].includes(
      active.customerPaymentStatus || "",
    );
  const canPack = isPaymentApproved && stage === "Packing";
  const canDispatch = isPaymentApproved && stage === "Packed";

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_410px]">
      <section className="card min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3 sm:p-4">
          <div className="flex min-w-max gap-2 overflow-x-auto">
            {filters.map((item) => (
              <button
                type="button"
                onClick={() => setFilter(item)}
                key={item}
                className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold transition ${filter === item ? "border-black bg-black text-white shadow-sm" : "border-[#dedbd0] bg-white text-[#626258] hover:border-black"}`}
              >
                {item}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${filter === item ? "bg-white/20" : "bg-[#f1efe8]"}`}
                >
                  {counts[item]}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setCreateOrderOpen(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-black px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-neutral-800"
          >
            <Plus size={14} /> Create Order
          </button>
        </div>

        {visible.length ? (
          visible.map((order) => {
            const orderStage = stageOf(order);
            return (
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleRowClick(order)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleRowClick(order);
                  }
                }}
                key={order.id}
                className={`group relative grid w-full cursor-pointer grid-cols-1 gap-3 border-b p-4 text-left transition last:border-0 sm:grid-cols-[1fr_auto] sm:p-5 ${active.id === order.id ? "bg-[#f8f6ef] shadow-[inset_4px_0_0_#171813]" : "hover:bg-[#fbfaf6]"}`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold">
                      {order.orderCode || order.id}
                    </span>
                    <span className="pill py-1">{order.channel}</span>
                    {order.trackingNumber && (
                      <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        {order.trackingNumber}
                      </span>
                    )}
                    <span
                      className={`rounded-full border px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide ${stageStyles[orderStage]}`}
                    >
                      {orderStage}
                    </span>
                  </div>
                  <p className="mt-2 font-bold">{order.customer}</p>
                  <p className="mt-1 truncate text-xs text-[#77776f]">
                    {order.item} · {order.created}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                    {order.destinationCity && (
                      <span className="inline-flex items-center gap-1 rounded bg-[#f0eee6] px-2 py-0.5 font-medium text-[#55534c]">
                        <MapPin size={10} /> {order.destinationCity}
                      </span>
                    )}
                    {(order.requiredDeposit ?? 0) > 0 && (
                      <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 font-bold text-amber-800">
                        Dep: {formatMMK(order.requiredDeposit!)}
                      </span>
                    )}
                    {(order.codAmount ?? 0) > 0 && (
                      <span className="rounded border border-sky-200 bg-sky-50 px-2 py-0.5 font-bold text-sky-800">
                        COD: {formatMMK(order.codAmount!)}
                      </span>
                    )}
                    {order.courierSettlementStatus && order.courierSettlementStatus !== "not_applicable" && (
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                        order.courierSettlementStatus === "settled"
                          ? "bg-emerald-100 text-emerald-800"
                          : order.courierSettlementStatus === "discrepancy"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-neutral-100 text-neutral-600"
                      }`}>
                        Royal: {order.courierSettlementStatus}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                  <p className="font-bold">{formatMMK(order.amount)}</p>
                  <span
                    className={`pill py-1 ${
                      order.customerPaymentStatus === "fully_paid" || order.customerPaymentStatus === "cod_collected" || order.payment === "Verified"
                        ? "bg-[#effbdd] text-[#31520d]"
                        : order.payment === "Rejected"
                        ? "bg-[#fff0eb] text-[#9b3215]"
                        : order.customerPaymentStatus === "deposit_verified"
                        ? "border border-sky-300 bg-sky-50 text-sky-900"
                        : "bg-[#fff8dc] text-[#725a00]"
                    }`}
                  >
                    {order.customerPaymentStatus ? order.customerPaymentStatus.replace("_", " ") : order.payment}
                  </span>
                  <div className="mt-1.5 hidden items-center justify-end gap-1 text-[11px] text-neutral-400 opacity-0 transition-opacity group-hover:opacity-100 sm:flex">
                    <span>Full detail</span>
                    <ExternalLink size={11} />
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <p className="p-10 text-center text-sm text-[#77776f]">
            No {filter.toLowerCase()} orders.
          </p>
        )}
      </section>

      <aside className="card h-fit overflow-hidden xl:sticky xl:top-24">
        <div className="border-b bg-[#171813] p-5 text-white">
          <p className="text-[10px] uppercase tracking-wider text-white/50">
            Order workflow
          </p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <h2 className="display truncate text-2xl font-bold">
              {active.orderCode || active.id}
            </h2>
            <span
              className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase ${stageStyles[stage]}`}
            >
              {stage}
            </span>
          </div>
        </div>

        <div className="border-b bg-[#faf9f5] p-3">
          <Link
            href={`/orders/${active.id}`}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#dedbd0] bg-white py-2.5 px-4 text-xs font-bold text-black shadow-xs transition hover:bg-[#eae8df]"
          >
            <span>Open Full Order Console & Accounting</span>
            <ExternalLink size={13} />
          </Link>
        </div>

        <div className="border-b bg-[#f7f5ee] p-4">
          <ol className="grid grid-cols-4 gap-1" aria-label="Order progress">
            {workflow.map((step, index) => {
              const Icon = step.icon;
              const complete = index < currentStep;
              const current = index === currentStep;
              return (
                <li key={step.name} className="min-w-0 text-center">
                  <div className="mb-2 flex items-center">
                    <span
                      className={`h-px flex-1 ${index === 0 ? "bg-transparent" : complete || current ? "bg-black" : "bg-[#d7d3c8]"}`}
                    />
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border ${complete ? "border-black bg-black text-white" : current ? "border-black bg-[#c7f36b] text-black ring-4 ring-[#c7f36b]/25" : "border-[#d7d3c8] bg-white text-[#969187]"}`}
                    >
                      {complete ? <Check size={14} /> : <Icon size={14} />}
                    </span>
                    <span
                      className={`h-px flex-1 ${index === workflow.length - 1 ? "bg-transparent" : complete ? "bg-black" : "bg-[#d7d3c8]"}`}
                    />
                  </div>
                  <p className="truncate text-[10px] font-extrabold">
                    {step.name}
                  </p>
                  <p className="hidden truncate text-[9px] text-[#77776f] sm:block">
                    {step.helper}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="p-5">
          {notice && (
            <p
              role="status"
              className="mb-4 rounded-xl border border-[#dedbd0] bg-[#f1efe8] p-3 text-xs font-semibold"
            >
              {notice}
            </p>
          )}
          <p className="eyebrow">Customer</p>
          <p className="mt-2 font-bold">{active.customer}</p>
          <p className="text-xs text-[#77776f]">
            {active.phone || "Phone not provided"} ·{" "}
            {active.address || "Address not provided"}
          </p>

          <div className="mt-3 space-y-1.5 rounded-xl border border-[#e4e1d5] bg-[#faf9f5] p-3 text-xs">
            <div className="flex justify-between">
              <span className="text-[#77776f]">Destination:</span>
              <span className="font-semibold">{active.destinationCity || "Yangon"} {active.destinationState ? `(${active.destinationState})` : ""}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#77776f]">Total:</span>
              <span className="font-bold">{formatMMK(active.amount)}</span>
            </div>
            {(active.requiredDeposit ?? 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-[#77776f]">Required Deposit:</span>
                <span className="font-bold text-amber-900">{formatMMK(active.requiredDeposit!)}</span>
              </div>
            )}
            {(active.codAmount ?? 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-[#77776f]">Remaining COD:</span>
                <span className="font-bold text-sky-900">{formatMMK(active.codAmount!)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-[#dedbd0] pt-1.5">
              <span className="text-[#77776f]">Customer Balance:</span>
              <span className="font-extrabold text-black">
                {formatMMK(active.customerBalance ?? (active.amount - (active.customerPaidAmount ?? 0)))}
              </span>
            </div>
          </div>

          <div className="my-5 border-t" />
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow">1. Verify payment</p>
            <span className="text-[10px] font-bold uppercase text-[#77776f]">
              {active.payment}
            </span>
          </div>
          {active.paymentSlipUrl ? (
            <div className="mt-3 space-y-2">
              <div className="group relative overflow-hidden rounded-xl border border-[#dedbd0] bg-[#f5f4ed]">
                <img
                  src={`/api/orders/${active.id}/slip`}
                  alt="Payment slip"
                  className="h-48 w-full cursor-pointer object-contain transition group-hover:scale-[1.02]"
                  onClick={() => {
                    setSlipModalOpen(true);
                    setSlipZoom(1);
                    setSlipRotation(0);
                  }}
                />
                <div
                  onClick={() => {
                    setSlipModalOpen(true);
                    setSlipZoom(1);
                    setSlipRotation(0);
                  }}
                  className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/35 opacity-0 transition group-hover:opacity-100"
                >
                  <span className="pill flex items-center gap-1.5 bg-white text-xs font-bold text-black shadow-lg">
                    <ZoomIn size={14} /> Click to zoom slip
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSlipModalOpen(true);
                    setSlipZoom(1);
                    setSlipRotation(0);
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#dedbd0] bg-white py-2 text-xs font-bold text-[#1f1f1d] transition hover:bg-[#eae8df]"
                >
                  <ZoomIn size={14} /> Inspect & Zoom Slip
                </button>
                <a
                  href={`/api/orders/${active.id}/slip`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center rounded-xl border border-[#dedbd0] bg-white p-2 text-[#555] transition hover:bg-[#eae8df]"
                  title="Open in new tab"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex min-h-28 items-center justify-center rounded-xl border border-dashed bg-[#f3f1ea] p-4">
              <div className="text-center text-[#77776f]">
                <ImageIcon className="mx-auto" size={22} />
                <p className="mt-2 text-xs">No payment slip received</p>
              </div>
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={pending || !canReject}
              onClick={() =>
                act(
                  () => reviewPayment(active.id, "rejected"),
                  "Payment rejected. Follow up with the customer.",
                )
              }
              className="rounded-xl border py-2.5 text-xs font-bold text-[#b5421c] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <X size={14} className="mr-1 inline" /> Reject
            </button>
            <button
              type="button"
              disabled={pending || !canReview || !active.paymentSlipUrl}
              onClick={() =>
                act(
                  () => reviewPayment(active.id, "verified"),
                  "Payment approved. Order moved to Packing.",
                )
              }
              className="rounded-xl bg-[#c7f36b] py-2.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Check size={14} className="mr-1 inline" /> Approve payment
            </button>
          </div>

          <div className="my-5 border-t" />
          <p className="eyebrow">2. Pack order</p>
          <p className="mt-2 text-xs leading-5 text-[#77776f]">
            Assign a serial or IMEI to physical items when applicable,
            then confirm every item is prepared.
          </p>
          {!active.isDigitalOnly && <>
          <label
            className="mt-3 block text-xs font-bold"
            htmlFor="order-identifier"
          >
            Unit identifier (optional for non-serialized accessories)
          </label>
          <input
            id="order-identifier"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="Serial or IMEI"
            disabled={!canPack || pending}
            className="mt-2 h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:border-black disabled:bg-[#f3f1ea]"
          />
          <button
            type="button"
            disabled={pending || !identifier || !canPack}
            onClick={() =>
              act(
                () => assignDeviceByIdentifierAction(active.id, identifier),
                "Unit assigned to this order.",
              )
            }
            className="mt-2 w-full rounded-xl border py-2.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-35"
          >
            <PackageCheck size={15} className="mr-2 inline" /> Assign unit
          </button>
          </>}
          <button
            type="button"
            disabled={pending || !canPack}
            onClick={() =>
              act(
                () => updateFulfillmentAction(active.id, "packed"),
                "Packing confirmed. Order is ready to dispatch.",
              )
            }
            className="mt-2 w-full rounded-xl bg-black py-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-35"
          >
            <CheckCircle2 size={15} className="mr-2 inline" /> Mark as packed
          </button>

          <div className="my-5 border-t" />
          <p className="eyebrow">3. Dispatch</p>
          {active.isDigitalOnly ? (
            <>
              <p className="mt-2 text-xs leading-5 text-[#77776f]">
                Confirm the secure PUBG account handover. No delivery fee or
                courier tracking is required.
              </p>
              {active.fulfillment === "Dispatched" ? (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs">
                  <p className="font-bold text-emerald-900">
                    <ShieldCheck size={16} className="mr-1.5 inline text-emerald-700" /> Secure digital handover completed
                  </p>
                  <p className="mt-1 text-[11px] text-emerald-700">
                    Account credentials have been transferred. Customer received handover confirmation.
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={pending || !canDispatch}
                  onClick={() =>
                    act(
                      () => updateFulfillmentAction(active.id, "dispatched"),
                      "Digital handover completed. Order is now finished.",
                    )
                  }
                  className="mt-3 w-full rounded-xl bg-[#c7f36b] py-3 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <ShieldCheck size={15} className="mr-2 inline" /> Complete secure handover
                </button>
              )}
            </>
          ) : (
            <>
              {active.fulfillment === "Dispatched" || active.trackingNumber ? (
                <div className="mt-3 space-y-2">
                  <div className="rounded-xl border border-emerald-200 bg-[#f0f9eb] p-4 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-bold text-emerald-900">
                        <Truck size={15} className="text-emerald-700" /> Dispatched via {active.shippingCarrier || "Royal Express"}
                      </span>
                      <span className="rounded-full bg-emerald-200/70 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-900">
                        En Route
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-emerald-200/70 bg-white p-3 shadow-2xs">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#888]">
                          Tracking Number
                        </p>
                        <p className="font-mono text-sm font-black text-black">
                          {active.trackingNumber || tracking || "Not recorded"}
                        </p>
                      </div>
                      {(active.trackingNumber || tracking) && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(active.trackingNumber || tracking);
                            setNotice("Tracking number copied to clipboard!");
                          }}
                          className="rounded-lg border border-[#dedbd0] bg-[#faf9f5] px-2.5 py-1.5 text-xs font-bold text-[#444] transition hover:bg-[#eae7dd]"
                        >
                          Copy
                        </button>
                      )}
                    </div>

                    <div className="mt-3 rounded-lg border border-emerald-200/60 bg-emerald-100/60 p-2.5 text-[11px] leading-relaxed text-emerald-950">
                      📦 <b>ပို့ဆောင်ချိန် ခန့်မှန်းခြေ:</b> ၁၀ ရက် မှ ၁၅ ရက်အတွင်း လူကြီးမင်းထံသို့ အရောက်ပို့ဆောင်ပေးပါမည်ခင်ဗျာ။
                      <span className="block mt-0.5 font-medium text-emerald-800">
                        (10–15 days atwin yout pr mal · Customer notified via Telegram)
                      </span>
                    </div>

                    {active.customerPaymentStatus !== "cod_collected" &&
                      active.customerPaymentStatus !== "fully_paid" &&
                      (active.codAmount ?? 0) > 0 && (
                        <div className="mt-3 rounded-xl border border-sky-300 bg-sky-50 p-3 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sky-950">Royal Express COD</span>
                            <span className="font-extrabold text-sky-900">
                              {formatMMK(active.codAmount || 0)}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] leading-relaxed text-sky-800">
                            Customer pays Royal upon delivery. Recording collection brings customer balance to zero while funds await payout settlement.
                          </p>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              act(
                                () =>
                                  confirmCodCollectionAction(
                                    active.id,
                                    active.codAmount || 0,
                                  ),
                                "Royal COD collection confirmed! Customer balance is now zero.",
                              )
                            }
                            className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-sky-700 py-2.5 text-xs font-bold text-white transition hover:bg-sky-800 disabled:opacity-40"
                          >
                            <Coins size={14} /> Confirm Royal COD Collected
                          </button>
                        </div>
                      )}
                  </div>

                  {/* Toggle edit tracking */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setEditingTracking((prev) => !prev)}
                      className="text-xs font-bold text-[#77776f] transition hover:text-black"
                    >
                      {editingTracking ? "← Cancel edit tracking" : "Edit tracking number"}
                    </button>
                    {editingTracking && (
                      <div className="mt-2 space-y-2">
                        <input
                          id="tracking-number-edit"
                          value={tracking}
                          onChange={(event) => setTracking(event.target.value)}
                          placeholder="REX-000000"
                          className="h-11 w-full rounded-xl border border-[#dedbd0] bg-white px-3 text-sm font-medium outline-none focus:border-black"
                        />
                        <button
                          type="button"
                          disabled={pending || !tracking.trim()}
                          onClick={() =>
                            act(
                              () =>
                                addShipmentAction(active.id, {
                                  trackingNumber: tracking.trim(),
                                  carrier: active.shippingCarrier || "Royal Express",
                                }),
                              "Tracking number updated and saved.",
                            )
                          }
                          className="w-full rounded-xl bg-black py-2.5 text-xs font-bold text-white transition hover:bg-neutral-800 disabled:opacity-40"
                        >
                          Save updated tracking
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <label
                    className="mt-3 block text-xs font-bold"
                    htmlFor="tracking-number"
                  >
                    Royal Express tracking number
                  </label>
                  <input
                    id="tracking-number"
                    value={tracking}
                    onChange={(event) => setTracking(event.target.value)}
                    placeholder="REX-000000"
                    disabled={!canDispatch || pending}
                    className="mt-2 h-11 w-full rounded-xl border px-3 text-sm disabled:bg-[#f3f1ea]"
                  />
                  <p className="mt-1.5 text-[11px] text-[#77776f]">
                    ပို့ဆောင်ချိန် ခန့်မှန်းခြေ: ၁၀ ရက် မှ ၁၅ ရက်အတွင်း (10–15 days)
                  </p>
                  <button
                    type="button"
                    disabled={pending || !tracking.trim() || !canDispatch}
                    onClick={() =>
                      act(
                        () =>
                          addShipmentAction(active.id, {
                            trackingNumber: tracking.trim(),
                            carrier: "Royal Express",
                          }),
                        "Courier dispatch recorded & customer notified via Telegram (10–15 days estimate).",
                      )
                    }
                    className="mt-2 w-full rounded-xl bg-[#c7f36b] py-3 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <Truck size={15} className="mr-2 inline" /> Dispatch order
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </aside>
    
      {/* Payment Slip Zoom & Inspection Modal */}
      {slipModalOpen && active.paymentSlipUrl && (
        <ModalPortal
          isOpen={Boolean(slipModalOpen && active.paymentSlipUrl)}
          onClose={() => {
            setSlipModalOpen(false);
            setSlipZoom(1);
            setSlipRotation(0);
          }}
        >
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-2 sm:p-4 md:p-6 backdrop-blur-sm transition-opacity"
            role="dialog"
            aria-modal="true"
            aria-label={`Payment slip for order ${active.orderCode || active.id}`}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setSlipModalOpen(false);
                setSlipZoom(1);
                setSlipRotation(0);
              }
            }}
          >
            <div className="relative flex max-h-[92dvh] sm:max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#171815] text-white shadow-2xl">
              {/* Modal Header */}
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2.5 border-b border-white/10 bg-[#222420] p-3 sm:px-5 sm:py-3.5">
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="rounded-lg bg-white/10 px-2.5 py-1 font-mono text-xs font-bold text-[#c7f36b]">
                    {active.orderCode || active.id}
                  </span>
                  <span className="text-xs text-neutral-300">
                    {active.customer} · {formatMMK(active.amount)}
                  </span>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSlipZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                    className="rounded-lg bg-white/10 p-2 text-white transition hover:bg-white/20"
                    title="Zoom out"
                  >
                    <ZoomOut size={15} />
                  </button>
                  <span className="px-1.5 sm:px-2 font-mono text-xs text-neutral-300">
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
                    className="rounded-lg bg-white/10 px-2 sm:px-2.5 py-1 text-xs font-semibold transition hover:bg-white/20"
                    title="Reset zoom"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlipRotation((r) => (r + 90) % 360)}
                    className="rounded-lg bg-white/10 p-2 text-white transition hover:bg-white/20"
                    title="Rotate 90 degrees"
                  >
                    <RotateCw size={15} />
                  </button>
                  <a
                    href={`/api/orders/${active.id}/slip`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg bg-white/10 p-2 text-white transition hover:bg-white/20"
                    title="Open original in new tab"
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
                    className="ml-1 sm:ml-2 rounded-lg bg-white/10 p-2 text-white transition hover:bg-rose-600"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Modal Image Pan / Zoom Stage */}
              <div className="relative flex min-h-[220px] sm:min-h-[380px] max-h-[62vh] flex-1 select-none items-center justify-center overflow-auto bg-[#10110e] p-3 sm:p-6">
                <img
                  src={`/api/orders/${active.id}/slip`}
                  alt="Payment slip zoom"
                  style={{
                    transform: `scale(${slipZoom}) rotate(${slipRotation}deg)`,
                    transition: "transform 0.15s ease-out",
                  }}
                  className="max-h-full max-w-full origin-center object-contain shadow-2xl"
                />
              </div>

              {/* Modal Footer with Verification Actions */}
              <div className="flex shrink-0 flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-white/10 bg-[#222420] p-3 sm:px-5 sm:py-3.5">
                <p className="text-xs text-neutral-400">
                  Payment status:{" "}
                  <span className="font-bold uppercase text-white">{active.payment}</span>
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={pending || !canReject}
                    onClick={() =>
                      act(
                        () => reviewPayment(active.id, "rejected"),
                        "Payment rejected. Follow up with the customer."
                      )
                    }
                    className="flex-1 sm:flex-none rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-xs font-bold text-rose-300 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-35 min-h-[40px]"
                  >
                    <X size={14} className="mr-1 inline" /> Reject
                  </button>
                  <button
                    type="button"
                    disabled={pending || !canReview || !active.paymentSlipUrl}
                    onClick={() =>
                      act(
                        () => reviewPayment(active.id, "verified"),
                        "Payment approved. Order moved to Packing."
                      )
                    }
                    className="flex-1 sm:flex-none rounded-xl bg-[#c7f36b] px-5 py-2.5 text-xs font-bold text-black transition hover:bg-[#b8e55e] disabled:cursor-not-allowed disabled:opacity-35 min-h-[40px]"
                  >
                    <Check size={14} className="mr-1 inline" /> Approve payment
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Create Order Dialog Modal */}
      <CreateOrderDialog
        open={createOrderOpen}
        onClose={() => setCreateOrderOpen(false)}
        inventory={inventory}
      />

      {/* Order Detail Full Modal (Click Triggered) */}
      <OrderDetailModal
        orderId={modalOrderId}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        initialOrder={modalOrder}
        inventory={inventory}
      />
    </div>
  );
}
