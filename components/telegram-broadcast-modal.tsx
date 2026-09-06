"use client";

import { useEffect, useState, useTransition } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Megaphone,
  MessageSquare,
  Send,
  Sparkles,
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

export function TelegramBroadcastModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [audience, setAudience] = useState<BroadcastAudience | null>(null);
  const [loadingAudience, setLoadingAudience] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<BroadcastResult | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (isOpen) {
      setResult(null);
      setConfirmed(false);
      setLoadingAudience(true);
      getBroadcastAudienceAction()
        .then((data) => setAudience(data))
        .catch(() =>
          setAudience({ totalCount: 0, recipients: [], botConfigured: false }),
        )
        .finally(() => setLoadingAudience(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSend = () => {
    if (!message.trim() || !confirmed) return;
    setResult(null);
    startTransition(async () => {
      try {
        const res = await sendTelegramBroadcastAction(message);
        setResult(res);
      } catch (err) {
        setResult({
          ok: false,
          total: audience?.totalCount || 0,
          sent: 0,
          blocked: 0,
          unreachable: 0,
          failed: 0,
          error: err instanceof Error ? err.message : "Broadcast failed unexpectedly.",
        });
      }
    });
  };

  const recipientCount = audience?.totalCount ?? 0;
  const isSendDisabled =
    isPending ||
    loadingAudience ||
    recipientCount === 0 ||
    !message.trim() ||
    !confirmed ||
    !audience?.botConfigured;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="broadcast-modal-title"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl bg-[#f7f6f2] p-6 shadow-2xl sm:p-8">
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
                Send a direct notification through the customer sales bot
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
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Audience Snapshot */}
          <div className="rounded-2xl border border-black/5 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#77776f]">
                  Reachable Telegram Audience
                </p>
                <div className="mt-1 flex items-center gap-2">
                  {loadingAudience ? (
                    <div className="flex items-center gap-2 text-sm text-[#777]">
                      <Loader2 size={16} className="animate-spin" /> Fetching reachable customers...
                    </div>
                  ) : (
                    <>
                      <span className="text-2xl font-bold text-black">{recipientCount}</span>
                      <span className="text-xs text-[#666]">
                        active customer bot {recipientCount === 1 ? "chat" : "chats"}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div>
                {audience && !audience.botConfigured ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                    <AlertCircle size={13} /> Bot token not configured
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                    <CheckCircle2 size={13} /> Bot online
                  </span>
                )}
              </div>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-[#777]">
              Reaches customers who have started your Telegram customer bot. Users who blocked the bot are automatically isolated.
            </p>
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
                  className="rounded-xl border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-[#444] transition-all hover:border-[#0088cc] hover:text-[#0088cc]"
                >
                  {tmpl.title}
                </button>
              ))}
            </div>
          </div>

          {/* Message Composition */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="broadcast-message-text" className="text-xs font-bold text-[#333]">
                Message Content
              </label>
              <span className={`text-[11px] ${message.length > 3800 ? "text-red-500 font-bold" : "text-[#777]"}`}>
                {message.length} / 4,000
              </span>
            </div>
            <textarea
              id="broadcast-message-text"
              rows={5}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setConfirmed(false);
              }}
              disabled={isPending}
              placeholder="Type your announcement, promotion, or update here... Customers can reply directly to chat with the bot."
              className="w-full rounded-2xl border border-black/10 bg-white p-3.5 text-sm outline-none transition-all focus:border-[#0088cc] focus:ring-2 focus:ring-[#0088cc]/20"
            />
          </div>

          {/* Message Preview */}
          {message.trim() && (
            <div className="rounded-2xl border border-black/5 bg-[#eef3f6] p-4">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#0088cc]">
                <MessageSquare size={13} />
                <span>Customer Telegram Preview</span>
              </div>
              <div className="max-w-md rounded-2xl rounded-tl-sm bg-white p-3.5 text-xs leading-relaxed text-[#222] shadow-sm">
                <p className="whitespace-pre-line">{message}</p>
                <span className="mt-1 block text-right text-[9px] text-[#999]">
                  {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          )}

          {/* Results Outcome Banner */}
          {result && (
            <div
              className={`rounded-2xl p-4 text-xs ${
                result.ok
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border border-red-200 bg-red-50 text-red-900"
              }`}
              role="status"
            >
              <div className="flex items-center gap-2 font-bold text-sm">
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
              {result.error && <p className="mt-1 text-red-700 font-medium">{result.error}</p>}
              <div className="mt-2 flex flex-wrap gap-4 text-[11px]">
                <span><strong>Total:</strong> {result.total}</span>
                <span className="text-emerald-700"><strong>Delivered:</strong> {result.sent}</span>
                {result.blocked > 0 && <span className="text-amber-700"><strong>Blocked:</strong> {result.blocked}</span>}
                {result.unreachable > 0 && <span className="text-[#666]"><strong>Unreachable:</strong> {result.unreachable}</span>}
                {result.failed > 0 && <span className="text-red-700"><strong>Failed:</strong> {result.failed}</span>}
              </div>
              {result.errors && result.errors.length > 0 && (
                <div className="mt-2 text-[10px] text-red-800">
                  <p className="font-bold">Errors sample:</p>
                  <ul className="list-disc pl-4">
                    {result.errors.map((e, idx) => (
                      <li key={idx}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Double-confirmation checkbox */}
          <div className="flex items-start gap-3 rounded-2xl bg-amber-50/70 p-3.5 border border-amber-200/60">
            <input
              type="checkbox"
              id="confirm-broadcast"
              checked={confirmed}
              disabled={isPending || recipientCount === 0 || !message.trim()}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded text-[#0088cc] focus:ring-[#0088cc]"
            />
            <label htmlFor="confirm-broadcast" className="text-xs leading-5 text-amber-900 select-none">
              I understand that clicking send will deliver this message to all{" "}
              <strong>{recipientCount}</strong> reachable Telegram customers via the customer sales bot.
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
                <span>Send Broadcast ({recipientCount})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
