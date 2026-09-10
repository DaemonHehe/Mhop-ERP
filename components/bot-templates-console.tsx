"use client";

import { useState, useTransition, useId, useMemo } from "react";
import {
  Bot,
  Save,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Check,
  Users,
  Search,
  Send,
  Loader2,
  Wand2,
  Plus,
  Trash2,
  Edit2,
  X,
  HelpCircle,
} from "lucide-react";
import {
  saveBotTemplateAction,
  resetBotTemplateAction,
  testSalesAgentAction,
} from "@/app/actions/bot-settings";
import {
  createAiSalesQaAction,
  updateAiSalesQaAction,
  deleteAiSalesQaAction,
} from "@/app/actions/ai-qa";
import type { BotTemplateItem } from "@/lib/services/bot-settings.service";
import {
  type AiSalesQaItem,
  QA_CATEGORIES,
} from "@/lib/services/ai-qa.service";

const SAMPLE_VARS: Record<string, string> = {
  customer: "Ko Ko Kyaw",
  order_code: "MHOP-260830-AB12",
  voucher: "MHOP10-AB12",
  discount_percent: "10",
  unshipped: "3",
  pending_slips: "1",
  revenue: "1,250,000",
  gross_profit: "340,000",
  low_stock_count: "2",
  low_stock_list: "• Phone Cooler (COOL-01): 2\n• Black Shark Fan (BS-FAN): 1",
  title: "Payment verified",
  body: "Slip confirmed by Admin for Order MHOP-260830-AB12",
  target_code: "MHOP-260830-AB12",
  timestamp: "2026-09-09 15:30:00",
};

export function BotTemplatesConsole({
  initialTemplates,
  initialQaItems = [],
}: {
  initialTemplates: BotTemplateItem[];
  initialQaItems?: AiSalesQaItem[];
}) {
  const [templates, setTemplates] = useState<BotTemplateItem[]>(initialTemplates);
  const [qaItems, setQaItems] = useState<AiSalesQaItem[]>(initialQaItems);
  const [channelFilter, setChannelFilter] = useState<"all" | "customer" | "staff">("all");
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string>("ai_sales_agent");
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialTemplates.map((t) => [t.key, t.content])),
  );
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(
    null,
  );
  const textareaId = useId();

  // Q&A Knowledge Feed State
  const [isAddingQa, setIsAddingQa] = useState(false);
  const [editingQaId, setEditingQaId] = useState<string | null>(null);
  const [qaFormQuestion, setQaFormQuestion] = useState("");
  const [qaFormAnswer, setQaFormAnswer] = useState("");
  const [qaFormCategory, setQaFormCategory] = useState<string>("gaming_gadgets");
  const [qaQuery, setQaQuery] = useState("");
  const [qaCategoryFilter, setQaCategoryFilter] = useState<string>("all");
  const [qaSaving, setQaSaving] = useState(false);

  // Live AI Simulator State
  const [testQuestion, setTestQuestion] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testChat, setTestChat] = useState<
    Array<{ role: "user" | "assistant"; text: string; mode?: string }>
  >([
    {
      role: "assistant",
      text: "မင်္ဂလာပါခင်ဗျာ။ MH OP Store AI Sales Advisor ဖြစ်ပါတယ်။ Gaming accessories သို့မဟုတ် PUBG Mobile account ဘာမျိုးရှာနေလဲ budget နဲ့ device လေး ပြောပြပေးပါခင်ဗျာ။",
      mode: "safe_fallback",
    },
  ]);

  const handleTestSubmit = async (queryText?: string) => {
    const q = (queryText || testQuestion).trim();
    if (!q || testLoading) return;
    setTestQuestion("");
    setTestChat((prev) => [...prev, { role: "user", text: q }]);
    setTestLoading(true);
    try {
      const res = await testSalesAgentAction(q);
      if (res.ok && res.reply) {
        setTestChat((prev) => [
          ...prev,
          { role: "assistant", text: res.reply!, mode: res.mode },
        ]);
      } else {
        setTestChat((prev) => [
          ...prev,
          { role: "assistant", text: res.error || "Failed to generate reply.", mode: "error" },
        ]);
      }
    } catch {
      setTestChat((prev) => [
        ...prev,
        { role: "assistant", text: "Network error while contacting AI Sales Agent.", mode: "error" },
      ]);
    } finally {
      setTestLoading(false);
    }
  };

  const isAiAgentSelected = selectedKey === "ai_sales_agent";

  // Q&A CRUD Handlers
  const handleStartAddQa = () => {
    setEditingQaId(null);
    setQaFormQuestion("");
    setQaFormAnswer("");
    setQaFormCategory("gaming_gadgets");
    setIsAddingQa(true);
  };

  const handleStartEditQa = (item: AiSalesQaItem) => {
    setEditingQaId(item.id);
    setQaFormQuestion(item.question);
    setQaFormAnswer(item.answer);
    setQaFormCategory(item.category);
    setIsAddingQa(true);
  };

  const handleCancelQaForm = () => {
    setIsAddingQa(false);
    setEditingQaId(null);
    setQaFormQuestion("");
    setQaFormAnswer("");
  };

  const handleSaveQa = async () => {
    const question = qaFormQuestion.trim();
    const answer = qaFormAnswer.trim();
    if (!question || !answer) {
      setNotice({ kind: "error", text: "Please provide both Question and Answer." });
      return;
    }

    setQaSaving(true);
    setNotice(null);
    try {
      if (editingQaId) {
        const res = await updateAiSalesQaAction(editingQaId, {
          question,
          answer,
          category: qaFormCategory,
        });
        if (res.ok && res.item) {
          setQaItems((prev) => prev.map((x) => (x.id === editingQaId ? res.item! : x)));
          setNotice({ kind: "success", text: "Q&A Knowledge entry updated successfully!" });
          handleCancelQaForm();
        } else {
          setNotice({ kind: "error", text: res.error || "Failed to update Q&A." });
        }
      } else {
        const res = await createAiSalesQaAction({
          question,
          answer,
          category: qaFormCategory,
        });
        if (res.ok && res.item) {
          setQaItems((prev) => [res.item!, ...prev]);
          setNotice({ kind: "success", text: "New Q&A entry added and fed to AI Sales Agent!" });
          handleCancelQaForm();
        } else {
          setNotice({ kind: "error", text: res.error || "Failed to create Q&A." });
        }
      }
    } catch {
      setNotice({ kind: "error", text: "Unexpected error saving Q&A." });
    } finally {
      setQaSaving(false);
    }
  };

  const handleToggleQaActive = async (item: AiSalesQaItem) => {
    setNotice(null);
    try {
      const res = await updateAiSalesQaAction(item.id, { isActive: !item.isActive });
      if (res.ok && res.item) {
        setQaItems((prev) => prev.map((x) => (x.id === item.id ? res.item! : x)));
        setNotice({
          kind: "success",
          text: `Q&A marked ${!item.isActive ? "active" : "inactive"}.`,
        });
      }
    } catch {
      setNotice({ kind: "error", text: "Failed to update Q&A status." });
    }
  };

  const handleDeleteQa = async (item: AiSalesQaItem) => {
    if (!confirm(`Delete Q&A: "${item.question.slice(0, 50)}..."?`)) return;
    setNotice(null);
    try {
      const res = await deleteAiSalesQaAction(item.id);
      if (res.ok) {
        setQaItems((prev) => prev.filter((x) => x.id !== item.id));
        setNotice({ kind: "success", text: "Q&A entry removed from AI knowledge." });
        if (editingQaId === item.id) handleCancelQaForm();
      } else {
        setNotice({ kind: "error", text: res.error || "Failed to delete Q&A." });
      }
    } catch {
      setNotice({ kind: "error", text: "Failed to delete Q&A." });
    }
  };

  // Filtered Q&A items
  const filteredQaItems = useMemo(() => {
    const q = qaQuery.trim().toLowerCase();
    return qaItems.filter((item) => {
      if (qaCategoryFilter !== "all" && item.category !== qaCategoryFilter) return false;
      if (!q) return true;
      return (
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [qaItems, qaQuery, qaCategoryFilter]);

  // Template Directory Filtering
  const customerCount = useMemo(
    () => templates.filter((t) => t.channel !== "staff").length,
    [templates],
  );
  const staffCount = useMemo(
    () => templates.filter((t) => t.channel === "staff").length,
    [templates],
  );

  const normalizedQuery = query.trim().toLowerCase();

  const visibleTemplates = useMemo(() => {
    return templates.filter((t) => {
      if (channelFilter === "customer" && t.channel === "staff") return false;
      if (channelFilter === "staff" && t.channel !== "staff") return false;

      if (!normalizedQuery) return true;

      const haystack = [
        t.key,
        t.label,
        t.description,
        t.content,
        t.triggerSource,
        ...(t.placeholders || []),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [templates, channelFilter, normalizedQuery]);

  const activeTemplate =
    templates.find((t) => t.key === selectedKey) ||
    visibleTemplates.find((t) => t.key === selectedKey) ||
    visibleTemplates[0] ||
    templates[0];

  const activeKey = isAiAgentSelected ? "ai_sales_agent" : activeTemplate?.key || selectedKey;
  const draftContent = drafts[activeKey] ?? activeTemplate?.content ?? "";
  const isStaffChannel = activeTemplate?.channel === "staff";

  const handleDraftChange = (value: string) => {
    setDrafts((prev) => ({ ...prev, [activeKey]: value }));
  };

  const insertVariable = (token: string) => {
    const el = document.getElementById(textareaId) as HTMLTextAreaElement | null;
    if (!el) {
      handleDraftChange(draftContent + " " + token);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const updated =
      draftContent.substring(0, start) + token + draftContent.substring(end);
    handleDraftChange(updated);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    }, 0);
  };

  const handleSave = () => {
    setNotice(null);
    startTransition(async () => {
      try {
        const res = await saveBotTemplateAction(activeKey, draftContent);
        if (res.ok) {
          setTemplates((prev) =>
            prev.map((t) =>
              t.key === activeKey
                ? { ...t, content: draftContent, isCustomized: true, updatedAt: new Date() }
                : t,
            ),
          );
          setNotice({
            kind: "success",
            text: `Template "${activeTemplate.label}" saved and active!`,
          });
        } else {
          setNotice({ kind: "error", text: res.error || "Failed to save template." });
        }
      } catch {
        setNotice({
          kind: "error",
          text: "An unexpected error occurred while saving.",
        });
      }
    });
  };

  const handleReset = () => {
    if (
      !confirm(
        `Reset "${activeTemplate.label}" back to original factory default message?`,
      )
    )
      return;
    setNotice(null);
    startTransition(async () => {
      try {
        const res = await resetBotTemplateAction(activeKey);
        if (res.ok) {
          const defaultText =
            initialTemplates.find((t) => t.key === activeKey)?.content || "";
          setDrafts((prev) => ({ ...prev, [activeKey]: defaultText }));
          setTemplates((prev) =>
            prev.map((t) =>
              t.key === activeKey
                ? { ...t, content: defaultText, isCustomized: false, updatedAt: new Date() }
                : t,
            ),
          );
          setNotice({
            kind: "success",
            text: `Template reset to factory default.`,
          });
        } else {
          setNotice({ kind: "error", text: res.error || "Failed to reset." });
        }
      } catch {
        setNotice({ kind: "error", text: "Failed to reset template." });
      }
    });
  };

  // Preview interpolation
  const previewText = draftContent.replace(
    /\{([a-zA-Z0-9_]+)\}/g,
    (match, token) => SAMPLE_VARS[token] || match,
  );

  const getSourceBadge = (src: string) => {
    switch (src) {
      case "telegram_ai_sales_agent":
        return "AI 24/7";
      case "n8n_cart_recovery":
        return "15m auto";
      case "telegram_bot_start":
        return "/start";
      case "telegram_slip_upload":
        return "Slip review";
      case "n8n_daily_briefing":
        return "n8n 08:30";
      case "n8n_financial_digest":
        return "n8n 22:00";
      case "n8n_event_alert":
        return "Live alert";
      default:
        return "Automation";
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Category Pill Buttons */}
        <div className="flex max-w-full overflow-x-auto rounded-full border bg-white/60 p-1">
          <button
            type="button"
            onClick={() => {
              setChannelFilter("all");
              setSelectedKey("ai_sales_agent");
            }}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition ${
              isAiAgentSelected
                ? "bg-black text-white shadow-sm"
                : "text-[#626258] hover:text-black"
            }`}
          >
            <Sparkles size={13} className="text-[#9fc744]" />
            AI Sales Q&A Feed ({qaItems.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setChannelFilter("customer");
              if (isAiAgentSelected) setSelectedKey("welcome");
            }}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition ${
              channelFilter === "customer" && !isAiAgentSelected
                ? "bg-black text-white shadow-sm"
                : "text-[#626258] hover:text-black"
            }`}
          >
            <Bot size={13} />
            Customer Bot Messages ({customerCount})
          </button>
          <button
            type="button"
            onClick={() => {
              setChannelFilter("staff");
              if (isAiAgentSelected) setSelectedKey("manager_morning_briefing");
            }}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition ${
              channelFilter === "staff" && !isAiAgentSelected
                ? "bg-black text-white shadow-sm"
                : "text-[#626258] hover:text-black"
            }`}
          >
            <Users size={13} />
            Staff & Manager Alerts ({staffCount})
          </button>
        </div>

        {/* Search Box */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <label className="relative block w-full sm:w-auto sm:min-w-[260px]">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#77776f]"
            />
            <span className="sr-only">Search triggers or Q&A</span>
            <input
              value={isAiAgentSelected ? qaQuery : query}
              onChange={(e) => {
                if (isAiAgentSelected) setQaQuery(e.target.value);
                else setQuery(e.target.value);
              }}
              placeholder={
                isAiAgentSelected
                  ? "Search Q&A questions or answers..."
                  : "Search templates, triggers, copy..."
              }
              className="h-11 w-full rounded-xl border bg-white pl-9 pr-3 text-sm outline-none focus:border-black"
            />
          </label>
        </div>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div
          role="status"
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-xs font-semibold ${
            notice.kind === "error"
              ? "border-[#ffc7b4] bg-[#fff0eb] text-[#9c3212]"
              : "border-[#cce99a] bg-[#f2fbdf] text-[#416c17]"
          }`}
        >
          {notice.kind === "success" ? (
            <CheckCircle2 size={16} className="shrink-0" />
          ) : (
            <AlertCircle size={16} className="shrink-0" />
          )}
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="ml-auto text-[#77776f] hover:text-black"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Master-Detail Layout */}
      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        {/* Left Column: Directory List */}
        <section className="card min-w-0 overflow-hidden">
          <div className="flex items-center justify-between border-b p-4">
            <div>
              <p className="font-bold">Bot Control Directory</p>
              <p className="mt-0.5 text-xs text-[#77776f]">
                AI knowledge feed + 7 message automations
              </p>
            </div>
            <span className="pill py-0.5 text-[10px]">
              {isAiAgentSelected ? "AI Knowledge" : "Message Triggers"}
            </span>
          </div>

          <div className="divide-y divide-[#eee] max-h-[calc(100vh-280px)] overflow-y-auto">
            {/* Pinned Featured Card: AI Sales Knowledge Feed */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setSelectedKey("ai_sales_agent");
                setNotice(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedKey("ai_sales_agent");
                  setNotice(null);
                }
              }}
              className={`group relative grid w-full cursor-pointer grid-cols-1 gap-2 p-4 text-left transition ${
                isAiAgentSelected
                  ? "bg-[#f4f8ec] shadow-[inset_4px_0_0_#416c17]"
                  : "hover:bg-[#fbfaf6]"
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#416c17] text-white">
                      <Sparkles size={13} />
                    </span>
                    <span className="font-bold text-xs text-[#171914]">
                      AI Sales Agent (Q&A Feed)
                    </span>
                  </div>
                  <span className="rounded-full bg-[#dcf2b9] px-2 py-0.5 text-[10px] font-bold text-[#355b11]">
                    {qaItems.filter((x) => x.isActive).length} active Q&As
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-[#626258] leading-relaxed">
                  Feed custom store Q&A knowledge to train the 24/7 Telegram AI advisor on products, compatibility, PUBG accounts, and policies.
                </p>
                <div className="mt-2 flex items-center justify-between text-[10px] text-[#717169] border-t border-[#dedbd0]/40 pt-1.5 font-medium">
                  <span>Customer Telegram Advisor</span>
                  <span className="text-[#355b11] font-bold">24/7 Live Feed</span>
                </div>
              </div>
            </div>

            {/* Automation Message Templates */}
            {visibleTemplates.map((t) => {
              const isSelected = !isAiAgentSelected && t.key === activeKey;
              const isDirty = drafts[t.key] !== undefined && drafts[t.key] !== t.content;
              const sourceBadge = getSourceBadge(t.triggerSource);

              return (
                <div
                  key={t.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedKey(t.key);
                    setNotice(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedKey(t.key);
                      setNotice(null);
                    }
                  }}
                  className={`group relative grid w-full cursor-pointer grid-cols-1 gap-2 p-4 text-left transition ${
                    isSelected
                      ? "bg-[#f8f6ef] shadow-[inset_4px_0_0_#171813]"
                      : "hover:bg-[#fbfaf6]"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-[#171914]">
                        {t.key}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          t.channel === "staff"
                            ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                            : "bg-[#f1efe8] text-[#55534c]"
                        }`}
                      >
                        {sourceBadge}
                      </span>
                      {t.isCustomized && (
                        <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.2 text-[10px] font-bold text-emerald-800">
                          Customized
                        </span>
                      )}
                      {isDirty && (
                        <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.2 text-[10px] font-bold text-amber-800">
                          Unsaved
                        </span>
                      )}
                    </div>

                    <p className="mt-2 text-sm font-bold text-[#171914]">{t.label}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-[#77776f] leading-relaxed">
                      {drafts[t.key] || t.content}
                    </p>

                    <div className="mt-2.5 flex items-center justify-between text-[10px] text-[#888880] border-t border-[#dedbd0]/40 pt-1.5">
                      <span>{t.channel === "staff" ? "Staff Group" : "Customer DM"}</span>
                      <span>{t.placeholders?.length || 0} tokens</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right Workspace: AI Q&A Feed OR Message Template Editor */}
        <div className="grid gap-4 2xl:grid-cols-2 items-start">
          {isAiAgentSelected ? (
            <div className="card p-5 sm:p-6 space-y-4">
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#dedbd0] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="pill bg-[#f4f8ec] text-[#416c17] font-bold">
                      <Sparkles size={11} className="inline mr-1" />
                      AI Training & Knowledge Feed
                    </span>
                    <span className="pill bg-emerald-50 text-emerald-700">
                      Telegram 24/7 Active
                    </span>
                  </div>
                  <h2 className="display mt-2 text-xl font-bold">
                    Store Knowledge Base (Q&A Feed)
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-[#6f7069]">
                    Feed questions, answers, and store guidelines so your AI Sales Agent provides accurate answers for phone coolers, gaming headsets, PUBG accounts, delivery, and payment.
                  </p>
                </div>

                {!isAddingQa && (
                  <button
                    type="button"
                    onClick={handleStartAddQa}
                    className="flex h-10 items-center gap-1.5 rounded-xl bg-black px-4 text-xs font-bold text-white shadow-sm hover:bg-[#222] transition"
                  >
                    <Plus size={14} /> Add Q&A Data
                  </button>
                )}
              </div>

              {/* Add / Edit Q&A Form Card */}
              {isAddingQa && (
                <div className="rounded-2xl border-2 border-[#171813] bg-[#fbfaf6] p-4 sm:p-5 space-y-3.5 shadow-sm">
                  <div className="flex items-center justify-between border-b border-[#dedbd0] pb-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black text-white text-[11px] font-bold">
                        {editingQaId ? "✎" : "+"}
                      </span>
                      <p className="text-xs font-bold text-[#171813]">
                        {editingQaId ? "Edit Store Q&A Knowledge" : "Feed New Question & Answer"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCancelQaForm}
                      className="text-[#777] hover:text-black"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  {/* Category Selector */}
                  <div>
                    <label className="block text-xs font-bold text-[#171813] mb-1">
                      Knowledge Category
                    </label>
                    <select
                      value={qaFormCategory}
                      onChange={(e) => setQaFormCategory(e.target.value)}
                      className="h-10 w-full rounded-xl border border-[#dedbd0] bg-white px-3 text-xs font-medium text-[#171813] outline-none focus:border-black"
                    >
                      {QA_CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Question Input */}
                  <div>
                    <label className="block text-xs font-bold text-[#171813] mb-1">
                      Customer Question / Inquiry
                    </label>
                    <input
                      value={qaFormQuestion}
                      onChange={(e) => setQaFormQuestion(e.target.value)}
                      placeholder="e.g. iPhone 15 Pro Max အတွက် ဘယ် cooler အဆင်ပြေဆုံးလဲ?"
                      className="h-10 w-full rounded-xl border border-[#dedbd0] bg-white px-3 text-xs text-[#171813] outline-none focus:border-black font-medium"
                    />
                  </div>

                  {/* Answer Textarea */}
                  <div>
                    <label className="block text-xs font-bold text-[#171813] mb-1">
                      Store Knowledge / Official Answer (Burmese or English)
                    </label>
                    <textarea
                      rows={4}
                      value={qaFormAnswer}
                      onChange={(e) => setQaFormAnswer(e.target.value)}
                      placeholder="e.g. iPhone 12 နဲ့အထက်အတွက် MagSafe magnetic cooler ကို တိုက်ရိုက်ကပ်သုံးနိုင်ပါတယ်။ ဂိမ်းဆော့ရင်း အပူချိန် 15-20°C ထိ အမြန်လျှော့ချပေးနိုင်ပါတယ်..."
                      className="w-full rounded-xl border border-[#dedbd0] bg-white p-3 text-xs text-[#171813] outline-none focus:border-black leading-relaxed"
                    />
                    <p className="mt-1 text-[11px] text-[#77776f]">
                      Write clear advice or policy. The AI seamlessly adapts this knowledge during conversations.
                    </p>
                  </div>

                  {/* Form Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      disabled={qaSaving}
                      onClick={handleCancelQaForm}
                      className="h-9 rounded-xl border border-[#dedbd0] bg-white px-3.5 text-xs font-bold text-[#626258] hover:border-black"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={qaSaving || !qaFormQuestion.trim() || !qaFormAnswer.trim()}
                      onClick={handleSaveQa}
                      className="flex h-9 items-center gap-1.5 rounded-xl bg-[#c7f36b] px-4 text-xs font-bold text-[#171914] hover:bg-[#bbf055] shadow-xs disabled:opacity-40"
                    >
                      {qaSaving ? (
                        <>
                          <Loader2 size={13} className="animate-spin" /> Saving...
                        </>
                      ) : (
                        <>
                          <Save size={13} /> {editingQaId ? "Update Q&A" : "Feed to AI"}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Category Filter Pills */}
              <div className="flex max-w-full overflow-x-auto gap-1.5 pb-1">
                <button
                  type="button"
                  onClick={() => setQaCategoryFilter("all")}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                    qaCategoryFilter === "all"
                      ? "bg-black text-white"
                      : "bg-[#f5f4ed] text-[#555] hover:bg-[#eee]"
                  }`}
                >
                  All ({qaItems.length})
                </button>
                {QA_CATEGORIES.map((cat) => {
                  const count = qaItems.filter((x) => x.category === cat.id).length;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setQaCategoryFilter(cat.id)}
                      className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                        qaCategoryFilter === cat.id
                          ? "bg-black text-white"
                          : "bg-[#f5f4ed] text-[#555] hover:bg-[#eee]"
                      }`}
                    >
                      {cat.label} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Q&A List */}
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {filteredQaItems.length ? (
                  filteredQaItems.map((item, idx) => (
                    <article
                      key={item.id}
                      className={`rounded-2xl border p-4 transition ${
                        item.isActive
                          ? "border-[#dedbd0] bg-white shadow-xs hover:border-black"
                          : "border-[#e6e4dc] bg-[#faf9f5] opacity-75"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded bg-[#f0eee6] px-2 py-0.5 text-[10px] font-mono font-bold uppercase text-[#555]">
                            {QA_CATEGORIES.find((c) => c.id === item.category)?.label || item.category}
                          </span>
                          {!item.isActive && (
                            <span className="rounded bg-zinc-200 px-1.5 py-0.2 text-[10px] font-bold text-zinc-600">
                              Inactive
                            </span>
                          )}
                          <span className="text-[10px] text-[#999]">#{idx + 1}</span>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleQaActive(item)}
                            title={item.isActive ? "Deactivate" : "Activate"}
                            className="rounded p-1 text-[#777] hover:text-black transition"
                          >
                            <span className={`text-[10px] font-bold ${item.isActive ? "text-emerald-700" : "text-zinc-500"}`}>
                              {item.isActive ? "Active" : "Off"}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEditQa(item)}
                            className="rounded p-1.5 text-[#666] hover:bg-[#f0eee6] hover:text-black transition"
                            title="Edit Q&A"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteQa(item)}
                            className="rounded p-1.5 text-[#999] hover:bg-red-50 hover:text-red-700 transition"
                            title="Delete Q&A"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Question */}
                      <div className="mt-2 flex items-start gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#171813] text-[10px] font-bold text-white">
                          Q
                        </span>
                        <p className="text-xs font-bold text-[#171914] leading-relaxed">
                          {item.question}
                        </p>
                      </div>

                      {/* Answer */}
                      <div className="mt-2.5 flex items-start gap-2 rounded-xl bg-[#f8f7f1] p-3 text-xs text-[#333] leading-relaxed border border-[#ece9df]">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#9fc744] text-[10px] font-bold text-[#171914]">
                          A
                        </span>
                        <div className="whitespace-pre-wrap">{item.answer}</div>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-[#dedbd0] p-8 text-center text-xs text-[#777]">
                    <HelpCircle size={24} className="mx-auto mb-2 text-[#aaa]" />
                    No Q&A knowledge items found matching your filters.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#dedbd0] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`pill ${
                        isStaffChannel
                          ? "bg-indigo-50 text-indigo-800"
                          : "bg-[#f1efe8] text-[#171813]"
                      }`}
                    >
                      {isStaffChannel ? "Manager Bot" : "Customer Bot"} ·{" "}
                      {getSourceBadge(activeTemplate.triggerSource)}
                    </span>
                    {activeTemplate.isCustomized && (
                      <span className="pill bg-[#effbdd] text-[#406b16]">
                        Customized copy
                      </span>
                    )}
                  </div>
                  <h2 className="display mt-2 text-xl font-bold">{activeTemplate.label}</h2>
                  <p className="mt-1 text-xs leading-5 text-[#6f7069]">
                    {activeTemplate.description}
                  </p>
                </div>
              </div>

              {/* Dynamic Placeholders */}
              {activeTemplate.placeholders && activeTemplate.placeholders.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-bold text-[#171914]">
                    Insert dynamic placeholder tokens:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {activeTemplate.placeholders.map((ph) => (
                      <button
                        key={ph}
                        type="button"
                        onClick={() => insertVariable(ph)}
                        className="rounded-lg border border-[#dedbd0] bg-[#f8f7f1] px-2.5 py-1 text-xs font-mono font-bold text-[#171813] hover:border-black hover:bg-white transition"
                      >
                        + {ph}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-[#77776f]">
                    Clicking a token inserts it at your cursor. Tokens are replaced with actual metrics and data during delivery.
                  </p>
                </div>
              )}

              {/* Textarea */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor={textareaId} className="text-xs font-bold text-[#171914]">
                    Message Template Copy
                  </label>
                  <span
                    className={`text-xs ${
                      draftContent.length > 3500
                        ? "font-bold text-red-600"
                        : "text-[#77776f]"
                    }`}
                  >
                    {draftContent.length} / 4096 characters
                  </span>
                </div>
                <textarea
                  id={textareaId}
                  rows={8}
                  value={draftContent}
                  onChange={(e) => handleDraftChange(e.target.value)}
                  placeholder="Enter message text here..."
                  className="w-full rounded-xl border border-[#dedbd0] bg-white p-4 text-sm text-[#171914] leading-relaxed outline-none focus:border-black transition font-mono"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={handleReset}
                  className="flex h-11 items-center gap-2 rounded-xl border border-[#dedbd0] bg-white px-4 text-xs font-bold text-[#626258] hover:border-black hover:text-[#171813] transition disabled:opacity-40"
                >
                  <RotateCcw size={14} /> Reset to factory default
                </button>

                <button
                  type="button"
                  disabled={pending || draftContent.trim() === activeTemplate.content.trim()}
                  onClick={handleSave}
                  className="flex h-11 items-center gap-2 rounded-xl bg-[#c7f36b] px-6 text-xs font-bold text-[#171914] hover:bg-[#bbf055] shadow-sm transition disabled:opacity-40"
                >
                  <Save size={14} /> {pending ? "Saving..." : "Save Template"}
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* RIGHT PANE: TELEGRAM LIVE SIMULATOR / PREVIEW                  */}
          {/* ============================================================== */}
          <div className="card p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#dedbd0] pb-3">
              <div>
                <p className="eyebrow">
                  {isAiAgentSelected
                    ? "AI Sales Advisor · Playground"
                    : isStaffChannel
                    ? "Manager chat simulation"
                    : "Customer simulation"}
                </p>
                <h3 className="display text-base font-bold">
                  {isAiAgentSelected ? "Interactive AI Test Chat" : "Telegram Preview"}
                </h3>
              </div>
              <span className="pill bg-[#effbdd] text-[#406b16] text-[10px]">
                {isAiAgentSelected ? "Live simulator" : "Live preview"}
              </span>
            </div>

            {/* Telegram Window */}
            <div className="rounded-2xl border border-[#dedbd0] bg-[#efeae2] p-4 shadow-[inset_1px_1px_4px_rgba(0,0,0,0.06)]">
              {/* Bot Profile Header */}
              <div className="mb-3 flex items-center justify-between border-b border-[#dedbd0]/80 pb-2.5">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-white shadow-xs ${
                      isAiAgentSelected
                        ? "bg-gradient-to-tr from-[#0088cc] to-[#34c759]"
                        : isStaffChannel
                        ? "bg-[#7047eb]"
                        : "bg-[#2aabee]"
                    }`}
                  >
                    {isAiAgentSelected ? (
                      <Wand2 size={17} />
                    ) : isStaffChannel ? (
                      <Users size={18} />
                    ) : (
                      <Bot size={18} />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#171914]">
                      {isAiAgentSelected
                        ? "MH OP 24/7 AI Sales Advisor"
                        : isStaffChannel
                        ? "MH OP Operations Bot"
                        : "MH OP Customer Bot"}
                    </p>
                    <p
                      className={`text-[10px] font-medium ${
                        isAiAgentSelected
                          ? "text-emerald-700"
                          : isStaffChannel
                          ? "text-indigo-700"
                          : "text-emerald-700"
                      }`}
                    >
                      {isAiAgentSelected
                        ? "Trained on live Q&A · Online"
                        : isStaffChannel
                        ? "staff group · TELEGRAM_STAFF_CHAT_ID"
                        : "bot · customer DM"}
                    </p>
                  </div>
                </div>
                <span className="pill bg-white text-[#77776f] text-[10px]">
                  {isAiAgentSelected
                    ? "Interactive mode"
                    : isStaffChannel
                    ? "Staff group view"
                    : "Customer view"}
                </span>
              </div>

              {/* AI Interactive Chat or Static Message Bubble */}
              {isAiAgentSelected ? (
                <div className="space-y-3">
                  {/* Chat Messages Log */}
                  <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                    {testChat.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[88%] rounded-2xl p-3 text-xs leading-relaxed shadow-xs ${
                            msg.role === "user"
                              ? "rounded-tr-xs bg-[#e1ffc7] text-[#171914] border border-[#d2f3b3]"
                              : "rounded-tl-xs bg-white text-[#171914] border border-[#e2ded5]"
                          }`}
                        >
                          <div className="whitespace-pre-wrap break-words">{msg.text}</div>
                          <div className="mt-1.5 flex items-center justify-between gap-2 text-[9px] text-[#888]">
                            {msg.mode && (
                              <span
                                className={`font-mono font-bold ${
                                  msg.mode === "openai" ? "text-emerald-600" : "text-sky-600"
                                }`}
                              >
                                {msg.mode === "openai" ? "OpenAI Engine" : "Live Q&A / Catalog"}
                              </span>
                            )}
                            <span className="ml-auto">Just now</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {testLoading && (
                      <div className="flex justify-start">
                        <div className="rounded-2xl rounded-tl-xs bg-white p-3 text-xs text-[#666] border border-[#e2ded5] shadow-xs flex items-center gap-2">
                          <Loader2 size={13} className="animate-spin text-[#0088cc]" />
                          <span>AI is matching store Q&A & crafting reply...</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quick Test Prompt Pills (Derived from Fed Q&A) */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#77776f] mb-1.5">
                      Test Fed Q&A Questions:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {qaItems.slice(0, 5).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          disabled={testLoading}
                          onClick={() => handleTestSubmit(item.question)}
                          className="rounded-lg border border-[#dedbd0] bg-white px-2 py-1 text-[11px] font-medium text-[#171813] hover:border-black hover:bg-[#fbfaf6] transition disabled:opacity-40 max-w-[240px] truncate"
                          title={item.question}
                        >
                          {item.question}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Chat Input Bar */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleTestSubmit();
                    }}
                    className="flex items-center gap-2 pt-1 border-t border-[#dedbd0]/60"
                  >
                    <input
                      value={testQuestion}
                      onChange={(e) => setTestQuestion(e.target.value)}
                      placeholder="Ask any question to test AI with your fed data..."
                      disabled={testLoading}
                      className="h-10 flex-1 rounded-xl border border-[#dedbd0] bg-white px-3 text-xs text-[#171914] outline-none focus:border-black"
                    />
                    <button
                      type="submit"
                      disabled={testLoading || !testQuestion.trim()}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0088cc] text-white shadow-xs hover:bg-[#0077b5] transition disabled:opacity-40"
                    >
                      {testLoading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Send size={14} />
                      )}
                    </button>
                  </form>
                </div>
              ) : (
                /* Standard Telegram Message Bubble */
                <div className="max-w-[92%] sm:max-w-[88%] rounded-2xl rounded-tl-xs bg-white p-4 shadow-sm border border-[#e2ded5] text-sm text-[#171914] leading-relaxed">
                  <div className="whitespace-pre-wrap break-words">{previewText}</div>
                  <div className="mt-2.5 flex items-center justify-end gap-1 text-[10px] text-[#999]">
                    <span>12:45 PM</span>
                    <span className="flex items-center text-[#2aabee]">
                      <Check size={11} className="-mr-1.5" />
                      <Check size={11} />
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Operational Guide Note */}
            <div className="rounded-xl border border-[#dedbd0] bg-[#f8f7f1] p-3.5 text-xs text-[#6f7069] space-y-1.5">
              <p className="font-bold text-[#171914] flex items-center gap-1.5">
                <Sparkles size={13} className="text-[#9fc744]" />
                {isAiAgentSelected
                  ? "Directly Trained on Your Q&A Feed"
                  : isStaffChannel
                  ? "Delivered to Manager Telegram Group"
                  : "Delivered to Customer Direct Messages"}
              </p>
              <p>
                {isAiAgentSelected
                  ? "Every question and answer you feed into this knowledge base is instantly accessible by the 24/7 AI Sales Agent. It guides buyers on product recommendations, device compatibility, PUBG account handover, and policies."
                  : isStaffChannel
                  ? "Sent by n8n scheduled tasks and store event webhooks to your staff Telegram channel (TELEGRAM_STAFF_CHAT_ID)."
                  : "Sent by the customer sales bot and n8n recovery flows directly to individual Telegram buyers."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
