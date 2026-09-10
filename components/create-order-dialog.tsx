"use client";

import { useState, useEffect, useTransition } from "react";
import { createPortal } from "react-dom";
import { Plus, Trash2, X, Calculator, AlertCircle } from "lucide-react";
import { formatMMK } from "@/lib/data";
import { DESTINATIONS_BY_STATE } from "@/lib/shipping/destinations-data";
import {
  calculateRoyalDelivery,
  calculateRequiredDeposit,
  getStateDeliveryFee,
  isLocationSuspended,
  SUSPENDED_DELIVERY_NOTICE,
} from "@/lib/shipping/royal-rates";
import { adminCreateOrderAction, type InventoryItem } from "@/app/actions/store";

interface CreateOrderDialogProps {
  open: boolean;
  onClose: () => void;
  inventory?: InventoryItem[];
}

interface OrderItemRow {
  sku: string;
  quantity: number;
  agreedPrice?: number;
}

const CHANNELS = [
  { value: "facebook", label: "Facebook Page" },
  { value: "messenger", label: "Messenger" },
  { value: "tiktok", label: "TikTok Shop / DM" },
  { value: "viber", label: "Viber" },
  { value: "telegram", label: "Telegram Direct" },
  { value: "phone", label: "Phone Call" },
  { value: "walk_in", label: "Walk-in Store" },
  { value: "web", label: "Web Storefront" },
  { value: "other", label: "Other Channel" },
] as const;

export function CreateOrderDialog({
  open,
  onClose,
  inventory = [],
}: CreateOrderDialogProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [orderSource, setOrderSource] =
    useState<(typeof CHANNELS)[number]["value"]>("facebook");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [telegramUserId, setTelegramUserId] = useState("");
  const [selectedCity, setSelectedCity] = useState("Yangon");
  const [citySearch, setCitySearch] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const packedWeightKg = 1.0;
  const [customDeliveryFee, setCustomDeliveryFee] = useState<string>("");
  const [customCourierCost, setCustomCourierCost] = useState<string>("");
  const [customDeposit, setCustomDeposit] = useState<string>("");
  const [internalNotes, setInternalNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"kbzpay" | "wavepay" | "bank" | "cash">("kbzpay");
  const [items, setItems] = useState<OrderItemRow[]>([
    { sku: inventory[0]?.sku || "", quantity: 1 },
  ]);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  if (!open || !mounted) return null;

  // Compute products subtotal
  let productsSubtotal = 0;
  let hasDigital = false;
  let hasPhysical = false;

  for (const item of items) {
    const inv = inventory.find((i) => i.sku === item.sku);
    const unitPrice = item.agreedPrice != null && item.agreedPrice >= 0
      ? item.agreedPrice
      : (inv?.price || 0);
    productsSubtotal += unitPrice * item.quantity;
    if (inv?.category === "PUBG Accounts") {
      hasDigital = true;
    } else if (inv) {
      hasPhysical = true;
    }
  }

  const isDigitalOnly = hasDigital && !hasPhysical;
  const isMixed = hasDigital && hasPhysical;

  const royalDelivery = calculateRoyalDelivery({
    destinationCity: selectedCity,
    weightKg: packedWeightKg,
    isDigitalOnly,
    customNormalPrice: customDeliveryFee ? Number(customDeliveryFee) : undefined,
    customCourierCost: customCourierCost ? Number(customCourierCost) : undefined,
  });

  const effectiveDeliveryFee = customDeliveryFee
    ? Number(customDeliveryFee)
    : royalDelivery.customerDeliveryFee;

  const totalAmount = productsSubtotal + effectiveDeliveryFee;

  const standardDeposit = calculateRequiredDeposit(totalAmount, isDigitalOnly);
  const effectiveDeposit = customDeposit !== "" && Number(customDeposit) >= 0
    ? Math.min(totalAmount, Number(customDeposit))
    : standardDeposit;

  const codAmount = Math.max(0, totalAmount - effectiveDeposit);

  const addItemRow = () => {
    const firstAvailable = inventory.find((i) => !items.some((row) => row.sku === i.sku)) || inventory[0];
    if (firstAvailable) {
      setItems([...items, { sku: firstAvailable.sku, quantity: 1 }]);
    }
  };

  const removeItemRow = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItemRow = (index: number, updates: Partial<OrderItemRow>) => {
    setItems(
      items.map((row, i) => (i === index ? { ...row, ...updates } : row)),
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!customerName.trim() || !phone.trim()) {
      setError("Customer name and phone number are required.");
      return;
    }

    if (!items.length || items.some((i) => !i.sku || i.quantity < 1)) {
      setError("Please select valid items and quantities.");
      return;
    }

    startTransition(async () => {
      const payload = {
        orderSource,
        customerName: customerName.trim(),
        phone: phone.trim(),
        telegramUserId: telegramUserId.trim() || undefined,
        destinationCity: isDigitalOnly ? "Digital" : selectedCity,
        shippingAddress: isDigitalOnly ? "Digital Delivery" : shippingAddress.trim(),
        packedWeightKg,
        requiredDeposit: effectiveDeposit,
        customDeliveryFee: customDeliveryFee ? Number(customDeliveryFee) : undefined,
        customCourierCost: customCourierCost ? Number(customCourierCost) : undefined,
        internalNotes: internalNotes.trim(),
        paymentMethod,
        items: items.map((i) => ({
          sku: i.sku,
          quantity: i.quantity,
          agreedPrice: i.agreedPrice != null ? i.agreedPrice : undefined,
        })),
      };

      const res = await adminCreateOrderAction(payload);
      if (res.ok) {
        onClose();
      } else {
        setError(res.error || "Failed to create order");
      }
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#1f1f1d]">
              Create Admin Order · အော်ဒါအသစ်ဖွင့်ရန်
            </h2>
            <p className="text-xs text-[#777]">
              Multi-channel order creation with Royal Express delivery rates and COD
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-gray-400 hover:bg-gray-100 hover:text-black"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto min-h-0 p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {isMixed && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
              ⚠️ Note: You have mixed PUBG accounts and physical gadgets. Digital accounts require full prepayment, while gadgets support COD.
            </div>
          )}

          {/* Channel & Customer Info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-[#333]">Order Source Channel</label>
              <select
                value={orderSource}
                onChange={(e) =>
                  setOrderSource(e.target.value as (typeof CHANNELS)[number]["value"])
                }
                className="mt-1.5 h-10 w-full rounded-xl border px-3 text-xs font-semibold"
              >
                {CHANNELS.map((ch) => (
                  <option key={ch.value} value={ch.value}>
                    {ch.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-[#333]">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as "kbzpay" | "wavepay" | "bank" | "cash")
                }
                className="mt-1.5 h-10 w-full rounded-xl border px-3 text-xs font-semibold"
              >
                <option value="kbzpay">KBZPay</option>
                <option value="wavepay">WavePay</option>
                <option value="bank">Bank Transfer</option>
                <option value="cash">Cash / Walk-in</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-[#333]">Customer Name *</label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Ko Thura"
                className="mt-1.5 h-10 w-full rounded-xl border px-3 text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#333]">Phone Number *</label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09..."
                className="mt-1.5 h-10 w-full rounded-xl border px-3 text-xs font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-[#333]">Telegram User ID (Optional)</label>
              <input
                type="text"
                value={telegramUserId}
                onChange={(e) => setTelegramUserId(e.target.value)}
                placeholder="Telegram ID for receipt delivery"
                className="mt-1.5 h-10 w-full rounded-xl border px-3 text-xs"
              />
            </div>
          </div>

          {/* Items Selection */}
          <div className="space-y-3 rounded-2xl border border-[#dedbd1] bg-[#faf9f6] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-black uppercase tracking-wider">
                Order Items & Pricing
              </span>
              <button
                type="button"
                onClick={addItemRow}
                className="inline-flex items-center gap-1 rounded-lg border border-[#dcd9cf] bg-white px-2.5 py-1 text-xs font-bold text-black hover:bg-gray-50"
              >
                <Plus size={14} /> Add Item
              </button>
            </div>

            {items.map((row, index) => {
              const currentInv = inventory.find((i) => i.sku === row.sku);
              return (
                <div key={index} className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-2.5 border">
                  <div className="flex-1 min-w-[200px]">
                    <select
                      value={row.sku}
                      onChange={(e) => updateItemRow(index, { sku: e.target.value })}
                      className="h-9 w-full rounded-lg border px-2 text-xs font-semibold"
                    >
                      {inventory.map((inv) => (
                        <option key={inv.sku} value={inv.sku}>
                          {inv.name} ({inv.sku}) — {formatMMK(inv.price)} [Stock: {inv.stock}]
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-20">
                    <input
                      type="number"
                      min={1}
                      value={row.quantity}
                      onChange={(e) => updateItemRow(index, { quantity: Number(e.target.value) || 1 })}
                      className="h-9 w-full rounded-lg border px-2 text-center text-xs font-bold"
                    />
                  </div>

                  <div className="w-28">
                    <input
                      type="number"
                      placeholder={currentInv ? String(currentInv.price) : "Price"}
                      value={row.agreedPrice != null ? row.agreedPrice : ""}
                      onChange={(e) =>
                        updateItemRow(index, {
                          agreedPrice: e.target.value !== "" ? Number(e.target.value) : undefined,
                        })
                      }
                      className="h-9 w-full rounded-lg border px-2 text-right text-xs font-mono"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItemRow(index)}
                    disabled={items.length === 1}
                    className="p-2 text-gray-400 hover:text-rose-600 disabled:opacity-30"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Delivery & Destination */}
          {!isDigitalOnly && (
            <div className="space-y-4 rounded-2xl border border-[#dedbd1] bg-[#faf9f6] p-4">
              <span className="text-xs font-bold text-black uppercase tracking-wider">
                Royal Express Delivery Destination (227 Cities)
              </span>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] font-bold text-gray-600">
                    Search & Select City
                  </label>
                  <input
                    type="text"
                    placeholder="Search city..."
                    value={citySearch}
                    onChange={(e) => setCitySearch(e.target.value)}
                    className="mb-1.5 h-8 w-full rounded-lg border bg-white px-2.5 text-xs"
                  />
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="h-10 w-full rounded-xl border bg-white px-3 text-xs font-semibold"
                  >
                    {DESTINATIONS_BY_STATE.map((group) => {
                      const filteredCities = citySearch
                        ? group.cities.filter(
                            (c) =>
                              c.toCity
                                .toLowerCase()
                                .includes(citySearch.toLowerCase()) ||
                              group.stateName
                                .toLowerCase()
                                .includes(citySearch.toLowerCase()),
                          )
                        : group.cities;
                      if (!filteredCities.length) return null;
                      const regionalFee = getStateDeliveryFee(group.stateName);
                      return (
                        <optgroup
                          key={group.stateCode}
                          label={`${group.stateName} (${group.stateCode}) — ${formatMMK(regionalFee)}`}
                        >
                          {filteredCities.map((c) => {
                            const isSuspended = isLocationSuspended(c.toCity, c.stateName);
                            return (
                              <option key={c.srNo} value={c.toCity}>
                                {isSuspended ? "⚠️ [Suspended] " : ""}
                                {c.toCity} — {formatMMK(regionalFee)} (Royal: {formatMMK(c.courierCost)})
                              </option>
                            );
                          })}
                        </optgroup>
                      );
                    })}
                  </select>
                  {isLocationSuspended(selectedCity) && (
                    <div className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-950">
                      <p className="font-bold flex items-center gap-1 text-amber-900">
                        <span>⚠️ လမ်းခရီးအခက်အခဲကြောင့် ပို့ဆောင်မှု ယာယီရပ်ဆိုင်းထားပါသည်</span>
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-amber-900/90 font-medium">
                        {SUSPENDED_DELIVERY_NOTICE}
                      </p>
                    </div>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-gray-600">
                    Street Address & Landmarks
                  </label>
                  <textarea
                    rows={2}
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    placeholder="House number, street name, ward..."
                    className="mt-1 w-full rounded-xl border bg-white p-2.5 text-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-600">
                    Override Customer Delivery Fee (Optional)
                  </label>
                  <input
                    type="number"
                    placeholder={`Standard: ${royalDelivery.customerDeliveryFee}`}
                    value={customDeliveryFee}
                    onChange={(e) => setCustomDeliveryFee(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border bg-white px-2.5 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-600">
                    Override Courier Expected Cost (Optional)
                  </label>
                  <input
                    type="number"
                    placeholder={`Standard: ${royalDelivery.expectedCourierCost}`}
                    value={customCourierCost}
                    onChange={(e) => setCustomCourierCost(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border bg-white px-2.5 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Financials & Required Deposit Override */}
          <div className="rounded-2xl border border-[#dedbd1] bg-[#f5f4ed] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-black uppercase tracking-wider flex items-center gap-1.5">
                <Calculator size={14} /> Settlement & Deposit Breakdown
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 text-xs">
              <div className="flex justify-between rounded-lg bg-white p-2.5 border">
                <span className="text-gray-600">Products Subtotal:</span>
                <span className="font-bold">{formatMMK(productsSubtotal)}</span>
              </div>

              <div className="flex justify-between rounded-lg bg-white p-2.5 border">
                <span className="text-gray-600">Customer Delivery Charge:</span>
                <span className="font-bold">{formatMMK(effectiveDeliveryFee)}</span>
              </div>

              <div className="flex justify-between rounded-lg bg-white p-2.5 border">
                <span className="text-gray-600">Expected Royal Deduction:</span>
                <span className="font-bold text-rose-600">
                  {formatMMK(customCourierCost ? Number(customCourierCost) : royalDelivery.expectedCourierCost)}
                </span>
              </div>

              <div className="flex justify-between rounded-lg bg-white p-2.5 border font-bold">
                <span>Total Order Amount:</span>
                <span className="text-black">{formatMMK(totalAmount)}</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t">
              <div>
                <label className="text-xs font-bold text-[#333]">
                  Required Deposit (MMK)
                </label>
                <input
                  type="number"
                  placeholder={`Default: ${standardDeposit}`}
                  value={customDeposit}
                  onChange={(e) => setCustomDeposit(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border bg-white px-2.5 text-xs font-bold text-emerald-700"
                />
                <p className="mt-1 text-[10px] text-gray-500">
                  Standard deposit is 10,000 MMK (or 100% for PUBG accounts)
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-[#333]">
                  Customer Pays Royal COD on Delivery
                </label>
                <div className="mt-1 flex h-9 items-center justify-end rounded-lg bg-white px-3 font-mono text-sm font-bold text-amber-700 border">
                  {formatMMK(codAmount)}
                </div>
                <p className="mt-1 text-[10px] text-gray-500">
                  Order total minus required deposit
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[#333]">Internal Notes</label>
            <textarea
              rows={2}
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Staff notes, delivery special instructions..."
              className="mt-1 w-full rounded-xl border p-2.5 text-xs"
            />
          </div>

          {/* Footer Submit */}
          <div className="flex items-center justify-end gap-3 border-t pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || productsSubtotal <= 0}
              className="rounded-xl bg-black px-6 py-2.5 text-xs font-bold text-white hover:bg-gray-800 disabled:opacity-50 shadow-md"
            >
              {pending ? "Creating Order..." : "Create Order"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
