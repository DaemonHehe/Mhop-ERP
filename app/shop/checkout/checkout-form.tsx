"use client";

import { useEffect, useState, useTransition } from "react";
import { createOrder } from "@/app/actions/store";
import { ArrowRight, WalletCards } from "lucide-react";
import {
  calculateOrderShipping,
  clientConfig,
  type ShippingZone,
} from "@/lib/client-config";
import { formatMMK } from "@/lib/data";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        initDataUnsafe?: {
          user?: {
            id?: number;
            first_name?: string;
            last_name?: string;
            username?: string;
          };
        };
      };
    };
  }
}

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
  const [zone] = useState<ShippingZone>("yangonInner");
  const [customerName, setCustomerName] = useState("");
  const [telegramUserId, setTelegramUserId] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      const user = tg.initDataUnsafe?.user;
      if (user) {
        if (user.id) setTelegramUserId(String(user.id));
        const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || "";
        if (fullName) setCustomerName(fullName);
      }
    }
  }, []);

  const shipping = calculateOrderShipping(total, zone, digitalOnly);
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
      {telegramUserId && <input type="hidden" name="telegramUserId" value={telegramUserId} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="checkout-customer-name" className="text-xs font-bold">
            Customer name
          </label>
          <input
            id="checkout-customer-name"
            name="customerName"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
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
