"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { createOrder } from "@/app/actions/store";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Send,
  ShoppingBag,
  WalletCards,
} from "lucide-react";
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
        MainButton?: {
          setText: (text: string) => void;
          show: () => void;
          hide: () => void;
          onClick: (fn: () => void) => void;
          offClick: (fn: () => void) => void;
        };
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

interface CompletedOrderData {
  orderCode: string;
  total: number;
  paymentMethod: "kbzpay" | "wavepay" | "bank";
  customerName: string;
  phone: string;
}

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
  const [completedOrder, setCompletedOrder] =
    useState<CompletedOrderData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      const user = tg.initDataUnsafe?.user;
      if (user) {
        if (user.id) setTelegramUserId(String(user.id));
        const fullName =
          [user.first_name, user.last_name].filter(Boolean).join(" ") ||
          user.username ||
          "";
        if (fullName) setCustomerName(fullName);
      }
    }
  }, []);

  useEffect(() => {
    if (!completedOrder) return;
    const tg =
      typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
    const mainBtn = tg?.MainButton;
    if (mainBtn && tg) {
      try {
        mainBtn.setText("Proceed in Bot · စကားပြောခန်းသို့ သွားမည်");
        mainBtn.show();
        const handleMainClick = () => {
          tg.close();
        };
        mainBtn.onClick(handleMainClick);
        return () => {
          try {
            mainBtn.offClick(handleMainClick);
            mainBtn.hide();
          } catch {
            // ignore cleanup errors
          }
        };
      } catch (err) {
        console.error("Telegram MainButton error", err);
      }
    }
  }, [completedOrder]);

  const shipping = calculateOrderShipping(total, zone, digitalOnly);

  const submit = (form: FormData) =>
    startTransition(async () => {
      setMessage("");
      const result = await createOrder(form);
      if (result.ok && result.data?.orderCode) {
        const pMethod =
          (form.get("paymentMethod") as "kbzpay" | "wavepay" | "bank") ||
          "kbzpay";
        const cName = (form.get("customerName") as string) || customerName;
        const cPhone = (form.get("phone") as string) || "";
        setCompletedOrder({
          orderCode: result.data.orderCode,
          total: total + shipping,
          paymentMethod: pMethod,
          customerName: cName,
          phone: cPhone,
        });
      } else {
        setMessage(
          !result.ok
            ? result.error
            : "အော်ဒါတင်၍ မရသေးပါ။ ထပ်မံကြိုးစားပေးပါခင်ဗျာ။",
        );
      }
    });

  const handleCopy = () => {
    if (completedOrder?.orderCode) {
      navigator.clipboard.writeText(completedOrder.orderCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleProceedInBot = () => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp?.close) {
      try {
        window.Telegram.WebApp.close();
        return;
      } catch (err) {
        console.error("Failed to close Telegram WebApp", err);
      }
    }
    window.open("https://t.me/Mhopassistant_bot", "_blank");
  };

  if (completedOrder) {
    const payment =
      completedOrder.paymentMethod === "wavepay"
        ? clientConfig.payments.wavePay
        : completedOrder.paymentMethod === "bank"
          ? clientConfig.payments.bank
          : clientConfig.payments.kbzPay;

    return (
      <div className="space-y-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#effbdc] px-3.5 py-1.5 text-xs font-extrabold text-[#376911]">
            <CheckCircle2 size={16} />
            <span>
              Order Placed Successfully · အော်ဒါတင်ခြင်း အောင်မြင်ပါသည်
            </span>
          </div>
          <h1 className="display mt-3 text-4xl font-semibold sm:text-5xl">
            Thank you, {completedOrder.customerName || "Customer"}!
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#62635d]">
            လူကြီးမင်း၏ အော်ဒါကို အောင်မြင်စွာ လက်ခံရရှိပြီးပါပြီ။ ငွေလွှဲပြေစာ
            ပေးပို့ရန် အောက်ပါ အချက်အလက်များအတိုင်း ဆက်လက်လုပ်ဆောင်ပေးပါခင်ဗျာ။
          </p>
        </div>

        {/* Order Code Box */}
        <div className="rounded-2xl border border-[#dcd9cf] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#888]">
                Order Code · အော်ဒါနံပါတ်
              </p>
              <p className="mt-1 font-mono text-2xl font-black text-black">
                {completedOrder.orderCode}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-xl border border-[#dedbd1] bg-[#f7f6f1] px-4 py-2 text-xs font-bold text-[#333] transition hover:bg-[#eae8df]"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-[#376911]" />
                  <span className="text-[#376911]">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-[#f1efe8] pt-3 text-xs">
            <span className="text-[#777]">Total Payable · စုစုပေါင်း ကျသင့်ငွေ</span>
            <span className="font-bold text-black">
              {formatMMK(completedOrder.total)}
            </span>
          </div>
        </div>

        {/* Telegram Receipt Notice */}
        <div className="rounded-2xl border border-[#ffd5c4] bg-[#fff5f0] p-4 text-xs">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#ff6b35] text-white">
              <Send size={18} />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-[#b4340d]">
                🧾 ပြေစာ (Receipt Image) ကို Telegram Bot ထံသို့ ပေးပို့ထားပြီးပါပြီ
              </p>
              <p className="leading-5 text-[#884025]">
                သင်၏ Telegram Chat တွင် Branded Sales Receipt
                ပုံကို ပေးပို့ထားပြီး ဖြစ်ပါသည်။ ငွေလွှဲပြေစာနှင့် Warranty
                အတွက် အဆိုပါ Receipt ပုံကို သိမ်းဆည်းထားနိုင်ပါသည်။
              </p>
            </div>
          </div>
        </div>

        {/* Payment Account Details */}
        <div className="rounded-2xl border border-[#dcd9cf] bg-white p-5">
          <p className="text-xs font-bold text-black">
            Payment Transfer Details · ငွေလွှဲရန် အကောင့်အချက်အလက်
          </p>
          <div className="mt-3 rounded-xl bg-[#f7f6f1] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#333]">
                {payment.label}
              </span>
              <span className="rounded-full bg-[#e8e6df] px-2.5 py-0.5 text-[10px] font-bold text-[#555]">
                {completedOrder.paymentMethod.toUpperCase()}
              </span>
            </div>
            <div className="mt-2 space-y-1.5 text-xs">
              <p className="text-[#777]">
                Account Name:{" "}
                <strong className="text-black">{payment.holder}</strong>
              </p>
              <p className="text-[#777]">
                Account Number:{" "}
                <strong className="font-mono text-sm text-black">
                  {payment.account}
                </strong>
              </p>
              <p className="text-[#777]">
                Transfer Amount:{" "}
                <strong className="font-bold text-[#ff6b35]">
                  {formatMMK(completedOrder.total)}
                </strong>
              </p>
            </div>
          </div>
          <div className="mt-3 text-xs leading-5 text-[#62635d]">
            💡 ငွေလွှဲပြီးပါက <strong>Payment Slip (ငွေလွှဲပြေစာပုံ)</strong> ကို Order
            Code <strong>{completedOrder.orderCode}</strong> နှင့်အတူ Telegram Bot
            သို့ ပေးပို့ပေးပါခင်ဗျာ။ Admin Team မှ အမြန်ဆုံး စစ်ဆေးအတည်ပြုပေးပါမည်။
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={handleProceedInBot}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-black py-4 text-sm font-bold text-white shadow-xl transition hover:bg-[#222]"
          >
            <Send size={16} />
            <span>Proceed in Bot · စကားပြောခန်းသို့ သွားမည်</span>
          </button>

          <Link
            href="/shop"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#dcd9cf] bg-white py-3.5 text-xs font-bold text-black transition hover:bg-[#f1efe8]"
          >
            <ShoppingBag size={15} />
            <span>Continue Shopping · စျေးဝယ်ခြင်းသို့ ပြန်သွားမည်</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="eyebrow">Secure checkout</p>
      <h1 className="display mt-2 text-5xl font-semibold">
        Complete your order.
      </h1>

      <form action={submit} className="mt-8 space-y-4">
        <input type="hidden" name="skus" value={skus.join(",")} />
        <input type="hidden" name="bundleIds" value={bundleIds.join(",")} />
        <input type="hidden" name="shippingZone" value={zone} />
        {telegramUserId && (
          <input type="hidden" name="telegramUserId" value={telegramUserId} />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="checkout-customer-name"
              className="text-xs font-bold"
            >
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
            className="rounded-xl bg-[#fff2ee] border border-[#ffcdbe] p-3 text-xs font-semibold text-[#b83814]"
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
    </div>
  );
}
