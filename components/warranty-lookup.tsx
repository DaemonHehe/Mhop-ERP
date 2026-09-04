"use client";
import { useState, useTransition } from "react";
import { lookupWarrantyAction } from "@/app/actions/public";
import type { WarrantyResult } from "@/lib/services/order.service";

export function WarrantyLookup() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<WarrantyResult | null>(null);
  const [error, setError] = useState("");
  const submit = (form: FormData) =>
    startTransition(async () => {
      const response = await lookupWarrantyAction({
        orderCode: String(form.get("orderCode") || ""),
        phone: String(form.get("phone") || ""),
      });
      if (response.ok) {
        setResult(response.data);
        setError("");
      } else {
        setResult(null);
        setError(response.error);
      }
    });
  return (
    <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
      <form action={submit} className="card h-fit space-y-4 p-5">
        <div>
          <label className="text-xs font-bold">Order code</label>
          <input
            name="orderCode"
            required
            placeholder="MHOP-260829-AB12"
            className="mt-2 h-12 w-full rounded-xl border bg-white px-4 uppercase"
          />
        </div>
        <div>
          <label className="text-xs font-bold">Purchase phone number</label>
          <input
            name="phone"
            required
            className="mt-2 h-12 w-full rounded-xl border bg-white px-4"
          />
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-[#fff0eb] p-3 text-xs font-semibold text-[#a33d1c]"
          >
            {error}
          </p>
        )}
        <button
          disabled={pending}
          className="w-full rounded-xl bg-black py-3.5 text-xs font-bold text-white disabled:opacity-50"
        >
          {pending ? "Checking…" : "Check warranty"}
        </button>
      </form>
      <section className="card min-h-64 p-6">
        {result ? (
          <>
            <p className="eyebrow">Verified order</p>
            <h2 className="display mt-2 text-2xl font-bold">
              {result.orderCode}
            </h2>
            <p className="mt-2 text-sm text-[#77776f]">
              {result.customer} · {result.paymentStatus} ·{" "}
              {result.fulfillmentStatus}
            </p>
            <div className="mt-5 space-y-3">
              {result.items.map((item, index) => (
                <div
                  key={`${item.name}-${index}`}
                  className="rounded-xl bg-[#f1efe8] p-4"
                >
                  <p className="font-bold">{item.name}</p>
                  <p className="mt-1 text-xs text-[#77776f]">
                    {item.identifier || "Identifier assigned during handover"}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold">
                      {item.warrantyMonths} month warranty ·{" "}
                      {item.warrantyStarts} to {item.validUntil}
                    </p>
                    <span
                      className={`pill py-1 ${item.coverageStatus === "Active" ? "bg-[#effbdd] text-[#416b17]" : item.coverageStatus === "Expired" ? "bg-[#fff0eb] text-[#9c3212]" : "bg-[#fff8dc] text-[#7a620d]"}`}
                    >
                      {item.coverageStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="grid h-full min-h-52 place-items-center text-center text-sm text-[#77776f]">
            Enter the order code and the same phone number used at checkout.
          </div>
        )}
      </section>
    </div>
  );
}
