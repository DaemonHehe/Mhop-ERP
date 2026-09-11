"use client";

import { useMemo, useState } from "react";
import { getAuditLogsAction } from "@/app/actions/store";
import { Terminal, ChevronRight } from "lucide-react";

type AuditLog = {
  id: string;
  category: string;
  event: string;
  actor: string;
  targetCode: string | null;
  details: string;
  createdAt: Date;
  weekStart: string;
};

const categories = {
  orders: {
    label: "Orders & Payments",
    style: "text-amber-300",
  },
  inventory: {
    label: "Products & Stock",
    style: "text-sky-300",
  },
  finance: {
    label: "ERP & Finance",
    style: "text-violet-300",
  },
  warranty: {
    label: "Warranty & RMA",
    style: "text-rose-300",
  },
  crm: {
    label: "Customers & CRM",
    style: "text-emerald-300",
  },
  access: {
    label: "Staff & Security",
    style: "text-orange-300",
  },
  automation: {
    label: "Automation",
    style: "text-cyan-300",
  },
  system: {
    label: "System",
    style: "text-slate-300",
  },
} as const;

const categoryInfo = (value: string) =>
  categories[value as keyof typeof categories] || categories.system;
const weekLabel = (weekStart: string) => {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const format = (date: Date) =>
    date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  return `${format(start)} – ${format(end)}`;
};

export function AuditLogConsole({ logs: initialLogs }: { logs: AuditLog[] }) {
  const [older, setOlder] = useState<AuditLog[]>([]);
  const logs = useMemo(
    () =>
      Array.from(
        new Map(
          [...initialLogs, ...older].map((log) => [log.id, log]),
        ).values(),
      ),
    [initialLogs, older],
  );
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialLogs.length === 200);
  const [error, setError] = useState("");
  const loadOlder = async () => {
    const last = logs[logs.length - 1];
    if (!last) return;
    setLoading(true);
    setError("");
    try {
      const next = await getAuditLogsAction({
        createdAt: new Date(last.createdAt).toISOString(),
        id: last.id,
      });
      setOlder((previous) => [...previous, ...next]);
      setHasMore(next.length === 200);
    } catch {
      setError("Could not load older activity. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [week, setWeek] = useState("all");
  const availableWeeks = useMemo(
    () => Array.from(new Set(logs.map((log) => log.weekStart))),
    [logs],
  );
  const availableCategories = useMemo(
    () => Array.from(new Set(logs.map((log) => log.category))),
    [logs],
  );
  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    return logs.filter((log) => {
      if (category !== "all" && log.category !== category) return false;
      if (week !== "all" && log.weekStart !== week) return false;
      if (!search) return true;
      return [log.event, log.actor, log.targetCode, log.details, log.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });
  }, [category, logs, query, week]);
  const grouped = useMemo(() => {
    const result = new Map<string, AuditLog[]>();
    for (const log of visible) {
      const entries = result.get(log.weekStart) || [];
      entries.push(log);
      result.set(log.weekStart, entries);
    }
    return Array.from(result.entries());
  }, [visible]);

  return (
    <section
      aria-label="Activity terminal"
      className="overflow-hidden rounded-xl border border-[#30363d] bg-[#0d1117] font-mono text-[11px] leading-5 text-[#c9d1d9] shadow-lg [color-scheme:dark]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#30363d] bg-[#161b22] px-3 py-2">
        <span className="flex items-center gap-2 text-[#f0f6fc]">
          <Terminal size={14} /> activity.log
        </span>
        <span className="text-[#8b949e]">
          {visible.length}/{logs.length} records · Bangkok UTC+7
        </span>
      </div>
      <div className="grid gap-2 border-b border-[#30363d] p-2 sm:grid-cols-[minmax(0,1fr)_180px_230px]">
        <label className="flex min-w-0 items-center gap-2 rounded border border-[#30363d] px-2 focus-within:border-[#7ee787]">
          <span aria-hidden="true" className="text-[#7ee787]">
            $
          </span>
          <span className="sr-only">Search activity</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="filter events, actor, target…"
            className="h-11 min-w-0 w-full !bg-transparent text-xs text-[#7ee787] caret-[#7ee787] shadow-none outline-none placeholder:text-[#a5b4c4] sm:h-8"
          />
        </label>
        <label>
          <span className="sr-only">Filter category</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-11 w-full rounded border !border-[#484f58] !bg-[#262d36] px-2 text-xs text-[#7ee787] shadow-none outline-none hover:!bg-[#303944] focus:!border-[#7ee787] sm:h-8"
          >
            <option value="all">All categories</option>
            {availableCategories.map((value) => (
              <option key={value} value={value}>
                {categoryInfo(value).label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter week</span>
          <select
            value={week}
            onChange={(event) => setWeek(event.target.value)}
            className="h-11 w-full rounded border !border-[#484f58] !bg-[#262d36] px-2 text-xs text-[#7ee787] shadow-none outline-none hover:!bg-[#303944] focus:!border-[#7ee787] sm:h-8"
          >
            <option value="all">All weeks</option>
            {availableWeeks.map((value) => (
              <option key={value} value={value}>
                {weekLabel(value)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="max-h-[70vh] overflow-y-auto overscroll-contain">
        {grouped.map(([weekStart, entries], weekIndex) => (
          <details key={weekStart} open={weekIndex < 2} className="group/week">
            <summary className="sticky top-0 z-10 flex cursor-pointer list-none items-center gap-2 border-y border-[#30363d] bg-[#161b22] px-3 py-2 text-[#8b949e] outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[#7ee787] [&::-webkit-details-marker]:hidden">
              <ChevronRight
                size={12}
                className="shrink-0 transition-transform group-open/week:rotate-90"
              />
              <span className="flex-1"># {weekLabel(weekStart)}</span>
              <span>{entries.length}</span>
            </summary>
            {entries.map((log) => (
              <article
                key={log.id}
                className="border-b border-[#21262d] last:border-0"
              >
                <details className="group/entry">
                  <summary className="grid cursor-pointer list-none grid-cols-[12px_minmax(0,1fr)] items-start gap-x-2 px-3 py-2 hover:bg-[#161b22] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#7ee787] sm:py-1 [&::-webkit-details-marker]:hidden">
                    <ChevronRight
                      size={12}
                      className="mt-1 text-[#8b949e] transition-transform group-open/entry:rotate-90"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-3">
                        <time
                          dateTime={new Date(log.createdAt).toISOString()}
                          className="shrink-0 tabular-nums text-[#8b949e]"
                        >
                          {new Date(log.createdAt).toLocaleString("en-GB", {
                            timeZone: "Asia/Bangkok",
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                            hour12: false,
                          })}
                        </time>
                        <span
                          title={categoryInfo(log.category).label}
                          className={categoryInfo(log.category).style}
                        >
                          [{log.category}]
                          <span className="sr-only">
                            {categoryInfo(log.category).label}
                          </span>
                        </span>
                        <span className="break-all text-[#f0f6fc]">
                          {log.event}
                        </span>
                        <span className="truncate text-[#8b949e]">
                          {log.targetCode || "—"}
                        </span>
                      </div>
                    </div>
                  </summary>
                  <div className="min-w-0 border-t border-dashed border-[#30363d] bg-[#010409] px-4 py-2 sm:pl-8">
                    <p className="break-all">
                      <span className="text-[#8b949e]">actor </span>
                      {log.actor}
                    </p>
                    <p className="break-all">
                      <span className="text-[#8b949e]">target </span>
                      {log.targetCode || "—"}
                    </p>
                    <p className="break-all">
                      <span className="text-[#8b949e]">id </span>
                      {log.id}
                    </p>
                    <AuditDetails details={log.details} />
                  </div>
                </details>
              </article>
            ))}
          </details>
        ))}
        {!grouped.length && (
          <p className="px-4 py-8 text-[#8b949e]">No matching activity</p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#30363d] bg-[#161b22] px-3 py-2 text-[#8b949e]">
        <span>
          {availableWeeks.length} weeks · Mon–Sun · filters apply to loaded
          records
        </span>
        {hasMore && (
          <button
            type="button"
            disabled={loading}
            onClick={loadOlder}
            className="min-h-10 rounded px-2 text-[#7ee787] hover:bg-[#21262d] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#7ee787] disabled:opacity-50 sm:min-h-8"
          >
            {loading ? "Loading…" : "Load older activity"}
          </button>
        )}
      </div>
      {error && (
        <p
          role="alert"
          className="border-t border-[#30363d] px-3 py-2 text-rose-300"
        >
          {error}
        </p>
      )}
    </section>
  );
}

function AuditDetails({ details }: { details: string }) {
  try {
    const record = JSON.parse(details);
    if (record?.changes && typeof record.changes === "object")
      return (
        <div className="mt-2 border-t border-[#21262d] pt-2">
          <p className="text-[#8b949e]">changes · {record.table}</p>
          {Object.entries(record.changes).map(([field, value]) => {
            const change = value as { before: unknown; after: unknown };
            return (
              <div key={field} className="mt-1">
                <p className="text-[#79c0ff]">{field}</p>
                <pre className="whitespace-pre-wrap break-all text-[#ffa198]">
                  - {JSON.stringify(change.before, null, 2)}
                </pre>
                <pre className="whitespace-pre-wrap break-all text-[#7ee787]">
                  + {JSON.stringify(change.after, null, 2)}
                </pre>
              </div>
            );
          })}
        </div>
      );
  } catch {
    /* Display original summaries without transforming their content. */
  }
  return (
    <p className="mt-2 whitespace-pre-wrap break-words border-t border-[#21262d] pt-2">
      {details}
    </p>
  );
}
