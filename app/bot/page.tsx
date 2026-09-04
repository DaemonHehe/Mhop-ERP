import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { Bot, MessageSquareText, ShieldCheck, Zap } from "lucide-react";
import { clientConfig } from "@/lib/client-config";

const flows = [
  {
    name: clientConfig.telegram.displayName,
    detail: "Customer sales assistant",
    icon: MessageSquareText,
    color: "bg-[#c7f36b]",
  },
  {
    name: clientConfig.telegram.operationsGroup,
    detail: "Staff operations alerts",
    icon: ShieldCheck,
    color: "bg-[#ffcab7]",
  },
];
export default function BotStudio() {
  return (
    <AppShell>
      <PageHeading
        eyebrow="Telegram automation"
        title="Bot studio"
        description={`${clientConfig.telegram.handle} serves customers and routes staff alerts to ${clientConfig.telegram.operationsGroup}.`}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {flows.map((f) => (
          <article className="card p-6" key={f.name}>
            <div
              className={`grid h-12 w-12 place-items-center rounded-2xl ${f.color}`}
            >
              <f.icon size={21} />
            </div>
            <div className="mt-5 flex items-start justify-between">
              <div>
                <h2 className="display text-2xl font-bold">{f.name}</h2>
                <p className="mt-1 text-sm text-[#77776f]">
                  {clientConfig.telegram.handle} · {f.detail}
                </p>
              </div>
              <span className="pill bg-[#fff8dc] text-[#8a6a00]">
                <i className="h-2 w-2 rounded-full bg-[#d5a400]" />
                Requires credentials
              </span>
            </div>
          </article>
        ))}
      </div>
      <div className="card mt-4 p-6">
        <p className="eyebrow">Capability map</p>
        <h2 className="display mt-1 text-2xl font-bold">
          Configured automations
        </h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {[
            [
              "Customer messaging",
              "AI-guided recommendations, catalog, shop, support, and captioned payment slips",
              Bot,
            ],
            [
              "Event routing",
              "Orders, payment slips, product stock, tickets, and 9 AM briefing",
              Zap,
            ],
          ].map(([t, d, I]) => (
            <div key={t as string} className="rounded-2xl border p-5">
              <I size={20} />
              <p className="mt-6 font-bold">{t as string}</p>
              <p className="mt-2 text-xs leading-5 text-[#77776f]">
                {d as string}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-[#77776f]">
          The sales agent uses live customer-safe catalog data, remembers the latest conversation context, and hands payment, refund, warranty, or uncertain cases to staff. It never exposes exact stock, costs, or account credentials.
        </p>
        <p className="mt-3 text-xs text-[#77776f]">
          Cart reminder: {clientConfig.automation.cartReminderMinutes} minutes ·
          Follow-up: {clientConfig.automation.followUpDays} days · Offer:{" "}
          {clientConfig.automation.discountPercent}% OFF
        </p>
      </div>
    </AppShell>
  );
}
