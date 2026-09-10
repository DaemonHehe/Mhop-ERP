"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { createOrder, lookupCustomerLoyaltyAction, type CustomerLoyaltyProfile } from "@/app/actions/store";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Crown,
  MapPin,
  Send,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { calculateTierPerks } from "@/lib/loyalty";
import { clientConfig } from "@/lib/client-config";
import { formatMMK } from "@/lib/data";
import {
  CHECKOUT_CITIES,
  SUSPENDED_DELIVERY_NOTICE,
  isLocationSuspended,
} from "@/lib/shipping/destinations-data";
import {
  calculateRoyalDelivery,
  calculateRequiredDeposit,
} from "@/lib/shipping/royal-rates";

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
  requiredDeposit: number;
  codAmount: number;
  destinationCity: string;
  paymentMethod: "kbzpay" | "wavepay" | "bank";
  customerName: string;
  phone: string;
  isDigitalOnly: boolean;
}

export function CheckoutForm({
  total,
  skus,
  bundleIds,
  disabled,
  digitalOnly,
  isMixedCart,
}: {
  total: number;
  skus: string[];
  bundleIds: string[];
  disabled: boolean;
  digitalOnly: boolean;
  isMixedCart?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [selectedCity, setSelectedCity] = useState("Yangon");
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

  const [phone, setPhone] = useState("");
  const [loyalty, setLoyalty] = useState<CustomerLoyaltyProfile | null>(null);

  useEffect(() => {
    const clean = phone.trim().replace(/[^\d+]/g, "");
    if (clean.length < 8 && !telegramUserId) {
      setLoyalty((prev) => (prev?.found ? null : prev));
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      try {
        const res = await lookupCustomerLoyaltyAction({
          phone: clean.length >= 8 ? clean : null,
          telegramUserId: telegramUserId || null,
        });
        if (active && res) {
          setLoyalty(res);
        }
      } catch (err) {
        console.error("Loyalty lookup error", err);
      }
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [phone, telegramUserId]);

  const deliverySnapshot = calculateRoyalDelivery({
    destinationCity: selectedCity,
    weightKg: 1.0,
    isDigitalOnly: digitalOnly,
  });

  const customerTier = loyalty?.tier || "member";
  const standardShipping = digitalOnly ? 0 : deliverySnapshot.customerDeliveryFee;
  const tierPerks = calculateTierPerks(customerTier, total, standardShipping);

  const discountAmount = tierPerks.productDiscountAmount;
  const discountedSubtotal = tierPerks.netProductSubtotal;
  const shipping = digitalOnly ? 0 : tierPerks.netDeliveryFee;
  const orderTotal = discountedSubtotal + shipping;
  const pointsToEarn = tierPerks.pointsToEarn;
  const requiredDeposit = calculateRequiredDeposit(orderTotal, digitalOnly);
  const codAmount = Math.max(0, orderTotal - requiredDeposit);

  const submit = (form: FormData) =>
    startTransition(async () => {
      setMessage("");
      if (!digitalOnly && isLocationSuspended(selectedCity)) {
        setMessage(SUSPENDED_DELIVERY_NOTICE);
        return;
      }
      form.set("destinationCity", selectedCity);
      form.set("weightKg", "1.0");
      form.set("orderSource", "web");
      const result = await createOrder(form);
      if (result.ok && result.data?.orderCode) {
        const pMethod =
          (form.get("paymentMethod") as "kbzpay" | "wavepay" | "bank") ||
          "kbzpay";
        const cName = (form.get("customerName") as string) || customerName;
        const cPhone = (form.get("phone") as string) || "";
        setCompletedOrder({
          orderCode: result.data.orderCode,
          total: orderTotal,
          requiredDeposit,
          codAmount,
          destinationCity: deliverySnapshot.destinationCity,
          paymentMethod: pMethod,
          customerName: cName,
          phone: cPhone,
          isDigitalOnly: digitalOnly,
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

          <div className="mt-4 space-y-2 border-t border-[#f1efe8] pt-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#777]">Order Total · စုစုပေါင်း</span>
              <span className="font-bold text-black">
                {formatMMK(completedOrder.total)}
              </span>
            </div>
            <div className="flex items-center justify-between font-bold text-[#ff6b35]">
              <span>Deposit Required Now · ယခုလွှဲရမည့် စရန်ငွေ</span>
              <span>{formatMMK(completedOrder.requiredDeposit)}</span>
            </div>
            {!completedOrder.isDigitalOnly && (
              <div className="flex items-center justify-between text-[#555]">
                <span>Remaining COD on Delivery · ပစ္စည်းရောက်မှ ပေးချေရန်</span>
                <span className="font-bold text-black">
                  {formatMMK(completedOrder.codAmount)}
                </span>
              </div>
            )}
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
                {completedOrder.isDigitalOnly
                  ? "Transfer Full Amount: "
                  : "Deposit to Transfer Now: "}
                <strong className="font-bold text-[#ff6b35]">
                  {formatMMK(completedOrder.requiredDeposit)}
                </strong>
              </p>
            </div>
          </div>
          <div className="mt-3 text-xs leading-5 text-[#62635d]">
            {completedOrder.isDigitalOnly ? (
              <>
                💡 PUBG Account မှာ 100% Prepayment စနစ်ဖြစ်ပါသဖြင့် စုစုပေါင်း{" "}
                <strong>{formatMMK(completedOrder.total)}</strong> ကို
                လွှဲပေးပြီးပါက <strong>Payment Slip (ငွေလွှဲပြေစာပုံ)</strong> ကို Order
                Code <strong>{completedOrder.orderCode}</strong> နှင့်အတူ Telegram
                Bot သို့ ပေးပို့ပေးပါခင်ဗျာ။ Admin Team မှ အကောင့်အချက်အလက်ကို
                ချက်ချင်း လွှဲပြောင်းပေးပါမည်။
              </>
            ) : (
              <>
                💡 စရန်ငွေ{" "}
                <strong>{formatMMK(completedOrder.requiredDeposit)}</strong> ကို
                လွှဲပြီးပါက <strong>Payment Slip (ငွေလွှဲပြေစာပုံ)</strong> ကို Order
                Code <strong>{completedOrder.orderCode}</strong> နှင့်အတူ Telegram
                Bot သို့ ပေးပို့ပေးပါခင်ဗျာ။ စရန်ငွေ စစ်ဆေးအတည်ပြုပြီးသည်နှင့်
                Royal Express ဖြင့် ထုတ်ပိုးပို့ဆောင်ပေးမည်ဖြစ်ပြီး ကျန်ငွေ{" "}
                <strong>{formatMMK(completedOrder.codAmount)}</strong> ကို
                ပစ္စည်းရောက်ရှိချိန်တွင် Royal Express courier သို့ ပေးချေနိုင်ပါသည်။
              </>
            )}
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

      {isMixedCart && (
        <div className="mt-4 rounded-xl border border-[#ffcdbe] bg-[#fff2ee] p-4 text-xs text-[#b83814]">
          <p className="font-bold">⚠️ Mixed Cart Not Allowed</p>
          <p className="mt-1">
            PUBG accounts require full prepayment, whereas physical items require 10,000 MMK deposit + Royal Express COD. Please separate into two orders.
          </p>
        </div>
      )}

      <form action={submit} className="mt-8 space-y-4">
        <input type="hidden" name="skus" value={skus.join(",")} />
        <input type="hidden" name="bundleIds" value={bundleIds.join(",")} />
        <input type="hidden" name="destinationCity" value={selectedCity} />
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
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09..."
              required
              maxLength={40}
              className="mt-2 h-12 w-full rounded-xl border bg-white px-4"
            />
          </div>
        </div>

        {/* Customer Loyalty Tier & Perks Banner */}
        {loyalty?.found ? (
          <div
            className={`rounded-2xl border p-4 ${
              customerTier === "platinum"
                ? "border-purple-200 bg-purple-50/80 text-purple-950"
                : customerTier === "gold"
                  ? "border-amber-200 bg-amber-50/80 text-amber-950"
                  : customerTier === "silver"
                    ? "border-blue-200 bg-blue-50/80 text-blue-950"
                    : "border-[#e3e0d5] bg-[#f8f7f2] text-[#333]"
            } shadow-sm transition-all`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl leading-none">{loyalty.icon}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-extrabold text-sm">
                      {loyalty.tierName} Member ({loyalty.points} pts)
                    </p>
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border border-black/10">
                      {loyalty.burmeseName}
                    </span>
                  </div>
                  <p className="mt-1 text-xs opacity-90">
                    {loyalty.perks.description}
                  </p>
                </div>
              </div>
              {loyalty.progress.nextTier && (
                <div className="text-right shrink-0">
                  <p className="text-[10px] uppercase font-bold tracking-wider opacity-70">
                    Next Tier
                  </p>
                  <p className="text-xs font-bold capitalize">
                    +{loyalty.progress.pointsNeeded} pts to {loyalty.progress.nextTier}
                  </p>
                </div>
              )}
            </div>

            {(customerTier === "silver" || customerTier === "gold" || customerTier === "platinum") && (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-black/5 pt-2.5 text-xs font-bold">
                <span className="inline-flex items-center gap-1 rounded-lg bg-white/90 px-2.5 py-1 text-[#2e7d32] shadow-xs">
                  <Check size={13} />
                  <span>Free Delivery Perk Active</span>
                </span>
                {customerTier === "gold" && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-white/90 px-2.5 py-1 text-[#b45309] shadow-xs">
                    <Sparkles size={13} />
                    <span>5% Product Discount Active (-{formatMMK(discountAmount)})</span>
                  </span>
                )}
                {customerTier === "platinum" && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-white/90 px-2.5 py-1 text-[#7e22ce] shadow-xs">
                    <Crown size={13} />
                    <span>10% Product Discount Active (-{formatMMK(discountAmount)})</span>
                  </span>
                )}
              </div>
            )}
          </div>
        ) : phone.trim().length >= 8 ? (
          <div className="rounded-2xl border border-dashed border-[#d8d5cb] bg-[#fbfaf6] p-3.5 text-xs text-[#666a60]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span>👤</span>
                <p>
                  <strong>New Customer</strong> · Earn <strong>1 point</strong> per <strong>1,000 MMK</strong> spent! Reach 200 pts for <strong>Free Delivery</strong>.
                </p>
              </div>
              <span className="shrink-0 font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-[10px]">
                +{pointsToEarn} pts to earn
              </span>
            </div>
          </div>
        ) : null}

        {!digitalOnly && (
          <div className="space-y-4">
            {/* Suspended Delivery Routes Alert */}
            <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-3.5 text-xs text-amber-950 shadow-sm">
              <div className="flex items-start gap-2">
                <span className="text-base leading-none">⚠️</span>
                <div className="space-y-1">
                  <p className="font-bold text-amber-900">
                    ပို့ဆောင်မှု ယာယီရပ်ဆိုင်းထားသော နယ်မြေများ အသိပေးချက်
                  </p>
                  <p className="leading-relaxed text-amber-900/90 font-medium">
                    {SUSPENDED_DELIVERY_NOTICE}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="checkout-city"
                className="text-xs font-bold text-[#1f1f1d]"
              >
                City · မြို့ (Royal Express)
              </label>
              <div className="mt-2">
                <select
                  id="checkout-city"
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  required
                  className="h-12 w-full rounded-xl border border-[#dcd9cf] bg-white px-3.5 text-sm font-semibold text-[#1f1f1d] shadow-sm transition hover:border-black focus:border-black focus:outline-none"
                >
                  {CHECKOUT_CITIES.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}- {c.fee.toLocaleString()} MMK
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-1.5 flex items-center gap-1 text-[11px] text-[#777]">
                <MapPin size={12} />
                <span>
                  Royal Express Delivery to <strong>{selectedCity}</strong>:{" "}
                  {formatMMK(shipping)}
                </span>
              </p>
            </div>

            <div>
              <label htmlFor="checkout-address" className="text-xs font-bold">
                Street address / Ward / Building · လမ်း၊ ရပ်ကွက်၊ အိမ်အမှတ်
              </label>
              <textarea
                id="checkout-address"
                name="shippingAddress"
                required
                maxLength={500}
                placeholder="အိမ်အမှတ်၊ လမ်းအမည်၊ ရပ်ကွက် သို့မဟုတ် အနီးအနား အထင်ကရနေရာ..."
                className="mt-2 min-h-24 w-full rounded-xl border bg-white p-3 text-sm"
              />
            </div>
          </div>
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
          <div className="mt-3 grid gap-2">
            {paymentEntries.map(([key, payment], index) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition hover:bg-[#faf9f6]"
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={key}
                  defaultChecked={index === 0}
                />
                <span className="text-xs font-bold text-[#1f1f1d]">
                  {payment.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Pricing Breakdown Card */}
        <div className="rounded-xl border border-[#dedbd1] bg-[#f7f6f1] p-4 space-y-2 text-xs">
          <div className="flex justify-between text-[#666]">
            <span>Products Subtotal · ပစ္စည်းတန်ဖိုး</span>
            <span className="font-semibold text-black">{formatMMK(total)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between font-bold text-[#2e7d32]">
              <span className="flex items-center gap-1">
                <Sparkles size={13} />
                <span>{loyalty?.tierName} VIP Perk ({tierPerks.discountPercent}% Discount)</span>
              </span>
              <span>-{formatMMK(discountAmount)}</span>
            </div>
          )}
          {!digitalOnly && (
            <div className="flex justify-between text-[#666]">
              <span>Delivery Fee ({deliverySnapshot.destinationCity})</span>
              {tierPerks.isFreeDelivery ? (
                <span className="font-bold text-[#2e7d32]">
                  <span className="line-through text-[#888] mr-1.5 font-normal">
                    {formatMMK(standardShipping)}
                  </span>
                  FREE · အခမဲ့ (VIP Perk)
                </span>
              ) : (
                <span className="font-semibold text-black">
                  {formatMMK(shipping)}
                </span>
              )}
            </div>
          )}
          <div className="flex justify-between border-t border-[#e5e2d8] pt-2 text-sm font-bold text-black">
            <span>Total Order Amount · စုစုပေါင်း</span>
            <span>{formatMMK(orderTotal)}</span>
          </div>
          <div className="flex justify-between rounded-lg bg-[#fef9c3] p-2.5 font-bold text-[#854d0e]">
            <span className="flex items-center gap-1.5">
              <span>⭐</span>
              <span>Points earned on this order · ရရှိမည့် Point</span>
            </span>
            <span>+{pointsToEarn} pts</span>
          </div>
          <div className="flex justify-between rounded-lg bg-[#effbdc] p-2.5 font-bold text-[#376911]">
            <span>Deposit to pay now · ယခုလွှဲရမည့် စရန်ငွေ</span>
            <span>{formatMMK(requiredDeposit)}</span>
          </div>
          {!digitalOnly && (
            <div className="flex justify-between rounded-lg bg-[#fff8e8] p-2.5 font-bold text-[#9e5d00]">
              <span>Pay Royal on delivery (COD) · ပစ္စည်းရောက်မှ ပေးချေရန်</span>
              <span>{formatMMK(codAmount)}</span>
            </div>
          )}
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
