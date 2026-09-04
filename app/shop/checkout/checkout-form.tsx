"use client";

import { useState, useTransition } from "react";
import { createOrder } from "@/app/actions/store";
import { ArrowRight, Truck, WalletCards } from "lucide-react";
import {
  calculateOrderShipping,
  clientConfig,
  type ShippingZone,
} from "@/lib/client-config";
import { formatMMK } from "@/lib/data";

const paymentEntries = [
  ["kbzpay", clientConfig.payments.kbzPay],
  ["wavepay", clientConfig.payments.wavePay],
  ["bank", clientConfig.payments.bank],
] as const;

export function CheckoutForm({
  total,
  skus,
  bundleIds,
  disabled,
  digitalOnly,
}: {
  total: number;
  skus: string[];
  bundleIds: string[];
  disabled: boolean;
  digitalOnly: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [zone, setZone] = useState<ShippingZone>("yangonInner");
  const shipping = calculateOrderShipping(total, zone, digitalOnly);
  const rule = clientConfig.shipping.zones[zone];
  const submit = (form: FormData) =>
    startTransition(async () => {
      const result = await createOrder(form);
      setMessage(
        result.ok
          ? `Order ${result.data?.orderCode} was created. Payment slip ကို ${clientConfig.telegram.handle} သို့ ပေးပို့နိုင်ပါတယ်ခင်ဗျာ။`
          : result.error,
      );
    });

  return (
    <form action={submit} className="mt-8 space-y-4">
      <input type="hidden" name="skus" value={skus.join(",")} />
      <input type="hidden" name="bundleIds" value={bundleIds.join(",")} />
      <input type="hidden" name="shippingZone" value={zone} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="checkout-customer-name" className="text-xs font-bold">
            Customer name
          </label>
          <input
            id="checkout-customer-name"
            name="customerName"
            required
            maxLength={120}
            className="mt-2 h-12 w-full rounded-xl border bg-white px-4"
          />
        </div>
        <div>
          <label htmlFor="checkout-phone" className="text-xs font-bold">
            Phone
          </label>
          <input
            id="checkout-phone"
            name="phone"
            required
            maxLength={40}
            className="mt-2 h-12 w-full rounded-xl border bg-white px-4"
          />
        </div>
      </div>
      {!digitalOnly && (
        <>
          <div>
            <label htmlFor="checkout-address" className="text-xs font-bold">
              Delivery address
            </label>
            <textarea
              id="checkout-address"
              name="shippingAddress"
              required
              maxLength={500}
              className="mt-2 min-h-28 w-full rounded-xl border bg-white p-4"
            />
          </div>
          <div className="rounded-xl border bg-white p-4">
            <div className="flex items-center gap-2">
              <Truck size={16} />
              <p className="text-xs font-bold">Royal Express delivery</p>
            </div>
            <select
              aria-label="Delivery zone"
              value={zone}
              onChange={(event) => setZone(event.target.value as ShippingZone)}
              className="mt-3 h-11 w-full rounded-xl border bg-[#f7f5ef] px-3 text-sm"
            >
              {Object.entries(clientConfig.shipping.zones).map(
                ([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ),
              )}
            </select>
            <div className="mt-3 flex justify-between text-xs">
              <span>
                {rule.leadTime} · Free above {formatMMK(rule.freeAbove)}
              </span>
              <b>{shipping === 0 ? "FREE" : formatMMK(shipping)}</b>
            </div>
          </div>
        </>
      )}
      {digitalOnly && (
        <input
          type="hidden"
          name="shippingAddress"
          value="Secure digital handover"
        />
      )}
      <fieldset className="rounded-xl border bg-white p-4">
        <legend className="px-1 text-xs font-bold">Payment method</legend>
        <div className="mt-1 flex items-center gap-2 text-xs text-[#77776f]">
          <WalletCards size={15} />
          <span>
            ငွေလွှဲပြီးပါက slip ကို {clientConfig.telegram.handle} သို့
            ပေးပို့ပါခင်ဗျာ။
          </span>
        </div>
        <div className="mt-3 grid gap-2">
          {paymentEntries.map(([key, payment], index) => (
            <label
              key={key}
              className="flex cursor-pointer items-start gap-3 rounded-xl border p-3"
            >
              <input
                type="radio"
                name="paymentMethod"
                value={key}
                defaultChecked={index === 0}
                className="mt-1"
              />
              <span className="text-xs">
                <b className="block">{payment.label}</b>
                <span className="text-[#77776f]">
                  {payment.holder} · {payment.account}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex justify-between rounded-xl bg-[#f1efe8] p-4 text-sm font-bold">
        <span>Order total</span>
        <span>{formatMMK(total + shipping)}</span>
      </div>
      {message && (
        <p
          role="status"
          className="rounded-xl bg-[#f1efe8] p-3 text-xs font-semibold"
        >
          {message}
        </p>
      )}
      <button
        disabled={disabled || pending}
        className="flex w-full items-center justify-between rounded-xl bg-black px-5 py-4 text-xs font-bold text-white disabled:opacity-40"
      >
        <span>{pending ? "Creating order…" : "Place order"}</span>
        <ArrowRight size={15} />
      </button>
    </form>
  );
}
