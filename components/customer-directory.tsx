"use client";

import { useMemo, useState } from "react";
import {
  CreditCard,
  Crown,
  ExternalLink,
  Megaphone,
  Search,
  ShoppingBag,
  Users,
} from "lucide-react";
import type { CustomerSummary } from "@/app/actions/store";
import { formatMMK } from "@/lib/data";
import { TelegramBroadcastModal } from "./telegram-broadcast-modal";
import { TIERS, type CustomerTier } from "@/lib/loyalty";

const normalize = (value: string | null | undefined) =>
  (value || "").trim().toLocaleLowerCase();

const TIER_FILTERS: Array<{ id: "all" | CustomerTier; label: string }> = [
  { id: "all", label: "All Customers" },
  { id: "platinum", label: "Platinum (1,001+)" },
  { id: "gold", label: "Gold (500–1,000)" },
  { id: "silver", label: "Silver (200–499)" },
  { id: "member", label: "Member (0–199)" },
];

export function CustomerDirectory({
  customers,
}: {
  customers: CustomerSummary[];
}) {
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<"all" | CustomerTier>("all");
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const normalized = normalize(query);

  const visible = useMemo(
    () =>
      customers.filter((customer) => {
        if (tierFilter !== "all" && customer.tier !== tierFilter) return false;
        if (!normalized) return true;
        return [
          customer.name,
          customer.customerCode,
          customer.phone,
          customer.secondaryPhone,
          customer.telegramUsername,
          customer.telegramUserId,
          customer.primaryAddress,
        ].some((value) => normalize(value).includes(normalized));
      }),
    [customers, normalized, tierFilter],
  );

  const totalValue = customers.reduce(
    (sum, customer) => sum + customer.lifetime,
    0,
  );

  const silverCount = customers.filter((c) => c.tier === "silver").length;
  const goldCount = customers.filter((c) => c.tier === "gold").length;
  const platinumCount = customers.filter((c) => c.tier === "platinum").length;
  const vipCount = silverCount + goldCount + platinumCount;
  const repeatBuyersCount = customers.filter((c) => c.orders > 1).length;

  const metrics = [
    {
      label: "Customers",
      value: customers.length.toLocaleString(),
      detail:
        customers.length === 1 ? "1 active profile" : `${customers.length} profiles`,
      Icon: Users,
    },
    {
      label: "VIP Members",
      value: vipCount.toLocaleString(),
      detail:
        vipCount > 0
          ? `${silverCount} Silver · ${goldCount} Gold · ${platinumCount} Platinum`
          : "Silver, Gold, Platinum",
      Icon: Crown,
    },
    {
      label: "Repeat Buyers",
      value: repeatBuyersCount.toLocaleString(),
      detail: "2+ verified orders",
      Icon: ShoppingBag,
    },
    {
      label: "Verified Lifetime Value",
      value: formatMMK(totalValue),
      detail: "Settled revenue",
      Icon: ShoppingBag,
    },
  ] as const;

  return (
    <>
      <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, detail, Icon }) => (
          <article className="card p-4" key={label}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#77776f]">
                {label}
              </p>
              <Icon size={15} className="text-[#6e7168]" />
            </div>
            <p className="display mt-4 text-2xl font-bold truncate">{value}</p>
            <p className="mt-1 text-xs text-[#77776f] truncate">{detail}</p>
          </article>
        ))}
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold">Customer Profiles</p>
            <p className="mt-1 text-xs text-[#77776f]">
              {visible.length} of {customers.length} profiles
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setBroadcastOpen(true)}
              className="flex h-11 items-center gap-2 rounded-xl bg-[#0088cc] px-4 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#0077b5]"
            >
              <Megaphone size={15} />
              <span>Broadcast to Telegram</span>
            </button>
            <label className="relative block w-full sm:w-auto sm:min-w-[240px]">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#77776f]"
              />
              <span className="sr-only">Search customers</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, ID (MH-CUST), phone, @tag..."
                className="h-11 w-full rounded-xl border bg-white pl-9 pr-3 text-sm outline-none focus:border-black"
              />
            </label>
          </div>
        </div>

        {/* Tier Filter Tabs */}
        <div className="flex flex-wrap gap-2 border-b bg-[#faf9f5] px-4 py-2.5 text-xs">
          {TIER_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setTierFilter(f.id)}
              className={`rounded-lg px-3 py-1.5 font-bold transition-all ${
                tierFilter === f.id
                  ? "bg-black text-white shadow-xs"
                  : "bg-white text-[#666a60] border border-[#e5e2d8] hover:border-black hover:text-black"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Mobile View */}
        <div className="divide-y md:hidden">
          {visible.map((customer) => {
            const tierDef = TIERS[customer.tier] || TIERS.member;
            return (
              <article className="p-4" key={customer.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-bold">{customer.name}</p>
                      <span
                        className={`pill shrink-0 inline-flex items-center gap-1.5 py-0.5 px-2 text-[10px] font-bold ${
                          customer.tier === "platinum"
                            ? "border border-purple-200 bg-purple-50 text-purple-700"
                            : customer.tier === "gold"
                              ? "border border-amber-200 bg-amber-50 text-amber-800"
                              : customer.tier === "silver"
                                ? "border border-blue-200 bg-blue-50 text-blue-800"
                                : "border border-[#e5e2d8] bg-[#f7f6f1] text-[#666a60]"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            customer.tier === "platinum"
                              ? "bg-purple-600"
                              : customer.tier === "gold"
                                ? "bg-amber-500"
                                : customer.tier === "silver"
                                  ? "bg-blue-500"
                                  : "bg-[#9a9d94]"
                          }`}
                        />
                        <span>{tierDef.name}</span>
                        <span className="opacity-70 font-mono text-[10px]">
                          ({customer.points.toLocaleString()} pts)
                        </span>
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      {customer.customerCode && (
                        <span className="font-mono text-[10px] font-semibold text-[#1a1a1a] bg-[#ebe7dc] px-1.5 py-0.5 rounded">
                          {customer.customerCode}
                        </span>
                      )}
                      <span className="text-[#666a60]">{customer.phone}</span>
                      {customer.secondaryPhone && (
                        <span className="text-[11px] text-[#888b80]">
                          (Alt: {customer.secondaryPhone})
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`pill shrink-0 py-1 ${customer.telegramUserId ? "bg-[#effbdd] text-[#416b17]" : ""}`}
                  >
                    {customer.source}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-[#f5f3ed] p-3">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-[#77776f]">
                      Orders
                    </p>
                    <p className="mt-1 font-bold">{customer.orders}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-[#77776f]">
                      Lifetime value
                    </p>
                    <p className="mt-1 font-bold">
                      {formatMMK(customer.lifetime)}
                    </p>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                  <dt className="text-[#77776f]">VIP Card</dt>
                  <dd className="text-right">
                    <a
                      href={`/api/member-card?code=${encodeURIComponent(customer.customerCode || "")}&userId=${encodeURIComponent(customer.telegramUserId || "")}&phone=${encodeURIComponent(customer.phone || "")}&name=${encodeURIComponent(customer.name)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-[#8c6b12] hover:underline"
                    >
                      <CreditCard size={12} />
                      <span>View Card</span>
                      <ExternalLink size={10} className="opacity-70" />
                    </a>
                  </dd>
                  <dt className="text-[#77776f]">Perks</dt>
                  <dd className="text-right font-medium text-[#2e7d32]">
                    {tierDef.freeDelivery ? "Free Delivery" : "Standard"}
                    {customer.tier === "gold"
                      ? " + 5% off"
                      : customer.tier === "platinum"
                        ? " + 10% off"
                        : ""}
                  </dd>
                  <dt className="text-[#77776f]">Telegram</dt>
                  <dd className="break-all text-right font-mono text-[10px]">
                    {customer.telegramUsername ? (
                      <div className="flex flex-col items-end">
                        <a
                          href={`https://t.me/${customer.telegramUsername.replace(/^@/, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-[#0088cc] hover:underline"
                        >
                          @{customer.telegramUsername.replace(/^@/, "")}
                        </a>
                        {customer.telegramUserId && (
                          <span className="text-[9px] text-[#888b80]">
                            ID: {customer.telegramUserId}
                          </span>
                        )}
                      </div>
                    ) : customer.telegramUserId ? (
                      `ID: ${customer.telegramUserId}`
                    ) : (
                      "Not linked"
                    )}
                  </dd>
                  <dt className="text-[#77776f]">Address</dt>
                  <dd className="text-right">
                    {customer.primaryAddress || "Not recorded"}
                  </dd>
                  <dt className="text-[#77776f]">Last order</dt>
                  <dd className="text-right">{customer.last}</dd>
                </dl>
              </article>
            );
          })}
        </div>

        {/* Desktop View */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b bg-[#f7f5ef] text-[9px] uppercase tracking-[0.14em] text-[#77776f]">
              <tr>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Tier & Loyalty</th>
                <th className="px-5 py-3">Telegram</th>
                <th className="px-5 py-3">Address</th>
                <th className="px-5 py-3 text-center">Orders</th>
                <th className="px-5 py-3 text-right">Lifetime value</th>
                <th className="px-5 py-3">Last order</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((customer) => {
                const tierDef = TIERS[customer.tier] || TIERS.member;
                return (
                  <tr className="border-b last:border-0 hover:bg-[#faf9f6]/80 transition-colors" key={customer.id}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <p className="font-bold">{customer.name}</p>
                        {customer.customerCode && (
                          <span className="font-mono text-[10px] font-semibold text-[#1a1a1a] bg-[#ebe7dc] px-1.5 py-0.5 rounded">
                            {customer.customerCode}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[#77776f]">
                        <span>{customer.phone}</span>
                        {customer.secondaryPhone && (
                          <span className="text-[11px] text-[#888b80]">
                            (Alt: {customer.secondaryPhone})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`pill inline-flex items-center gap-1.5 py-1 text-xs font-bold ${
                            customer.tier === "platinum"
                              ? "border border-purple-200 bg-purple-50 text-purple-700"
                              : customer.tier === "gold"
                                ? "border border-amber-200 bg-amber-50 text-amber-800"
                                : customer.tier === "silver"
                                  ? "border border-blue-200 bg-blue-50 text-blue-800"
                                  : "border border-[#e5e2d8] bg-[#f7f6f1] text-[#666a60]"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              customer.tier === "platinum"
                                ? "bg-purple-600"
                                : customer.tier === "gold"
                                  ? "bg-amber-500"
                                  : customer.tier === "silver"
                                    ? "bg-blue-500"
                                    : "bg-[#9a9d94]"
                            }`}
                          />
                          <span>{tierDef.name}</span>
                          <span className="opacity-70 font-mono text-[11px]">
                            ({customer.points.toLocaleString()} pts)
                          </span>
                        </span>
                        <a
                          href={`/api/member-card?code=${encodeURIComponent(customer.customerCode || "")}&userId=${encodeURIComponent(customer.telegramUserId || "")}&phone=${encodeURIComponent(customer.phone || "")}&name=${encodeURIComponent(customer.name)}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Preview VIP Membership Card"
                          className="inline-flex items-center gap-1 rounded-lg border border-[#e5e2d8] bg-white px-2 py-1 text-[11px] font-semibold text-[#1a1a1a] shadow-xs hover:border-black hover:bg-[#faf9f5] transition-colors"
                        >
                          <CreditCard size={12} className="text-[#966b0a]" />
                          <span>Card</span>
                        </a>
                      </div>
                      <p className="mt-1 text-[10px] text-[#77776f]">
                        {tierDef.freeDelivery ? "Free Delivery" : "Standard rates"}
                        {customer.tier === "gold"
                          ? " + 5% off"
                          : customer.tier === "platinum"
                            ? " + 10% off"
                            : ""}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      {customer.telegramUsername ? (
                        <div>
                          <a
                            href={`https://t.me/${customer.telegramUsername.replace(/^@/, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-bold text-xs text-[#0088cc] hover:underline"
                          >
                            <span>@{customer.telegramUsername.replace(/^@/, "")}</span>
                            <ExternalLink size={11} className="opacity-70" />
                          </a>
                          {customer.telegramUserId && (
                            <p className="mt-1 font-mono text-[10px] text-[#888b80]">
                              ID: {customer.telegramUserId}
                            </p>
                          )}
                        </div>
                      ) : customer.telegramUserId ? (
                        <div>
                          <span className="pill bg-[#effbdd] py-1 text-[#416b17]">
                            Linked
                          </span>
                          <p className="mt-1.5 font-mono text-[10px] text-[#666a60]">
                            {customer.telegramUserId}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-[#999b93]">Not linked</span>
                      )}
                    </td>
                    <td className="max-w-[220px] px-5 py-4 text-xs text-[#666a60]">
                      {customer.primaryAddress || "Not recorded"}
                    </td>
                    <td className="px-5 py-4 text-center font-bold">
                      {customer.orders}
                    </td>
                    <td className="px-5 py-4 text-right font-bold">
                      {formatMMK(customer.lifetime)}
                    </td>
                    <td className="px-5 py-4 text-xs text-[#666a60]">
                      {customer.last}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!visible.length && (
          <div className="p-10 text-center">
            <p className="font-bold">No matching customers</p>
            <p className="mt-1 text-xs text-[#77776f]">
              Try a different name, phone number, Telegram ID, or tier filter.
            </p>
          </div>
        )}
      </section>

      <TelegramBroadcastModal
        isOpen={broadcastOpen}
        onClose={() => setBroadcastOpen(false)}
      />
    </>
  );
}
