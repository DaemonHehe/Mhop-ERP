import { BellRing, Bot, Clock, Sparkles } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { BotTemplatesConsole } from "@/components/bot-templates-console";
import { getBotTemplatesAction } from "@/app/actions/bot-settings";
import { getAiSalesQaAction } from "@/app/actions/ai-qa";
import { clientConfig } from "@/lib/client-config";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bot & Automation Messages | MH OP Admin",
  description:
    "Customize automated customer greetings, cart recovery, payment slip confirmations, AI sales agent Q&A knowledge, and manager operational alerts.",
};

export default async function BotPage() {
  const [templates, qaItems] = await Promise.all([
    getBotTemplatesAction(),
    getAiSalesQaAction(),
  ]);

  const metrics = [
    ["AI Knowledge Feed", `${qaItems.length} Q&A trained`, Sparkles],
    ["Automated Triggers", `${templates.length} active`, Bot],
    [
      "Cart Recovery Window",
      `${clientConfig.automation.cartReminderMinutes} mins`,
      Clock,
    ],
    ["Manager Staff Alerts", "3 triggers active", BellRing],
  ] as const;

  return (
    <>
      <PageHeading
        eyebrow="Store automation"
        title="Bot & Automation Messages"
        description="Feed Q&A data to train the 24/7 AI Sales Agent, and configure automated greetings, cart recovery, and manager operational briefings."
        compactOnMobile
      />
      <section className="mb-4 hidden grid-cols-2 gap-3 sm:grid xl:grid-cols-4">
        {metrics.map(([label, value, Icon]) => (
          <article className="card min-w-[158px] snap-start p-3 sm:min-w-0 sm:p-4" key={label}>
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs font-bold text-[#77776f] sm:text-[10px] sm:uppercase sm:tracking-[0.12em]">
                {label}
              </p>
              <Icon size={14} className="text-[#6e7168] shrink-0" />
            </div>
            <p className="display mt-2 truncate text-lg font-bold sm:mt-4 sm:text-2xl">{value}</p>
          </article>
        ))}
      </section>
      <section className="mb-3 flex items-center justify-between gap-2 rounded-2xl border border-[#dedbd0] bg-white/75 px-3 py-2.5 shadow-sm sm:hidden">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#416c17]">
          <Sparkles size={13} /> {qaItems.length} Q&amp;A
        </span>
        <span className="h-4 w-px bg-[#dedbd0]" />
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#55534c]">
          <Bot size={13} /> {templates.length} triggers
        </span>
        <span className="h-4 w-px bg-[#dedbd0]" />
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#55534c]">
          <Clock size={13} /> {clientConfig.automation.cartReminderMinutes}m recovery
        </span>
      </section>
      <BotTemplatesConsole
        initialTemplates={templates}
        initialQaItems={qaItems}
      />
    </>
  );
}
