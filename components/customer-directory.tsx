"use client";

import { useMemo, useState } from "react";
import { Megaphone, MessageCircle, Search, ShoppingBag, Users } from "lucide-react";
import type { CustomerSummary } from "@/app/actions/store";
import { formatMMK } from "@/lib/data";
import { TelegramBroadcastModal } from "./telegram-broadcast-modal";

const normalize = (value: string | null | undefined) =>
  (value || "").trim().toLocaleLowerCase();

export function CustomerDirectory({
  customers,
}: {
  customers: CustomerSummary[];
}) {
  const [query, setQuery] = useState("");
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const normalized = normalize(query);
  const visible = useMemo(
    () =>
      !normalized
        ? customers
        : customers.filter((customer) =>
            [
              customer.name,
              customer.phone,
              customer.telegramUserId,
              customer.primaryAddress,
            ].some((value) => normalize(value).includes(normalized)),
          ),
    [customers, normalized],
  );
  const totalValue = customers.reduce(
    (sum, customer) => sum + customer.lifetime,
    0,
  );
  const metrics = [
    ["Customers", String(customers.length), Users],
    [
      "Telegram linked",
      String(customers.filter((customer) => customer.telegramUserId).length),
      MessageCircle,
    ],
    [
      "Repeat buyers",
      String(customers.filter((customer) => customer.orders > 1).length),
      ShoppingBag,
    ],
    ["Verified lifetime value", formatMMK(totalValue), ShoppingBag],
  ] as const;

  return (
    <>
      <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value, Icon]) => (
          <article className="card p-4" key={label}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#77776f]">
                {label}
              </p>
              <Icon size={15} className="text-[#6e7168]" />
            </div>
            <p className="display mt-4 text-2xl font-bold">{value}</p>
          </article>
        ))}
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold">All customers</p>
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
                placeholder="Name, phone, Telegram or address"
                className="h-11 w-full rounded-xl border bg-white pl-9 pr-3 text-sm outline-none focus:border-black"
              />
            </label>
          </div>
        </div>

        <div className="divide-y md:hidden">
          {visible.map((customer) => (
            <article className="p-4" key={customer.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold">{customer.name}</p>
                  <p className="mt-1 text-xs text-[#666a60]">
                    {customer.phone}
                  </p>
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
                <dt className="text-[#77776f]">Telegram</dt>
                <dd className="break-all text-right font-mono text-[10px]">
                  {customer.telegramUserId || "Not linked"}
                </dd>
                <dt className="text-[#77776f]">Address</dt>
                <dd className="text-right">
                  {customer.primaryAddress || "Not recorded"}
                </dd>
                <dt className="text-[#77776f]">Last order</dt>
                <dd className="text-right">{customer.last}</dd>
              </dl>
            </article>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b bg-[#f7f5ef] text-[9px] uppercase tracking-[0.14em] text-[#77776f]">
              <tr>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Telegram</th>
                <th className="px-5 py-3">Address</th>
                <th className="px-5 py-3 text-center">Orders</th>
                <th className="px-5 py-3 text-right">Lifetime value</th>
                <th className="px-5 py-3">Last order</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((customer) => (
                <tr className="border-b last:border-0" key={customer.id}>
                  <td className="px-5 py-4">
                    <p className="font-bold">{customer.name}</p>
                    <p className="mt-1 text-xs text-[#77776f]">
                      {customer.phone}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    {customer.telegramUserId ? (
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
              ))}
            </tbody>
          </table>
        </div>

        {!visible.length && (
          <div className="p-10 text-center">
            <p className="font-bold">No matching customers</p>
            <p className="mt-1 text-xs text-[#77776f]">
              Try a different name, phone number, Telegram ID, or address.
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
