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
      />
      <section className="mb-4 grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        {metrics.map(([label, value, Icon]) => (
          <article className="card p-3 sm:p-4" key={label}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#77776f] truncate">
                {label}
              </p>
              <Icon size={14} className="text-[#6e7168] shrink-0" />
            </div>
            <p className="display mt-2 sm:mt-4 text-lg sm:text-2xl font-bold truncate">{value}</p>
          </article>
        ))}
      </section>
      <BotTemplatesConsole
        initialTemplates={templates}
        initialQaItems={qaItems}
      />
    </>
  );
}
