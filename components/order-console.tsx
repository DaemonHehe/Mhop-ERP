"use client";
import { useState, useTransition } from "react";
import {
  Check,
  X,
  PackageCheck,
  Truck,
  Image as ImageIcon,
} from "lucide-react";
import { formatMMK } from "@/lib/data";
import type { OperationalOrder } from "@/app/actions/store";
import {
  addShipmentAction,
  assignDeviceByIdentifierAction,
  reviewPayment,
} from "@/app/actions/store";

export function OrderConsole({ orders }: { orders: OperationalOrder[] }) {
  const [activeId, setActiveId] = useState(orders[0]?.id || "");
  const [filter, setFilter] = useState("All");
  const [notice, setNotice] = useState("");
  const [tracking, setTracking] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [pending, startTransition] = useTransition();
  const visible =
    filter === "All"
      ? orders
      : orders.filter((order) => order.fulfillment === filter);
  const active = orders.find((order) => order.id === activeId) || visible[0];
  if (!active)
    return (
      <div className="card p-8 text-center text-sm text-[#77776f]">
        No orders yet.
      </div>
    );
  const act = (operation: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const result = await operation();
      setNotice(
        result.ok
          ? "Order updated successfully."
          : result.error || "Update failed",
      );
    });
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_390px]">
      <div className="card overflow-hidden">
        <div className="flex gap-2 border-b p-4">
          {["All", "New", "Packing", "Dispatched"].map((x) => (
            <button
              onClick={() => setFilter(x)}
              key={x}
              className={`rounded-full px-4 py-2 text-xs font-bold ${filter === x ? "bg-black text-white" : "border"}`}
            >
              {x}
            </button>
          ))}
        </div>
        <div>
          {visible.length ? (
            visible.map((o) => (
              <button
                onClick={() => {
                  setActiveId(o.id);
                  setNotice("");
                  setIdentifier("");
                  setTracking("");
                }}
                key={o.id}
                className={`grid w-full grid-cols-[1fr_auto] gap-4 border-b p-5 text-left last:border-0 ${active.id === o.id ? "bg-[#f8f6ef]" : ""}`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold">
                      {o.orderCode || o.id}
                    </span>
                    <span className="pill py-1">{o.channel}</span>
                  </div>
                  <p className="mt-2 font-bold">{o.customer}</p>
                  <p className="mt-1 text-xs text-[#77776f]">
                    {o.item} · {o.created}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatMMK(o.amount)}</p>
                  <span
                    className={`mt-2 pill py-1 ${o.payment === "Verified" ? "bg-[#effbdd]" : "bg-[#fff8dc]"}`}
                  >
                    {o.payment}
                  </span>
                </div>
              </button>
            ))
          ) : (
            <p className="p-8 text-center text-sm text-[#77776f]">
              No {filter.toLowerCase()} orders.
            </p>
          )}
        </div>
      </div>
      <aside className="card h-fit overflow-hidden">
        <div className="border-b bg-[#171813] p-5 text-white">
          <p className="text-[10px] uppercase tracking-wider text-white/50">
            Order detail
          </p>
          <h2 className="display mt-1 text-2xl font-bold">
            {active.orderCode || active.id}
          </h2>
        </div>
        <div className="p-5">
          {notice && (
            <p className="mb-4 rounded-xl bg-[#f1efe8] p-3 text-xs font-semibold">
              {notice}
            </p>
          )}
          <p className="eyebrow">Customer</p>
          <p className="mt-2 font-bold">{active.customer}</p>
          <p className="text-xs text-[#77776f]">
            {active.phone || "09 77 123 4567"} · {active.address || "Yangon"}
          </p>
          <div className="my-5 border-t" />
          <p className="eyebrow">Payment audit</p>
          <div className="mt-3 flex aspect-[16/7] items-center justify-center rounded-xl border border-dashed bg-[#f3f1ea]">
            <div className="text-center text-[#77776f]">
              <ImageIcon className="mx-auto" />
              <p className="mt-2 text-xs">
                {active.paymentSlipUrl
                  ? "Telegram payment slip linked"
                  : "No payment slip received"}
              </p>
              {active.paymentSlipUrl && (
                <p className="mt-1 font-mono text-[9px]">
                  {active.paymentSlipUrl.replace("telegram-file:", "File ")}
                </p>
              )}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              disabled={pending}
              onClick={() => act(() => reviewPayment(active.id, "rejected"))}
              className="rounded-xl border py-2.5 text-xs font-bold text-[#b5421c]"
            >
              <X size={14} className="mr-1 inline" /> Reject
            </button>
            <button
              disabled={pending}
              onClick={() => act(() => reviewPayment(active.id, "verified"))}
              className="rounded-xl bg-[#c7f36b] py-2.5 text-xs font-bold"
            >
              <Check size={14} className="mr-1 inline" /> Approve
            </button>
          </div>
          <div className="my-5 border-t" />
          <p className="eyebrow">Serialized fulfillment</p>
          <label className="mt-3 block text-xs font-bold">
            Assign serial / IMEI
          </label>
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Enter serial or IMEI"
            className="mt-2 h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:border-black"
          />
          <button
            disabled={pending || !identifier}
            onClick={() =>
              act(() => assignDeviceByIdentifierAction(active.id, identifier))
            }
            className="mt-3 w-full rounded-xl bg-black py-3 text-xs font-bold text-white disabled:opacity-40"
          >
            <PackageCheck size={15} className="mr-2 inline" /> Assign device &
            mark packing
          </button>
          <div className="mt-4 border-t pt-4">
            <label className="text-xs font-bold">Tracking number</label>
            <input
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="REX-000000"
              className="mt-2 h-10 w-full rounded-xl border px-3 text-sm"
            />
            <button
              disabled={pending || !tracking}
              onClick={() =>
                act(() =>
                  addShipmentAction(active.id, {
                    trackingNumber: tracking,
                    carrier: "Royal Express",
                  }),
                )
              }
              className="mt-2 w-full rounded-xl border py-3 text-xs font-bold disabled:opacity-40"
            >
              <Truck size={15} className="mr-2 inline" /> Dispatch via Royal
              Express
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
