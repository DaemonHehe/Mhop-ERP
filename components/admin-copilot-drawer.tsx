"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import {
  Sparkles,
  Send,
  X,
  Key,
  Settings2,
  Check,
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Trash2,
  Loader2,
  Database,
  ChevronDown,
  ChevronUp,
  Package,
  TrendingUp,
  ShieldCheck,
  Users,
  AlertTriangle,
} from "lucide-react";
import {
  askAdminCopilotAction,
  getAiConfigAction,
  saveAiKeyAction,
  testAiKeyAction,
} from "@/app/actions/copilot";
import type { CopilotToolCall } from "@/lib/ai/admin-copilot";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: "gemini" | "pattern_fallback";
  model?: string;
  toolCalls?: CopilotToolCall[];
  timestamp: string;
}

const QUICK_PROMPTS = [
  {
    icon: Package,
    label: "Pending Orders",
    prompt: "Show latest orders waiting for payment verification or dispatch",
  },
  {
    icon: AlertTriangle,
    label: "Low Stock Items",
    prompt: "Show products with low stock or out of stock in warehouse",
  },
  {
    icon: TrendingUp,
    label: "Today's Revenue",
    prompt: "What is today's verified revenue and pending slips count?",
  },
  {
    icon: ShieldCheck,
    label: "Warranty Lookup",
    prompt: "How to check warranty coverage for an order or customer phone?",
  },
  {
    icon: Users,
    label: "Top Customers",
    prompt: "Who are our top customers by lifetime spend?",
  },
];

const MODEL_OPTIONS = [
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash (Recommended - fast & smart)" },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
  { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro (Deep reasoning)" },
];

export function AdminCopilotDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();

  // BYOK Settings State
  const [isConfigured, setIsConfigured] = useState(false);
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState("gemini-2.5-flash");
  const [inputKey, setInputKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [showKeyText, setShowKeyText] = useState(false);
  const [testStatus, setTestStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [testMessage, setTestMessage] = useState("");
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>(
    {},
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load configuration on mount
  useEffect(() => {
    getAiConfigAction().then((res) => {
      if (res.ok && res.data) {
        setIsConfigured(res.data.isConfigured);
        setMaskedKey(res.data.maskedKey);
        if (res.data.model) {
          setActiveModel(res.data.model);
          setSelectedModel(res.data.model);
        }
      }
    });
  }, []);

  // Global Ctrl+J / Cmd+J shortcut listener & custom window events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    const handleOpen = () => setIsOpen(true);
    const handleClose = () => setIsOpen(false);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-admin-copilot", handleOpen);
    window.addEventListener("close-admin-copilot", handleClose);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-admin-copilot", handleOpen);
      window.removeEventListener("close-admin-copilot", handleClose);
    };
  }, []);

  // Auto-scroll on new messages & focus input on open
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

  const handleSendMessage = (textToSend?: string) => {
    const query = (textToSend ?? input).trim();
    if (!query || isPending) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    startTransition(async () => {
      const history = messages.slice(-4).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await askAdminCopilotAction({
        question: query,
        history,
      });

      if (res.ok && res.data) {
        const assistantMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          role: "assistant",
          content: res.data.answer,
          mode: res.data.mode,
          model: res.data.model,
          toolCalls: res.data.toolCalls,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `⚠️ Error: ${res.error || "Unable to reach AI copilot"}`,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    });
  };

  const handleTestKey = async () => {
    const key = inputKey.trim();
    if (!key) {
      setTestStatus("error");
      setTestMessage("Please enter an API key to test");
      return;
    }

    setTestStatus("testing");
    setTestMessage("");

    const res = await testAiKeyAction({
      apiKey: key,
      model: selectedModel,
    });

    if (res.ok) {
      setTestStatus("success");
      setTestMessage(
        `Connected to Gemini! Test response: "${res.sampleResponse || "OK"}"`,
      );
    } else {
      setTestStatus("error");
      setTestMessage(res.error || "Connection failed. Please check key.");
    }
  };

  const handleSaveKey = async () => {
    const key = inputKey.trim();
    if (!key) return;

    setSaveStatus("saving");
    const res = await saveAiKeyAction({
      apiKey: key,
      model: selectedModel,
    });

    if (res.ok && res.data) {
      setSaveStatus("success");
      setIsConfigured(true);
      setMaskedKey(res.data.maskedKey);
      setActiveModel(res.data.model);
      setInputKey("");
      setTimeout(() => {
        setSaveStatus("idle");
        setShowSettings(false);
      }, 1200);
    } else {
      setSaveStatus("error");
      setTestMessage(res.error || "Failed to save key");
    }
  };

  // Helper to render text with clickable order code pills
  const renderMessageContent = (content: string) => {
    // Matches order codes like MHOP-260906-AB12
    const parts = content.split(/(`?MHOP-[A-Za-z0-9_-]+`?)/g);

    return (
      <div className="space-y-2 whitespace-pre-wrap text-sm leading-relaxed">
        {parts.map((part, idx) => {
          const clean = part.replace(/`/g, "").trim();
          if (/^MHOP-[A-Za-z0-9_-]+$/i.test(clean)) {
            return (
              <Link
                key={idx}
                href="/orders"
                className="inline-flex items-center gap-1 mx-1 rounded-md bg-purple-100 dark:bg-purple-950/60 px-2 py-0.5 font-mono text-xs font-semibold text-purple-700 dark:text-purple-300 hover:underline hover:bg-purple-200"
                title="View order in Orders page"
              >
                <span>{clean}</span>
                <ExternalLink size={10} />
              </Link>
            );
          }
          return <span key={idx}>{part}</span>;
        })}
      </div>
    );
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop for Mobile */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity lg:hidden"
        onClick={() => setIsOpen(false)}
      />

      {/* Slide-over Drawer */}
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white dark:bg-zinc-950 shadow-2xl border-l border-zinc-200 dark:border-zinc-800 transition-transform duration-300 animate-in slide-in-from-right"
        role="dialog"
        aria-label="Admin AI Copilot"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white shadow-md">
              <Sparkles size={18} className="animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                  MH OP AI Copilot
                </h3>
                <span className="rounded-full bg-purple-100 dark:bg-purple-950/60 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:text-purple-300">
                  Internal Only
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                Real-time store data • Myanmar & English
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* BYOK Status / Settings Button */}
            <button
              type="button"
              onClick={() => setShowSettings((prev) => !prev)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                isConfigured
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
                  : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100"
              }`}
              title="Configure Google Gemini API Key (BYOK)"
            >
              {isConfigured ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="hidden sm:inline font-mono text-[11px]">
                    {activeModel}
                  </span>
                  <Settings2 size={13} className="ml-0.5" />
                </>
              ) : (
                <>
                  <Key size={13} className="text-amber-600" />
                  <span>Set Gemini Key</span>
                </>
              )}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Close copilot"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* BYOK Settings Drawer Section */}
        {showSettings && (
          <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/90 p-4 space-y-3.5 text-xs animate-in fade-in slide-in-from-top-2">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Key size={14} className="text-purple-600" />
                  Bring Your Own Key (BYOK)
                </h4>
                <p className="text-zinc-500 dark:text-zinc-400 text-[11px] mt-0.5">
                  Store admins can supply or rotate their Google Gemini API key directly. Handover ready.
                </p>
              </div>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:underline"
              >
                <span>Get Free Key</span>
                <ExternalLink size={10} />
              </a>
            </div>

            {maskedKey && (
              <div className="rounded-lg bg-white dark:bg-zinc-800/80 p-2 border border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Check size={14} className="text-emerald-500 shrink-0" />
                  <span className="text-zinc-600 dark:text-zinc-300 font-mono truncate text-[11px]">
                    Current: {maskedKey}
                  </span>
                </div>
                <span className="text-[10px] text-zinc-400 font-mono shrink-0">
                  {activeModel}
                </span>
              </div>
            )}

            <div className="space-y-2">
              <label className="block font-medium text-zinc-700 dark:text-zinc-300">
                Google Gemini API Key
              </label>
              <div className="relative">
                <input
                  type={showKeyText ? "text" : "password"}
                  value={inputKey}
                  onChange={(e) => {
                    setInputKey(e.target.value);
                    setTestStatus("idle");
                    setTestMessage("");
                  }}
                  placeholder="Paste AIzaSy... key here"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs font-mono pr-9 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
                <button
                  type="button"
                  onClick={() => setShowKeyText((p) => !p)}
                  className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  {showKeyText ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block font-medium text-zinc-700 dark:text-zinc-300">
                Model Preference
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-xs focus:outline-hidden focus:ring-2 focus:ring-purple-500"
              >
                {MODEL_OPTIONS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {testMessage && (
              <div
                className={`p-2 rounded-lg text-[11px] flex items-start gap-1.5 ${
                  testStatus === "success"
                    ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                    : "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                }`}
              >
                {testStatus === "success" ? (
                  <Check size={14} className="shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                )}
                <span>{testMessage}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleTestKey}
                disabled={testStatus === "testing" || !inputKey.trim()}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50"
              >
                {testStatus === "testing" ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 size={12} className="animate-spin" />
                    Testing...
                  </span>
                ) : (
                  "Test Key"
                )}
              </button>

              <button
                type="button"
                onClick={handleSaveKey}
                disabled={saveStatus === "saving" || !inputKey.trim()}
                className="rounded-lg bg-purple-600 px-3.5 py-1.5 font-medium text-white hover:bg-purple-700 disabled:opacity-50 shadow-sm"
              >
                {saveStatus === "saving" ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 size={12} className="animate-spin" />
                    Saving...
                  </span>
                ) : saveStatus === "success" ? (
                  <span className="flex items-center gap-1.5">
                    <Check size={12} />
                    Saved!
                  </span>
                ) : (
                  "Save Configuration"
                )}
              </button>
            </div>
          </div>
        )}

        {/* Chat Messages Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col justify-between py-2">
              <div className="space-y-3 text-center pt-4">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/60 shadow-sm">
                  <Sparkles size={24} />
                </div>
                <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Welcome to MH OP Admin Copilot
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                  Ask about internal store data in <b>Burmese</b> or <b>English</b>.
                  Orders, customer profiles, warranty validity, and warehouse inventory levels.
                </p>
              </div>

              {/* Quick Prompts */}
              <div className="space-y-2 pt-6">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Suggested Questions
                </p>
                <div className="flex flex-col gap-1.5">
                  {QUICK_PROMPTS.map((qp, idx) => {
                    const Icon = qp.icon;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSendMessage(qp.prompt)}
                        className="flex items-center gap-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/60 p-2.5 text-left text-xs text-zinc-800 dark:text-zinc-200 hover:bg-purple-50 dark:hover:bg-purple-950/30 hover:border-purple-300 dark:hover:border-purple-800 transition-all"
                      >
                        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-xs">
                          <Icon size={14} />
                        </div>
                        <span className="truncate">{qp.prompt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${
                    m.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl p-3.5 shadow-xs ${
                      m.role === "user"
                        ? "bg-purple-600 text-white rounded-br-xs"
                        : "bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-bl-xs border border-zinc-200 dark:border-zinc-800"
                    }`}
                  >
                    {m.role === "user" ? (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {m.content}
                      </p>
                    ) : (
                      renderMessageContent(m.content)
                    )}

                    {/* Metadata & Tool Calls for Assistant */}
                    {m.role === "assistant" && (
                      <div className="mt-3 pt-2.5 border-t border-zinc-200/60 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-1 text-[10px] text-zinc-400">
                        <span className="font-mono flex items-center gap-1">
                          {m.mode === "gemini" ? (
                            <>
                              <Sparkles size={10} className="text-purple-500" />
                              <span>{m.model || "gemini-2.5-flash"}</span>
                            </>
                          ) : (
                            <>
                              <Database size={10} className="text-amber-500" />
                              <span>Internal Database Engine</span>
                            </>
                          )}
                        </span>

                        {m.toolCalls && m.toolCalls.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedTools((prev) => ({
                                ...prev,
                                [m.id]: !prev[m.id],
                              }))
                            }
                            className="inline-flex items-center gap-0.5 hover:text-zinc-600 dark:hover:text-zinc-200 underline font-mono"
                          >
                            <span>{m.toolCalls.length} tool(s) queried</span>
                            {expandedTools[m.id] ? (
                              <ChevronUp size={10} />
                            ) : (
                              <ChevronDown size={10} />
                            )}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Collapsible Tool Call Inspector */}
                    {m.role === "assistant" &&
                      expandedTools[m.id] &&
                      m.toolCalls && (
                        <div className="mt-2 space-y-1 rounded-lg bg-zinc-200/70 dark:bg-zinc-950 p-2 font-mono text-[11px] text-zinc-600 dark:text-zinc-300">
                          {m.toolCalls.map((tc, idx) => (
                            <div key={idx} className="space-y-0.5">
                              <p className="font-bold text-purple-600 dark:text-purple-400">
                                🔧 {tc.name}
                              </p>
                              <pre className="overflow-x-auto text-[10px] text-zinc-500 dark:text-zinc-400">
                                {JSON.stringify(tc.args)}
                              </pre>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                  <span className="text-[10px] text-zinc-400 mt-1 px-1">
                    {m.timestamp}
                  </span>
                </div>
              ))}

              {isPending && (
                <div className="flex items-center gap-2 text-xs text-zinc-400 p-2">
                  <Loader2 size={14} className="animate-spin text-purple-500" />
                  <span>Searching internal database...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Bar */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50/90 dark:bg-zinc-900/90 backdrop-blur-sm">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setMessages([])}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                title="Clear chat history"
              >
                <Trash2 size={15} />
              </button>
            )}

            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask in Burmese or English... (e.g. MHOP-... status, low stock)"
              disabled={isPending}
              className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
            />

            <button
              type="submit"
              disabled={!input.trim() || isPending}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 transition-colors shadow-sm"
              title="Send message"
            >
              <Send size={15} />
            </button>
          </form>
          <p className="mt-1 text-center text-[10px] text-zinc-400">
            Press <kbd className="font-mono">Ctrl+J</kbd> anytime to toggle • Strictly internal data
          </p>
        </div>
      </aside>
    </>
  );
}
