import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { RevenueChartLazy } from "@/components/revenue-chart-lazy";
import { MonthlyReportButton } from "@/components/monthly-report-button";
import { formatMMK } from "@/lib/data";
import {
  getDashboardSnapshot,
  getInventoryAction,
  getOrdersAction,
  getRevenueSeriesAction,
} from "@/app/actions/store";
import { getErpDataAction } from "@/app/actions/erp";
import {
  ArrowUpRight,
  Banknote,
  CircleDollarSign,
  PackageCheck,
  ShoppingCart,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

const compact = (value: number) =>
  value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(2)}M`
    : new Intl.NumberFormat("en-US").format(value);
export const dynamic = "force-dynamic";
export default async function Dashboard() {
  const [stats, products, orders, erp, revenueSeries] = await Promise.all([
    getDashboardSnapshot(),
    getInventoryAction(),
    getOrdersAction(),
    getErpDataAction(),
    getRevenueSeriesAction(),
  ]);
  const periodRevenue = revenueSeries.reduce(
    (sum, point) => sum + point.value,
    0,
  );
  const metrics = [
    [
      "Revenue",
      compact(stats.revenue),
      stats.mode === "demo" ? "Preview dataset" : "Verified payments",
      Banknote,
    ],
    [
      "Net profit",
      compact(erp.snapshot.netProfit),
      `${formatMMK(erp.snapshot.expenses)} expenses`,
      CircleDollarSign,
    ],
    [
      "Orders",
      String(stats.orders),
      `${orders.filter((o) => !["Delivered", "Cancelled"].includes(o.fulfillment)).length} to fulfill`,
      ShoppingCart,
    ],
    [
      "Units in stock",
      String(stats.stock),
      `${stats.lowStock} low stock`,
      PackageCheck,
    ],
  ] as const;
  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Yangon",
  }).format(new Date());
  return (
    <AppShell>
      <PageHeading
        eyebrow={today}
        title="မင်္ဂလာပါ၊ MH OP Admin ခင်ဗျာ။"
        description={`Here’s what is happening across gadgets, PUBG accounts, and sales channels today. ${stats.mode === "demo" ? "Running in preview mode." : "Connected to PostgreSQL."}`}
        action={<MonthlyReportButton />}
      />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value, note, Icon], i) => (
          <div className="card p-5" key={label}>
            <div className="flex items-start justify-between">
              <p className="text-xs font-semibold text-[#76776f]">{label}</p>
              <span
                className={`grid h-8 w-8 place-items-center rounded-full ${i === 0 ? "bg-[#c7f36b]" : i === 1 ? "bg-[#ffe0d3]" : "bg-[#efede6]"}`}
              >
                <Icon size={15} />
              </span>
            </div>
            <p className="metric mt-7">{value}</p>
            <p
              className={`mt-2 text-xs font-semibold ${i < 2 ? "text-[#45830d]" : "text-[#77776f]"}`}
            >
              {note}
            </p>
          </div>
        ))}
      </section>
      <section className="mt-4 grid gap-4 xl:grid-cols-[1.55fr_.9fr]">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-5">
            <div>
              <p className="eyebrow">Performance</p>
              <h2 className="display mt-1 text-xl font-semibold">
                14-day revenue
              </h2>
            </div>
            <span className="pill">
              <i className="h-2 w-2 rounded-full bg-[#ff6b35]" />
              {formatMMK(periodRevenue)}
            </span>
          </div>
          <RevenueChartLazy data={revenueSeries} />
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">Attention</p>
              <h2 className="display mt-1 text-xl font-semibold">
                Stock pulse
              </h2>
            </div>
            <AlertTriangle size={18} className="text-[#d05027]" />
          </div>
          <div className="mt-5 space-y-4">
            {products
              .filter((p) => p.stock <= 5)
              .map((p) => (
                <div key={p.id} className="flex items-center gap-3">
                  <div className="h-11 w-11 overflow-hidden rounded-xl bg-[#efede6]">
                    <img
                      src={p.image}
                      alt={p.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{p.name}</p>
                    <p className="text-xs text-[#77776f]">{p.sku}</p>
                  </div>
                  <span
                    className={`pill ${p.stock <= 2 ? "border-[#ffc7b4] bg-[#fff2ed] text-[#b5421c]" : ""}`}
                  >
                    {p.stock} left
                  </span>
                </div>
              ))}
          </div>
          <Link
            href="/inventory"
            className="mt-5 flex items-center justify-between border-t pt-4 text-xs font-bold"
          >
            Review products & stock <ChevronRight size={15} />
          </Link>
        </div>
      </section>
      <section className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between p-5">
          <div>
            <p className="eyebrow">Live operations</p>
            <h2 className="display mt-1 text-xl font-semibold">
              Latest orders
            </h2>
          </div>
          <Link href="/orders" className="pill">
            All orders <ArrowUpRight size={13} />
          </Link>
        </div>
        <div className="divide-y border-t md:hidden">
          {orders.map((order) => (
            <Link
              href="/orders"
              key={order.id}
              className="block p-4 active:bg-white/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] font-bold">{order.id}</p>
                  <p className="mt-1 truncate text-sm font-bold">
                    {order.customer}
                  </p>
                  <p className="mt-1 truncate text-xs text-[#77776f]">
                    {order.item}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold">
                  {formatMMK(order.amount)}
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-[#77776f]">
                  {order.channel}
                </span>
                <span
                  className={`pill py-1 ${order.payment === "Verified" ? "bg-[#effcdd]" : "bg-[#fff6d8]"}`}
                >
                  {order.payment}
                </span>
              </div>
            </Link>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-y bg-[#f7f5ef] text-[10px] uppercase tracking-wider text-[#77776f]">
              <tr>
                {[
                  "Order",
                  "Customer",
                  "Channel",
                  "Item",
                  "Payment",
                  "Amount",
                ].map((h) => (
                  <th key={h} className="px-5 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b last:border-0">
                  <td className="px-5 py-4 font-mono text-xs font-bold">
                    {o.id}
                  </td>
                  <td className="px-5 py-4 font-semibold">{o.customer}</td>
                  <td className="px-5 py-4 text-[#77776f]">{o.channel}</td>
                  <td className="px-5 py-4">{o.item}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`pill py-1 ${o.payment === "Verified" ? "bg-[#effcdd]" : "bg-[#fff6d8]"}`}
                    >
                      {o.payment}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-bold">{formatMMK(o.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
