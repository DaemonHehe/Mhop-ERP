"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  Loader2,
  Megaphone,
  MessageSquare,
  PackageCheck,
  Search,
  Send,
  Sparkles,
  Truck,
  Users,
  X,
} from "lucide-react";
import {
  getBroadcastAudienceAction,
  sendTelegramBroadcastAction,
  type BroadcastAudience,
  type BroadcastResult,
} from "@/app/actions/broadcast";

const TEMPLATES = [
  {
    title: "Delivered Follow-up",
    text: "မင်္ဂလာပါခင်ဗျာ။ MH OP မှ ဝယ်ယူအားပေးခဲ့သော ပစ္စည်းလေး အဆင်ပြေပြေ ရောက်ရှိအသုံးပြုနိုင်ပါရဲ့လားခင်ဗျာ။\n\nWarranty စစ်ဆေးလိုပါက /warranty သို့မဟုတ် အကူအညီလိုအပ်ပါက /support မှတဆင့် အချိန်မရွေး ဆက်သွယ်နိုင်ပါသည်ခင်ဗျာ။",
  },
  {
    title: "New Arrivals",
    text: "မင်္ဂလာပါခင်ဗျာ။ MH OP Store မှာ Gaming Gadgets ပစ္စည်းအသစ်များ ထပ်မံရောက်ရှိပါပြီခင်ဗျာ။\n\nရရှိနိုင်သော ပစ္စည်းများနှင့် စျေးနှုန်းများကို /catalog မှတဆင့် အလွယ်တကူ ကြည့်ရှုဝယ်ယူနိုင်ပါသည်ခင်ဗျာ။",
  },
  {
    title: "Special Offer",
    text: "မင်္ဂလာပါခင်ဗျာ။ MH OP မှ အထူးလျော့စျေး Promotion အစီအစဉ် စတင်ပါပြီခင်ဗျာ။\n\nပစ္စည်းအရေအတွက် ကန့်သတ်ထားပါသဖြင့် အမြန်ဆုံး အော်ဒါတင်သွင်းနိုင်ပါသည်ခင်ဗျာ။ /catalog",
  },
  {
    title: "PUBG Restock",
    text: "မင်္ဂလာပါခင်ဗျာ။ PUBG Mobile Verified Account အသစ်များ Catalog ထဲတွင် ထပ်မံတင်ထားပါပြီခင်ဗျာ။\n\nအသေးစိတ်အချက်အလက်များကို /catalog မှတဆင့် ဝင်ရောက်ကြည့်ရှုနိုင်ပါသည်ခင်ဗျာ။",
  },
];

type TargetSegment = "all" | "delivered" | "active" | "custom";

export function TelegramBroadcastModal({
  isOpen,
  onClose,
  initialSegment = "all",
}: {
  isOpen: boolean;
  onClose: () => void;
  initialSegment?: TargetSegment;
}) {
  const [audience, setAudience] = useState<BroadcastAudience | null>(null);
  const [loadingAudience, setLoadingAudience] = useState(false);
  const [segment, setSegment] = useState<TargetSegment>(initialSegment);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<BroadcastResult | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (isOpen) {
      setResult(null);
      setConfirmed(false);
      setSegment(initialSegment);
      setSearchQuery("");
      setLoadingAudience(true);
      getBroadcastAudienceAction()
        .then((data) => {
          setAudience(data);
          // Preselect all delivered or all IDs if custom
          if (initialSegment === "delivered") {
            setSelectedUserIds(
              data.recipients.filter((r) => r.hasDelivered).map((r) => r.telegramUserId),
            );
          } else {
            setSelectedUserIds(data.recipients.map((r) => r.telegramUserId));
          }
        })
        .catch(() =>
          setAudience({
            totalCount: 0,
            deliveredCount: 0,
            activeCount: 0,
            recipients: [],
            botConfigured: false,
          }),
        )
        .finally(() => setLoadingAudience(false));
    }
  }, [isOpen, initialSegment]);

  // Filtered recipients for custom list
  const filteredRecipients = useMemo(() => {
    if (!audience) return [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return audience.recipients;
    return audience.recipients.filter(
      (r) =>
        r.telegramUserId.toLowerCase().includes(query) ||
        (r.name && r.name.toLowerCase().includes(query)) ||
        (r.phone && r.phone.toLowerCase().includes(query)) ||
        (r.latestOrderCode && r.latestOrderCode.toLowerCase().includes(query)),
    );
  }, [audience, searchQuery]);

  // Target count based on segment
  const activeRecipientCount = useMemo(() => {
    if (!audience) return 0;
    if (segment === "delivered") return audience.deliveredCount;
    if (segment === "active") return audience.activeCount;
    if (segment === "custom") return selectedUserIds.length;
    return audience.totalCount;
  }, [audience, segment, selectedUserIds]);

  if (!isOpen) return null;

  const handleSelectAllCustom = () => {
    if (!audience) return;
    setSelectedUserIds(audience.recipients.map((r) => r.telegramUserId));
  };

  const handleClearCustom = () => {
    setSelectedUserIds([]);
  };

  const toggleUserId = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
    setConfirmed(false);
  };

  const handleSend = () => {
    if (!message.trim() || !confirmed || activeRecipientCount === 0) return;
    setResult(null);
    startTransition(async () => {
      try {
        const res = await sendTelegramBroadcastAction(message, {
          segment,
          selectedTelegramUserIds: segment === "custom" ? selectedUserIds : undefined,
        });
        setResult(res);
      } catch (err) {
        setResult({
          ok: false,
          total: activeRecipientCount,
          sent: 0,
          blocked: 0,
          unreachable: 0,
          failed: 0,
          error: err instanceof Error ? err.message : "Broadcast failed unexpectedly.",
        });
      }
    });
  };

  const isSendDisabled =
    isPending ||
    loadingAudience ||
    activeRecipientCount === 0 ||
    !message.trim() ||
    !confirmed ||
    !audience?.botConfigured;

  const segmentLabels: Record<TargetSegment, string> = {
    all: "All Customers",
    delivered: "Delivered Orders Only",
    active: "Active / In-Transit Orders",
    custom: "Selected Custom Recipients",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="broadcast-modal-title"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-3xl bg-[#f7f6f2] p-5 shadow-2xl sm:p-7">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-black/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#0088cc] text-white">
              <Megaphone size={20} />
            </div>
            <div>
              <h2 id="broadcast-modal-title" className="text-xl font-bold tracking-tight">
                Broadcast to Telegram Customers
              </h2>
              <p className="text-xs text-[#77776f]">
                Targeted notifications via the customer sales bot
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-full p-2 text-[#777] hover:bg-black/5 disabled:opacity-50"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 space-y-4 overflow-y-auto py-4">
          {/* Target Audience Segment Selection */}
          <div className="rounded-2xl border border-black/5 bg-white p-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#77776f]">
                Target Audience Segment
              </label>
              {audience?.botConfigured ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800">
                  <CheckCircle2 size={13} /> Bot online
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700">
                  <AlertCircle size={13} /> Bot token missing
                </span>
              )}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => {
                  setSegment("delivered");
                  setConfirmed(false);
                }}
                className={`flex flex-col items-start rounded-xl border p-2.5 text-left transition ${
                  segment === "delivered"
                    ? "border-[#0088cc] bg-[#0088cc]/10 font-bold text-[#0088cc]"
                    : "border-black/5 bg-[#faf9f5] text-[#555] hover:border-black/20"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <PackageCheck size={16} />
                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                    {audience?.deliveredCount ?? 0}
                  </span>
                </div>
                <span className="mt-1 text-xs font-bold">Delivered</span>
                <span className="text-[9px] text-[#777]">Post-delivery care</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSegment("active");
                  setConfirmed(false);
                }}
                className={`flex flex-col items-start rounded-xl border p-2.5 text-left transition ${
                  segment === "active"
                    ? "border-[#0088cc] bg-[#0088cc]/10 font-bold text-[#0088cc]"
                    : "border-black/5 bg-[#faf9f5] text-[#555] hover:border-black/20"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <Truck size={16} />
                  <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
                    {audience?.activeCount ?? 0}
                  </span>
                </div>
                <span className="mt-1 text-xs font-bold">Active / In-Transit</span>
                <span className="text-[9px] text-[#777]">Packing & dispatch</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSegment("all");
                  setConfirmed(false);
                }}
                className={`flex flex-col items-start rounded-xl border p-2.5 text-left transition ${
                  segment === "all"
                    ? "border-[#0088cc] bg-[#0088cc]/10 font-bold text-[#0088cc]"
                    : "border-black/5 bg-[#faf9f5] text-[#555] hover:border-black/20"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <Users size={16} />
                  <span className="rounded-full bg-neutral-200 px-1.5 py-0.5 text-[10px] font-bold text-neutral-800">
                    {audience?.totalCount ?? 0}
                  </span>
                </div>
                <span className="mt-1 text-xs font-bold">All Customers</span>
                <span className="text-[9px] text-[#777]">Whole database</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSegment("custom");
                  setConfirmed(false);
                }}
                className={`flex flex-col items-start rounded-xl border p-2.5 text-left transition ${
                  segment === "custom"
                    ? "border-[#0088cc] bg-[#0088cc]/10 font-bold text-[#0088cc]"
                    : "border-black/5 bg-[#faf9f5] text-[#555] hover:border-black/20"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <CheckSquare size={16} />
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                    {selectedUserIds.length}
                  </span>
                </div>
                <span className="mt-1 text-xs font-bold">Choose Specific</span>
                <span className="text-[9px] text-[#777]">Manual pick</span>
              </button>
            </div>

            {/* Custom selection checklist dropdown/box */}
            {segment === "custom" && audience && (
              <div className="mt-3 rounded-xl border border-black/10 bg-[#f9f8f4] p-3">
                <div className="flex items-center justify-between gap-2 pb-2">
                  <div className="relative flex-1">
                    <Search
                      size={13}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#777]"
                    />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search name, phone, Telegram..."
                      className="h-8 w-full rounded-lg border border-black/10 bg-white pl-7 pr-2 text-xs outline-none focus:border-[#0088cc]"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={handleSelectAllCustom}
                      className="font-bold text-[#0088cc] hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-[#999]">|</span>
                    <button
                      type="button"
                      onClick={handleClearCustom}
                      className="text-[#666] hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="max-h-36 space-y-1 overflow-y-auto pr-1 text-xs">
                  {filteredRecipients.length === 0 ? (
                    <p className="py-2 text-center text-[#888]">No matching customers found</p>
                  ) : (
                    filteredRecipients.map((r) => {
                      const isChecked = selectedUserIds.includes(r.telegramUserId);
                      return (
                        <label
                          key={r.telegramUserId}
                          className="flex cursor-pointer items-center justify-between rounded-lg p-1.5 hover:bg-black/5"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleUserId(r.telegramUserId)}
                              className="h-3.5 w-3.5 rounded text-[#0088cc]"
                            />
                            <span className="font-semibold text-[#222]">
                              {r.name || "Customer"}
                            </span>
                            {r.phone && <span className="text-[#666]">({r.phone})</span>}
                          </div>
                          <div className="flex items-center gap-1 text-[10px]">
                            {r.hasDelivered && (
                              <span className="rounded bg-emerald-100 px-1 py-0.2 font-bold text-emerald-800">
                                Delivered
                              </span>
                            )}
                            {r.hasActive && (
                              <span className="rounded bg-blue-100 px-1 py-0.2 font-bold text-blue-800">
                                Active
                              </span>
                            )}
                            <span className="font-mono text-[#777]">{r.telegramUserId}</span>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between text-xs text-[#555]">
              <span>
                Target: <strong>{segmentLabels[segment]}</strong>
              </span>
              <span>
                Recipient count:{" "}
                <strong className="text-sm font-black text-black">
                  {activeRecipientCount}
                </strong>{" "}
                customer(s)
              </span>
            </div>
          </div>

          {/* Quick Templates */}
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-[#555]">
              <Sparkles size={14} className="text-amber-500" />
              <span>Quick templates</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.title}
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    setMessage(tmpl.text);
                    setConfirmed(false);
                  }}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                    tmpl.title === "Delivered Follow-up"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                      : "border-black/10 bg-white text-[#444] hover:border-[#0088cc] hover:text-[#0088cc]"
                  }`}
                >
                  {tmpl.title}
                </button>
              ))}
            </div>
          </div>

          {/* Message Content */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="broadcast-message-text"
                className="text-xs font-bold text-[#333]"
              >
                Message Content
              </label>
              <span
                className={`text-[11px] ${
                  message.length > 3800 ? "font-bold text-red-500" : "text-[#777]"
                }`}
              >
                {message.length} / 4,000
              </span>
            </div>
            <textarea
              id="broadcast-message-text"
              rows={4}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setConfirmed(false);
              }}
              disabled={isPending}
              placeholder="Type your announcement, review request, or update here... Customers can reply directly to chat with the bot."
              className="w-full rounded-2xl border border-black/10 bg-white p-3.5 text-sm outline-none transition-all focus:border-[#0088cc] focus:ring-2 focus:ring-[#0088cc]/20"
            />
          </div>

          {/* Telegram Preview */}
          {message.trim() && (
            <div className="rounded-2xl border border-black/5 bg-[#eef3f6] p-3.5">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#0088cc]">
                <MessageSquare size={13} />
                <span>Customer Telegram Preview</span>
              </div>
              <div className="max-w-md rounded-2xl rounded-tl-sm bg-white p-3 text-xs leading-relaxed text-[#222] shadow-sm">
                <p className="whitespace-pre-line">{message}</p>
                <span className="mt-1 block text-right text-[9px] text-[#999]">
                  {new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          )}

          {/* Outcome Banner */}
          {result && (
            <div
              className={`rounded-2xl p-4 text-xs ${
                result.ok
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border border-red-200 bg-red-50 text-red-900"
              }`}
              role="status"
            >
              <div className="flex items-center gap-2 text-sm font-bold">
                {result.ok ? (
                  <>
                    <CheckCircle2 size={16} className="text-emerald-700" />
                    <span>Broadcast completed successfully</span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={16} className="text-red-700" />
                    <span>Broadcast encountered issues</span>
                  </>
                )}
              </div>
              {result.error && (
                <p className="mt-1 font-medium text-red-700">{result.error}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-4 text-[11px]">
                <span>
                  <strong>Targeted:</strong> {result.total}
                </span>
                <span className="text-emerald-700">
                  <strong>Delivered:</strong> {result.sent}
                </span>
                {result.blocked > 0 && (
                  <span className="text-amber-700">
                    <strong>Blocked:</strong> {result.blocked}
                  </span>
                )}
                {result.unreachable > 0 && (
                  <span className="text-[#666]">
                    <strong>Unreachable:</strong> {result.unreachable}
                  </span>
                )}
                {result.failed > 0 && (
                  <span className="text-red-700">
                    <strong>Failed:</strong> {result.failed}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Double confirmation checkbox */}
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200/60 bg-amber-50/70 p-3.5">
            <input
              type="checkbox"
              id="confirm-broadcast"
              checked={confirmed}
              disabled={isPending || activeRecipientCount === 0 || !message.trim()}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded text-[#0088cc] focus:ring-[#0088cc]"
            />
            <label
              htmlFor="confirm-broadcast"
              className="select-none text-xs leading-5 text-amber-900"
            >
              I confirm sending this broadcast message to{" "}
              <strong>
                {activeRecipientCount} customer(s) ({segmentLabels[segment]})
              </strong>{" "}
              through the customer sales bot.
            </label>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-black/5 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-xl px-4 py-2.5 text-xs font-semibold text-[#666] hover:bg-black/5 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={isSendDisabled}
            className="flex items-center gap-2 rounded-xl bg-[#0088cc] px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-[#0077b5] disabled:opacity-40"
          >
            {isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Sending broadcast...</span>
              </>
            ) : (
              <>
                <Send size={14} />
                <span>Send Broadcast ({activeRecipientCount})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
