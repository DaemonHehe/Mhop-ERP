"use client";
import { useState, useTransition } from "react";
import { BellRing, Check, CheckCheck } from "lucide-react";
import {
  markAlertReadAction,
  markAllAlertsReadAction,
  type StaffAlert,
} from "@/app/actions/admin";
export function AlertCenter({ alerts }: { alerts: StaffAlert[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const act = (promise: Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const result = await promise;
      if (!result.ok) setError(result.error || "Alert update failed");
      else setError("");
    });
  return (
    <>
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-[#fff0eb] p-3 text-xs font-bold text-[#9c3212]"
        >
          {error}
        </p>
      )}
      <div className="mb-4 flex justify-end">
        <button
          disabled={pending || !alerts.some((alert) => !alert.isRead)}
          onClick={() => act(markAllAlertsReadAction())}
          className="pill px-4 py-3 disabled:opacity-40"
        >
          <CheckCheck size={14} />
          Mark all read
        </button>
      </div>
      <div className="space-y-3">
        {alerts.map((alert) => (
          <article
            key={alert.id}
            className={`card flex gap-4 p-5 ${alert.isRead ? "opacity-60" : "border-[#c7f36b]"}`}
          >
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${alert.isRead ? "bg-[#efede6]" : "bg-[#c7f36b]"}`}
            >
              <BellRing size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold">{alert.title}</h2>
                <time className="text-[10px] text-[#77776f]">
                  {new Date(alert.createdAt).toLocaleString("en-US", {
                    timeZone: "Asia/Yangon",
                  })}
                </time>
              </div>
              <p className="mt-1 text-sm text-[#77776f]">{alert.body}</p>
              {alert.targetCode && (
                <p className="mt-2 font-mono text-[10px] font-bold">
                  {alert.targetCode}
                </p>
              )}
            </div>
            {!alert.isRead && (
              <button
                aria-label={`Mark ${alert.title} read`}
                disabled={pending || alert.id.startsWith("demo-")}
                onClick={() => act(markAlertReadAction(alert.id))}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border disabled:opacity-40"
              >
                <Check size={15} />
              </button>
            )}
          </article>
        ))}
        {!alerts.length && (
          <div className="card p-10 text-center text-sm text-[#77776f]">
            No alerts. Operations are clear.
          </div>
        )}
      </div>
    </>
  );
}
