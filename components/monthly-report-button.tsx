"use client";

import { useState, useTransition } from "react";
import { Download, FileSpreadsheet, Loader2, X } from "lucide-react";
import { formatMMK } from "@/lib/data";
import { getMonthlyReportAction, type MonthlyReportData } from "@/app/actions/report";
import { ModalPortal } from "@/components/modal-portal";

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const availableYears = [2024, 2025, 2026, 2027];

export function MonthlyReportButton({
  className = "",
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "compact" | "pill";
}) {
  const now = new Date();
  const [open, setOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [preview, setPreview] = useState<MonthlyReportData | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const loadPreview = (year: number, month: number) => {
    setSelectedYear(year);
    setSelectedMonth(month);
    setError(null);
    startTransition(async () => {
      const res = await getMonthlyReportAction(year, month);
      if (res.ok && res.data) {
        setPreview(res.data);
      } else {
        setError(res.error || "Failed to load month data");
      }
    });
  };

  const handleOpen = () => {
    setOpen(true);
    loadPreview(selectedYear, selectedMonth);
  };

  const downloadUrl = `/api/reports/monthly?year=${selectedYear}&month=${selectedMonth}`;

  return (
    <>
      {variant === "pill" ? (
        <button
          onClick={handleOpen}
          className={`flex items-center gap-1.5 rounded-full border border-[#dedbd1] bg-white px-4 py-2 text-xs font-bold text-black transition hover:bg-[#f3f1ea] ${className}`}
        >
          <FileSpreadsheet size={14} className="text-[#3b6d11]" />
          <span>Monthly Report</span>
        </button>
      ) : variant === "compact" ? (
        <button
          onClick={handleOpen}
          title="Download monthly financial report"
          aria-label="Download monthly financial report"
          className={`grid h-9 w-9 place-items-center rounded-xl border bg-white text-black hover:bg-[#f3f1ea] ${className}`}
        >
          <FileSpreadsheet size={16} />
        </button>
      ) : (
        <button
          onClick={handleOpen}
          className={`flex items-center gap-2 rounded-full bg-[#c7f36b] px-4 py-2.5 text-xs font-bold text-black shadow-sm transition hover:brightness-95 ${className}`}
        >
          <Download size={14} />
          <span>Monthly Report (CSV)</span>
        </button>
      )}

      {open && (
        <ModalPortal isOpen={open} onClose={() => setOpen(false)}>
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-2 sm:p-4 md:p-6 backdrop-blur-sm transition-opacity"
            role="dialog"
            aria-modal="true"
            aria-label="Download monthly report"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div className="card flex max-h-[92dvh] sm:max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden shadow-2xl">
              <div className="flex shrink-0 items-center justify-between border-b border-[#e5e4dc] bg-white p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#c7f36b] text-black">
                    <FileSpreadsheet size={20} />
                  </span>
                  <div>
                    <p className="eyebrow">Financial & Operations Export</p>
                    <h2 className="display mt-0.5 text-xl sm:text-2xl font-bold">Monthly Report</h2>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Close modal"
                  onClick={() => setOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-full border border-[#dedbd0] text-[#777] hover:bg-[#f1efe8] transition"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5">
                {/* Selectors */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="report-month" className="mb-1.5 block text-xs font-bold text-[#555]">
                      Select Month
                    </label>
                    <select
                      id="report-month"
                      className="h-11 w-full rounded-xl border bg-white px-3 text-sm font-semibold outline-none"
                      value={selectedMonth}
                      onChange={(e) => loadPreview(selectedYear, Number(e.target.value))}
                    >
                      {monthNames.map((name, idx) => (
                        <option key={name} value={idx + 1}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="report-year" className="mb-1.5 block text-xs font-bold text-[#555]">
                      Select Year
                    </label>
                    <select
                      id="report-year"
                      className="h-11 w-full rounded-xl border bg-white px-3 text-sm font-semibold outline-none"
                      value={selectedYear}
                      onChange={(e) => loadPreview(Number(e.target.value), selectedMonth)}
                    >
                      {availableYears.map((yr) => (
                        <option key={yr} value={yr}>
                          {yr}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Preview Cards */}
                {isPending ? (
                  <div className="flex h-44 items-center justify-center rounded-2xl bg-[#f7f6f1]">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#777]">
                      <Loader2 size={16} className="animate-spin text-black" />
                      <span>Aggregating monthly ledger data…</span>
                    </div>
                  </div>
                ) : error ? (
                  <div className="rounded-2xl border border-[#ffc7b4] bg-[#fff0eb] p-4 text-xs font-semibold text-[#9c3212]">
                    {error}
                  </div>
                ) : preview ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-[#171813] p-4 text-white">
                      <div className="flex items-center justify-between text-xs text-white/60">
                        <span>{preview.summary.monthLabel} Ledger</span>
                        <span className="pill border-white/20 bg-white/10 text-white">
                          {preview.summary.verifiedOrdersCount} Verified Orders
                        </span>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-white/50">Verified Revenue</p>
                          <p className="display mt-0.5 text-lg font-bold text-[#c7f36b]">
                            {formatMMK(preview.summary.verifiedRevenue)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-white/50">Gross Margin</p>
                          <p className="display mt-0.5 text-lg font-bold text-white">
                            {formatMMK(preview.summary.grossProfit)} ({preview.summary.grossMarginPercent}%)
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-white/50">Net Profit</p>
                          <p className="display mt-0.5 text-lg font-bold text-[#c7f36b]">
                            {formatMMK(preview.summary.netProfit)} ({preview.summary.netMarginPercent}%)
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Summary Breakdown Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                      <div className="rounded-xl border bg-[#fbf9f4] p-3">
                        <p className="text-[10px] text-[#777]">Total COGS</p>
                        <p className="mt-1 font-bold">{formatMMK(preview.summary.totalCogs)}</p>
                      </div>
                      <div className="rounded-xl border bg-[#fbf9f4] p-3">
                        <p className="text-[10px] text-[#777]">Operating Expenses</p>
                        <p className="mt-1 font-bold">{formatMMK(preview.summary.operatingExpenses)}</p>
                      </div>
                      <div className="rounded-xl border bg-[#fbf9f4] p-3">
                        <p className="text-[10px] text-[#777]">Warranty & RMA</p>
                        <p className="mt-1 font-bold">{formatMMK(preview.summary.warrantyCosts)}</p>
                      </div>
                      <div className="rounded-xl border bg-[#fbf9f4] p-3">
                        <p className="text-[10px] text-[#777]">Shipping Collected</p>
                        <p className="mt-1 font-bold">{formatMMK(preview.summary.shippingFeesCollected)}</p>
                      </div>
                    </div>

                    <p className="text-[11px] text-[#777]">
                      Includes 8 structured sections: Executive Summary, PUBG Accounts vs Gaming Gadgets breakdown, payment methods, channel distribution, top products, operating expenses, and itemized transaction ledgers.
                    </p>
                  </div>
                ) : null}
              </div>

              {/* Action Buttons */}
              <div className="flex shrink-0 flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 border-t border-[#e5e4dc] bg-[#f8f7f2] p-3.5 sm:p-5">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-[#dedbd0] bg-white px-4 py-2.5 text-xs font-bold transition hover:bg-[#f1efe8] min-h-[42px]"
                >
                  Cancel
                </button>
                <a
                  href={downloadUrl}
                  download
                  onClick={() => setTimeout(() => setOpen(false), 800)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-black px-5 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-[#2c2c28] min-h-[42px]"
                >
                  <Download size={15} />
                  <span>Download {monthNames[selectedMonth - 1]} Report (CSV)</span>
                </a>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
