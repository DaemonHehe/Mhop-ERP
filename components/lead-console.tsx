"use client";

import { useState, useTransition } from "react";
import { updateLeadStageAction } from "@/app/actions/store";

type Lead = {
  id: string;
  customerName: string;
  phone: string | null;
  telegramUserId: string | null;
  cartItemsJson: unknown;
  stage: string;
  reserveExpiresAt: Date | null;
};
const stages = ["new", "contacted", "reserved", "converted", "lost"] as const;

export function LeadConsole({ leads }: { leads: Lead[] }) {
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const update = (id: string, stage: (typeof stages)[number]) =>
    startTransition(async () => {
      const result = await updateLeadStageAction(id, stage);
      setNotice(
        result.ok
          ? { ok: true, text: "Lead stage updated." }
          : { ok: false, text: result.error },
      );
    });
  return (
    <div className="card overflow-hidden">
      {notice && (
        <p
          role="status"
          className={`m-4 rounded-xl border p-3 text-xs font-bold ${notice.ok ? "bg-[#effbdd] text-[#416b17]" : "bg-[#fff0eb] text-[#9c3212]"}`}
        >
          {notice.text}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-y bg-[#f7f5ef] text-[10px] uppercase tracking-wider text-[#77776f]">
            <tr>
              {[
                "Customer",
                "Source",
                "Interested in",
                "Stage",
                "Reservation",
                "Contact",
              ].map((header) => (
                <th key={header} className="px-5 py-3">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const cart = Array.isArray(lead.cartItemsJson)
                ? (lead.cartItemsJson as { name?: string }[])
                : [];
              return (
                <tr key={lead.id} className="border-b last:border-0">
                  <td className="px-5 py-4 font-bold">{lead.customerName}</td>
                  <td className="px-5 py-4">
                    {lead.telegramUserId ? "Telegram" : "Web"}
                  </td>
                  <td className="max-w-xs px-5 py-4 text-[#77776f]">
                    {cart
                      .map((item) => item.name)
                      .filter(Boolean)
                      .join(", ") || "Saved cart"}
                  </td>
                  <td className="px-5 py-4">
                    <select
                      aria-label={`Stage for ${lead.customerName}`}
                      disabled={pending || lead.id.startsWith("demo-")}
                      value={lead.stage}
                      onChange={(event) =>
                        update(
                          lead.id,
                          event.target.value as (typeof stages)[number],
                        )
                      }
                      className="rounded-xl border bg-white px-3 py-2 text-xs font-bold capitalize disabled:opacity-50"
                    >
                      {stages.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-4 text-xs">
                    {lead.reserveExpiresAt
                      ? new Date(lead.reserveExpiresAt).toLocaleString(
                          "en-US",
                          { timeZone: "Asia/Yangon" },
                        )
                      : "—"}
                  </td>
                  <td className="px-5 py-4 text-xs">
                    {lead.phone || lead.telegramUserId || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!leads.length && (
        <p className="p-8 text-center text-sm text-[#77776f]">
          No leads are waiting for follow-up.
        </p>
      )}
    </div>
  );
}
