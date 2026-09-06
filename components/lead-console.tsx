"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { sendLeadReminderAction } from "@/app/actions/store";
import type { RecoveryLead } from "@/lib/services/lead-recovery.service";

export function LeadConsole({ leads }: { leads: RecoveryLead[] }) {
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState("");
  const [sent, setSent] = useState<string[]>([]);
  return <>
    <p className="mb-4 text-sm text-[#777]">Reminders are sent individually from your Telegram customer sales bot. Customers must have started the bot.</p>
    {notice && <p role="status" className="card mb-4 p-4 text-sm">{notice}</p>}
    <div className="space-y-3">
      {leads.map((lead) => <article key={lead.id} className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="font-bold">{lead.customerName}</p>
          <p className="mt-1 text-xs text-[#777]">{lead.phone || lead.telegramUserId || "No contact linked"}</p>
          <p className="mt-3 text-sm">{lead.detail}</p>
          <p className="mt-2 text-xs text-[#777]">{new Date(lead.activityAt).toLocaleString("en-US", { timeZone: "Asia/Yangon" })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">{lead.stage === "unpaid" ? "Awaiting payment" : "Browsing catalog"}</span>
          <button type="button" disabled={pending || !lead.telegramUserId || sent.includes(lead.id)}
            title={!lead.telegramUserId ? "No Telegram chat linked to this customer" : "Send a purchase follow-up through the customer sales bot"}
            onClick={() => startTransition(async () => {
              setNotice("");
              try {
                const result = await sendLeadReminderAction(lead.id);
                setNotice(result.ok ? `Reminder sent to ${lead.customerName}.` : result.error || "Unable to send reminder.");
                if (result.ok) setSent((current) => [...current, lead.id]);
              } catch { setNotice("Delivery could not be confirmed. Check the Telegram chat before retrying."); }
            })}
            className="min-h-11 rounded-xl bg-[#c7f36b] px-4 text-xs font-bold disabled:opacity-40">
            <Send size={14} className="mr-2 inline" />{sent.includes(lead.id) ? "Reminder sent" : "Send Telegram reminder"}
          </button>
          {!lead.telegramUserId && <span className="text-xs text-[#777]">No Telegram chat linked</span>}
        </div>
      </article>)}
    </div>
    {!leads.length && <div className="card p-10 text-center"><p className="font-bold">No unfinished purchases or catalog inquiries</p><p className="mt-2 text-sm text-[#777]">Identified customer activity appears here automatically. Anonymous catalog visitors cannot be contacted.</p></div>}
  </>;
}
