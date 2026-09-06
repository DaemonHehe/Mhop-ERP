"use client";

import { useState, useEffect, useRef, useTransition, useCallback } from "react";
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
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Square,
  Globe,
  Minus,
} from "lucide-react";
import {
  askAdminCopilotAction,
  getAiConfigAction,
  saveAiKeyAction,
  testAiKeyAction,
  saveOpenRouterKeyAction,
  testOpenRouterKeyAction,
} from "@/app/actions/copilot";
import type { CopilotToolCall } from "@/lib/ai/admin-copilot";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: "gemini" | "openrouter" | "pattern_fallback";
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

const GEMINI_MODELS = [
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash (Recommended - fast & smart)" },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
  { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro (Deep reasoning)" },
];

const OPENROUTER_MODELS = [
  { id: "google/gemma-4-31b-it:free", name: "Google Gemma 4 31B (Free - Multilingual & Burmese)" },
  { id: "google/gemma-4-26b-a4b-it:free", name: "Google Gemma 4 26B (Free)" },
  { id: "google/gemini-2.5-flash", name: "Google Gemini 2.5 Flash" },
  { id: "google/gemini-2.5-flash-lite", name: "Google Gemini 2.5 Flash Lite" },
  { id: "minimax/minimax-m2.7:free", name: "MiniMax M2.7 (Free)" },
];

function cleanMarkdownForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#*_~•-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((err: { error?: string; message?: string }) => void) | null;
  onend: (() => void) | null;
}

export function AdminCopilotDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"gemini" | "openrouter">("gemini");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();

  // Voice Chat & Microphone State
  const [isListening, setIsListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState<"my-MM" | "en-US">("my-MM");
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // BYOK Settings State
  const [geminiConfigured, setGeminiConfigured] = useState(false);
  const [geminiMaskedKey, setGeminiMaskedKey] = useState<string | null>(null);
  const [geminiActiveModel, setGeminiActiveModel] = useState("gemini-2.5-flash");
  const [geminiInputKey, setGeminiInputKey] = useState("");
  const [geminiSelectedModel, setGeminiSelectedModel] = useState("gemini-2.5-flash");

  const [openRouterConfigured, setOpenRouterConfigured] = useState(false);
  const [openRouterMaskedKey, setOpenRouterMaskedKey] = useState<string | null>(null);
  const [openRouterActiveModel, setOpenRouterActiveModel] = useState("google/gemma-4-31b-it:free");
  const [openRouterInputKey, setOpenRouterInputKey] = useState("");
  const [openRouterSelectedModel, setOpenRouterSelectedModel] = useState("google/gemma-4-31b-it:free");

  const [showKeyText, setShowKeyText] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refreshConfig = async () => {
    const res = await getAiConfigAction();
    if (res.ok && res.data) {
      if (res.data.gemini) {
        setGeminiConfigured(res.data.gemini.isConfigured);
        setGeminiMaskedKey(res.data.gemini.maskedKey);
        if (res.data.gemini.model) {
          setGeminiActiveModel(res.data.gemini.model);
          setGeminiSelectedModel(res.data.gemini.model);
        }
      }
      if (res.data.openrouter) {
        setOpenRouterConfigured(res.data.openrouter.isConfigured);
        setOpenRouterMaskedKey(res.data.openrouter.maskedKey);
        if (res.data.openrouter.model) {
          setOpenRouterActiveModel(res.data.openrouter.model);
          setOpenRouterSelectedModel(res.data.openrouter.model);
        }
      }
    }
  };

  useEffect(() => {
    refreshConfig();
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

  // Speech & Audio cleanup helpers
  const cleanupAudioAnalyser = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingId(null);
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    cleanupAudioAnalyser();
    setIsListening(false);
  }, [cleanupAudioAnalyser]);

  // Auto-scroll on new messages & focus input on open
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      stopSpeaking();
      stopListening();
    }
  }, [isOpen, messages, stopSpeaking, stopListening]);

  const speakText = (text: string, msgId?: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    stopSpeaking();
    const cleanText = cleanMarkdownForSpeech(text);
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const isBurmese = /[\u1000-\u109f]/.test(text);

    utterance.lang = isBurmese ? "my-MM" : "en-US";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const matchedVoice = voices.find((v) =>
      isBurmese
        ? v.lang.toLowerCase().startsWith("my") || v.name.toLowerCase().includes("burmese")
        : v.lang.toLowerCase().startsWith("en"),
    );
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(msgId || "active");
    window.speechSynthesis.speak(utterance);
  };

  // ---------------------------------------------------------------------------
  // Robust Microphone & Voice Input Engine
  // ---------------------------------------------------------------------------

  const startListening = async () => {
    if (typeof window === "undefined") return;

    setMicError(null);
    stopSpeaking();

    // Check secure context
    if (!window.isSecureContext && window.location.hostname !== "localhost") {
      setMicError("Microphone access requires HTTPS or localhost.");
      return;
    }

    const windowWithSpeech = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };

    const SpeechRecognitionClass =
      windowWithSpeech.SpeechRecognition ||
      windowWithSpeech.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setMicError(
        "Speech recognition is supported in Google Chrome, Microsoft Edge, and modern Android/Chromium browsers.",
      );
      return;
    }

    // Step 1: Explicitly request microphone stream from user
    let stream: MediaStream | null = null;
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;

        // Start Web Audio analyser for live voice wave visualization
        const AudioCtx = windowWithSpeech.AudioContext || windowWithSpeech.webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateAudioLevel = () => {
            if (!mediaStreamRef.current) return;
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
            animFrameRef.current = requestAnimationFrame(updateAudioLevel);
          };
          updateAudioLevel();
        }
      }
    } catch (err: unknown) {
      console.warn("[Microphone permission error]", err);
      const errName = (err as Error)?.name || "";
      if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
        setMicError(
          "Microphone permission blocked. Click the lock 🔒 in your browser address bar to allow microphone access.",
        );
      } else if (errName === "NotFoundError" || errName === "DevicesNotFoundError") {
        setMicError("No microphone found on your device.");
      } else {
        setMicError("Could not access microphone. Please check browser permissions.");
      }
      return;
    }

    // Step 2: Start SpeechRecognition
    try {
      const recognition = new SpeechRecognitionClass();
      recognition.lang = voiceLang;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.continuous = true;

      recognition.onstart = () => {
        setIsListening(true);
        setMicError(null);
      };

      recognition.onresult = (event: {
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
      }) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          if (event.results[i]?.[0]?.transcript) {
            transcript += event.results[i][0].transcript;
          }
        }
        if (transcript) {
          setInput(transcript);
        }
      };

      recognition.onerror = (event: { error?: string; message?: string }) => {
        console.warn("[SpeechRecognition error event]", event);
        if (event.error === "no-speech") {
          // Normal timeout if user paused, keep listening or gracefully stop
          return;
        }
        if (event.error === "not-allowed") {
          setMicError(
            "Microphone permission blocked. Please allow mic access in your browser bar 🔒.",
          );
        } else if (event.error === "audio-capture") {
          setMicError("No microphone found or audio capture failed.");
        } else if (event.error === "network") {
          setMicError("Network issue during speech recognition.");
        }
        stopListening();
      };

      recognition.onend = () => {
        setIsListening(false);
        cleanupAudioAnalyser();
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: unknown) {
      console.error("[startListening init error]", err);
      setMicError("Speech recognition failed to initialize.");
      stopListening();
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleSendMessage = (textToSend?: string) => {
    const query = (textToSend ?? input).trim();
    if (!query || isPending) return;

    stopSpeaking();
    stopListening();

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

        if (autoSpeak) {
          setTimeout(() => speakText(res.data.answer, assistantMsg.id), 100);
        }
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
    setTestStatus("testing");
    setTestMessage("");

    if (settingsTab === "gemini") {
      const key = geminiInputKey.trim();
      if (!key) {
        setTestStatus("error");
        setTestMessage("Enter a Google Gemini API key to test");
        return;
      }
      const res = await testAiKeyAction({ apiKey: key, model: geminiSelectedModel });
      if (res.ok) {
        setTestStatus("success");
        setTestMessage(`Connected to Google Gemini! Response: "${res.sampleResponse || "OK"}"`);
      } else {
        setTestStatus("error");
        setTestMessage(res.error || "Connection failed. Please check key.");
      }
    } else {
      const key = openRouterInputKey.trim();
      if (!key) {
        setTestStatus("error");
        setTestMessage("Enter an OpenRouter API key to test");
        return;
      }
      const res = await testOpenRouterKeyAction({ apiKey: key, model: openRouterSelectedModel });
      if (res.ok) {
        setTestStatus("success");
        setTestMessage(`Connected to OpenRouter (${openRouterSelectedModel})! Response: "${res.sampleResponse || "OK"}"`);
      } else {
        setTestStatus("error");
        setTestMessage(res.error || "Connection failed. Please check key.");
      }
    }
  };

  const handleSaveKey = async () => {
    setSaveStatus("saving");

    if (settingsTab === "gemini") {
      const key = geminiInputKey.trim();
      if (!key) return;
      const res = await saveAiKeyAction({ apiKey: key, model: geminiSelectedModel });
      if (res.ok && res.data) {
        setSaveStatus("success");
        setGeminiConfigured(true);
        setGeminiMaskedKey(res.data.maskedKey);
        setGeminiActiveModel(res.data.model);
        setGeminiInputKey("");
        setTimeout(() => {
          setSaveStatus("idle");
          setShowSettings(false);
        }, 1200);
      } else {
        setSaveStatus("error");
        setTestMessage(res.error || "Failed to save key");
      }
    } else {
      const key = openRouterInputKey.trim();
      if (!key) return;
      const res = await saveOpenRouterKeyAction({ apiKey: key, model: openRouterSelectedModel });
      if (res.ok && res.data) {
        setSaveStatus("success");
        setOpenRouterConfigured(true);
        setOpenRouterMaskedKey(res.data.maskedKey);
        setOpenRouterActiveModel(res.data.model);
        setOpenRouterInputKey("");
        setTimeout(() => {
          setSaveStatus("idle");
          setShowSettings(false);
        }, 1200);
      } else {
        setSaveStatus("error");
        setTestMessage(res.error || "Failed to save key");
      }
    }
  };

  const renderMessageContent = (content: string) => {
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
                className="inline-flex items-center gap-1 mx-1 rounded-md bg-purple-500/20 px-2 py-0.5 font-mono text-xs font-semibold text-purple-300 hover:underline hover:bg-purple-500/30"
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

  const hasAnyKey = geminiConfigured || openRouterConfigured;

  return (
    <>
      {/* ----------------------------------------------------------------- */}
      {/* RESTING STATE: iOS / Binance Floating AI Dot                      */}
      {/* ----------------------------------------------------------------- */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 group flex h-13 w-13 items-center justify-center rounded-full bg-zinc-950/85 backdrop-blur-2xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_24px_rgba(147,51,234,0.35)] hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer"
          aria-label="Open AI Copilot (Ctrl+J)"
          title="Open MH OP AI Copilot (Ctrl+J)"
        >
          {/* Animated glowing halo (Binance AI / Siri Orb style) */}
          <span className="absolute -inset-1 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-500 to-cyan-400 opacity-60 blur-xs group-hover:opacity-100 transition-opacity animate-pulse" />
          
          {/* Inner dark glass disc */}
          <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-zinc-950/90 border border-white/15">
            {/* Pulsing AI core dot */}
            <span className="h-5 w-5 rounded-full bg-gradient-to-tr from-purple-500 via-indigo-400 to-cyan-300 shadow-[0_0_14px_rgba(168,85,247,0.9)] animate-pulse" />
            <span className="absolute h-2 w-2 rounded-full bg-white/90 blur-[0.5px]" />
          </span>

          {/* iOS-style Tooltip on hover */}
          <span className="pointer-events-none absolute right-16 hidden rounded-xl bg-zinc-900/95 backdrop-blur-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-white whitespace-nowrap shadow-xl group-hover:block transition-all animate-in fade-in slide-in-from-right-2">
            Ask AI Copilot • <span className="font-mono text-purple-400">Ctrl+J</span>
          </span>
        </button>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* EXPANDED STATE: iOS / Binance Floating AI Card Window             */}
      {/* ----------------------------------------------------------------- */}
      {isOpen && (
        <aside
          className="fixed bottom-6 right-6 z-50 flex w-[430px] max-w-[calc(100vw-32px)] h-[640px] max-h-[calc(100vh-48px)] flex-col rounded-[28px] bg-zinc-950/95 backdrop-blur-2xl border border-white/15 shadow-[0_24px_80px_rgba(0,0,0,0.7),0_0_40px_rgba(139,92,246,0.18)] text-white overflow-hidden transition-all animate-in zoom-in-95 fade-in duration-200"
          role="dialog"
          aria-label="Admin AI Copilot"
        >
          {/* iOS / Binance Topbar */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 bg-white/[0.03] backdrop-blur-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Binance / iOS animated mini AI orb */}
              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 border border-white/15">
                <span className="h-4 w-4 rounded-full bg-gradient-to-tr from-purple-500 via-indigo-400 to-cyan-300 shadow-[0_0_10px_rgba(168,85,247,0.9)] animate-pulse" />
                <span className="absolute h-1.5 w-1.5 rounded-full bg-white/95" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white truncate">
                    MH OP AI
                  </h3>
                  <span className="rounded-full bg-purple-500/20 border border-purple-500/30 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
                    Voice & Data
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 truncate">
                  Burmese Voice • Gemini & OpenRouter
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Auto-Speak Voice Toggle */}
              <button
                type="button"
                onClick={() => {
                  if (autoSpeak) stopSpeaking();
                  setAutoSpeak((prev) => !prev);
                }}
                className={`grid h-8 w-8 place-items-center rounded-xl transition-colors ${
                  autoSpeak
                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                    : "text-zinc-400 hover:bg-white/10"
                }`}
                title={autoSpeak ? "Auto-speak voice replies: ON" : "Auto-speak voice replies: OFF"}
              >
                {autoSpeak ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </button>

              {/* BYOK Settings Gear */}
              <button
                type="button"
                onClick={() => setShowSettings((prev) => !prev)}
                className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  hasAnyKey
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"
                    : "bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25"
                }`}
                title="Configure Gemini & OpenRouter API Keys (BYOK)"
              >
                {hasAnyKey ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-mono text-[10px]">
                      {geminiConfigured ? "Gemini" : "OpenRouter"}
                    </span>
                    <Settings2 size={12} className="ml-0.5" />
                  </>
                ) : (
                  <>
                    <Key size={12} className="text-amber-400" />
                    <span className="text-[11px]">Set Keys</span>
                  </>
                )}
              </button>

              {/* Minimize to Small Dot */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-xl text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
                title="Minimize to iOS floating dot"
                aria-label="Minimize"
              >
                <Minus size={16} />
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => {
                  stopSpeaking();
                  stopListening();
                  setIsOpen(false);
                }}
                className="grid h-8 w-8 place-items-center rounded-xl text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* BYOK Settings Overlay */}
          {showSettings && (
            <div className="border-b border-white/10 bg-zinc-900/90 p-4 space-y-3 text-xs animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-white flex items-center gap-1.5">
                    <Key size={13} className="text-purple-400" />
                    Bring Your Own Key (BYOK)
                  </h4>
                  <p className="text-zinc-400 text-[11px] mt-0.5">
                    Supply your Google Gemini (Primary) or OpenRouter (Fallback) key.
                  </p>
                </div>
              </div>

              {/* Provider Tabs */}
              <div className="flex items-center gap-1 rounded-xl bg-zinc-800/80 p-1 border border-white/5">
                <button
                  type="button"
                  onClick={() => {
                    setSettingsTab("gemini");
                    setTestStatus("idle");
                    setTestMessage("");
                  }}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                    settingsTab === "gemini"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Google Gemini (Primary)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSettingsTab("openrouter");
                    setTestStatus("idle");
                    setTestMessage("");
                  }}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                    settingsTab === "openrouter"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  OpenRouter (Fallback)
                </button>
              </div>

              {settingsTab === "gemini" ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400">Free Google AI Studio Key:</span>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-purple-400 hover:underline"
                    >
                      <span>Get Key</span>
                      <ExternalLink size={10} />
                    </a>
                  </div>

                  {geminiMaskedKey && (
                    <div className="rounded-lg bg-zinc-800/60 p-2 border border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Check size={13} className="text-emerald-400 shrink-0" />
                        <span className="text-zinc-300 font-mono truncate text-[11px]">
                          Saved: {geminiMaskedKey}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-400 font-mono shrink-0">
                        {geminiActiveModel}
                      </span>
                    </div>
                  )}

                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">
                      Gemini API Key
                    </label>
                    <div className="relative">
                      <input
                        type={showKeyText ? "text" : "password"}
                        value={geminiInputKey}
                        onChange={(e) => {
                          setGeminiInputKey(e.target.value);
                          setTestStatus("idle");
                          setTestMessage("");
                        }}
                        placeholder="Paste AIzaSy... key here"
                        className="w-full rounded-xl border border-white/10 bg-zinc-800/80 px-3 py-2 text-xs font-mono pr-9 text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKeyText((p) => !p)}
                        className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-white"
                      >
                        {showKeyText ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">
                      Model Selection
                    </label>
                    <select
                      value={geminiSelectedModel}
                      onChange={(e) => setGeminiSelectedModel(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-zinc-800 px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                    >
                      {GEMINI_MODELS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400">OpenRouter Free Models:</span>
                    <a
                      href="https://openrouter.ai/keys"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-purple-400 hover:underline"
                    >
                      <span>Get Key</span>
                      <ExternalLink size={10} />
                    </a>
                  </div>

                  {openRouterMaskedKey && (
                    <div className="rounded-lg bg-zinc-800/60 p-2 border border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Check size={13} className="text-emerald-400 shrink-0" />
                        <span className="text-zinc-300 font-mono truncate text-[11px]">
                          Saved: {openRouterMaskedKey}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-400 font-mono shrink-0">
                        {openRouterActiveModel}
                      </span>
                    </div>
                  )}

                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">
                      OpenRouter API Key
                    </label>
                    <div className="relative">
                      <input
                        type={showKeyText ? "text" : "password"}
                        value={openRouterInputKey}
                        onChange={(e) => {
                          setOpenRouterInputKey(e.target.value);
                          setTestStatus("idle");
                          setTestMessage("");
                        }}
                        placeholder="Paste sk-or-v1-... key here"
                        className="w-full rounded-xl border border-white/10 bg-zinc-800/80 px-3 py-2 text-xs font-mono pr-9 text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKeyText((p) => !p)}
                        className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-white"
                      >
                        {showKeyText ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">
                      Fallback Model Selection
                    </label>
                    <select
                      value={
                        OPENROUTER_MODELS.some((m) => m.id === openRouterSelectedModel)
                          ? openRouterSelectedModel
                          : "custom"
                      }
                      onChange={(e) => {
                        if (e.target.value !== "custom") {
                          setOpenRouterSelectedModel(e.target.value);
                        }
                      }}
                      className="w-full rounded-xl border border-white/10 bg-zinc-800 px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                    >
                      {OPENROUTER_MODELS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                      <option value="custom">Type Custom Model ID...</option>
                    </select>
                    {(!OPENROUTER_MODELS.some((m) => m.id === openRouterSelectedModel) ||
                      openRouterSelectedModel === "custom") && (
                      <input
                        type="text"
                        value={openRouterSelectedModel === "custom" ? "" : openRouterSelectedModel}
                        placeholder="e.g. google/gemma-4-31b-it:free"
                        onChange={(e) => setOpenRouterSelectedModel(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-white/10 bg-zinc-800 px-3 py-1.5 text-xs font-mono text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                      />
                    )}
                  </div>
                </div>
              )}

              {testMessage && (
                <div
                  className={`p-2 rounded-xl text-[11px] flex items-start gap-1.5 ${
                    testStatus === "success"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                  }`}
                >
                  {testStatus === "success" ? (
                    <Check size={13} className="shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle size={13} className="shrink-0 mt-0.5" />
                  )}
                  <span>{testMessage}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTestKey}
                  disabled={
                    testStatus === "testing" ||
                    (settingsTab === "gemini" ? !geminiInputKey.trim() : !openRouterInputKey.trim())
                  }
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 font-medium text-zinc-300 hover:bg-white/10 disabled:opacity-40"
                >
                  {testStatus === "testing" ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 size={12} className="animate-spin" />
                      Testing...
                    </span>
                  ) : (
                    "Test Connection"
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSaveKey}
                  disabled={
                    saveStatus === "saving" ||
                    (settingsTab === "gemini" ? !geminiInputKey.trim() : !openRouterInputKey.trim())
                  }
                  className="rounded-xl bg-purple-600 px-3.5 py-1.5 font-medium text-white hover:bg-purple-700 disabled:opacity-40 shadow-sm"
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
                    "Save Key"
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Chat Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col justify-between py-2">
                <div className="space-y-3 text-center pt-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/15 border border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.3)]">
                    <Sparkles size={22} className="text-purple-400" />
                  </div>
                  <h4 className="text-sm font-bold text-white">
                    MH OP Voice & AI Copilot
                  </h4>
                  <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                    Voice chat in <b>Burmese (မြန်မာဘာသာ)</b> or <b>English</b>.
                    Orders, inventory levels, customer spend, and warranty validity.
                  </p>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-[11px] text-purple-300">
                    <Mic size={12} className="text-purple-400" />
                    <span>Tap 🎙️ below to speak</span>
                  </div>
                </div>

                {/* Quick Prompts */}
                <div className="space-y-2 pt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    Quick Inquiries
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {QUICK_PROMPTS.map((qp, idx) => {
                      const Icon = qp.icon;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSendMessage(qp.prompt)}
                          className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 text-left text-xs text-zinc-200 hover:bg-purple-500/20 hover:border-purple-500/40 transition-all cursor-pointer"
                        >
                          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-purple-500/20 text-purple-300">
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
                      className={`max-w-[88%] rounded-2xl p-3.5 shadow-xs relative ${
                        m.role === "user"
                          ? "bg-purple-600 text-white rounded-br-xs shadow-[0_4px_16px_rgba(147,51,234,0.3)]"
                          : "bg-zinc-900/90 text-zinc-100 rounded-bl-xs border border-white/10 shadow-md"
                      }`}
                    >
                      {m.role === "user" ? (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {m.content}
                        </p>
                      ) : (
                        renderMessageContent(m.content)
                      )}

                      {/* Assistant Card Footer: Voice listen & provider badge */}
                      {m.role === "assistant" && (
                        <div className="mt-3 pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-400">
                          <div className="flex items-center gap-2">
                            <span className="font-mono flex items-center gap-1">
                              {m.mode === "gemini" ? (
                                <>
                                  <Sparkles size={10} className="text-purple-400" />
                                  <span>{m.model || "Gemini 2.5"}</span>
                                </>
                              ) : m.mode === "openrouter" ? (
                                <>
                                  <Globe size={10} className="text-blue-400" />
                                  <span>OpenRouter ({m.model?.split("/")[1] || "Gemma"})</span>
                                </>
                              ) : (
                                <>
                                  <Database size={10} className="text-amber-400" />
                                  <span>Internal DB</span>
                                </>
                              )}
                            </span>

                            {/* Listen aloud button */}
                            <button
                              type="button"
                              onClick={() => {
                                if (speakingId === m.id) {
                                  stopSpeaking();
                                } else {
                                  speakText(m.content, m.id);
                                }
                              }}
                              className="inline-flex items-center gap-1 text-purple-400 hover:text-purple-300 font-semibold cursor-pointer"
                              title={speakingId === m.id ? "Stop voice" : "Listen aloud"}
                            >
                              {speakingId === m.id ? (
                                <>
                                  <Square size={10} className="fill-purple-400 animate-pulse" />
                                  <span>Stop</span>
                                </>
                              ) : (
                                <>
                                  <Volume2 size={11} />
                                  <span>Listen</span>
                                </>
                              )}
                            </button>
                          </div>

                          {m.toolCalls && m.toolCalls.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedTools((prev) => ({
                                  ...prev,
                                  [m.id]: !prev[m.id],
                                }))
                              }
                              className="inline-flex items-center gap-0.5 hover:text-white underline font-mono cursor-pointer"
                            >
                              <span>{m.toolCalls.length} tool(s)</span>
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
                          <div className="mt-2 space-y-1 rounded-xl bg-black/50 p-2 font-mono text-[10px] text-zinc-300 border border-white/5">
                            {m.toolCalls.map((tc, idx) => (
                              <div key={idx} className="space-y-0.5">
                                <p className="font-bold text-purple-400">
                                  🔧 {tc.name}
                                </p>
                                <pre className="overflow-x-auto text-zinc-400">
                                  {JSON.stringify(tc.args)}
                                </pre>
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                    <span className="text-[10px] text-zinc-400 mt-1 px-1 font-mono">
                      {m.timestamp}
                    </span>
                  </div>
                ))}

                {isPending && (
                  <div className="flex items-center gap-2 text-xs text-purple-300 p-2">
                    <Loader2 size={14} className="animate-spin text-purple-400" />
                    <span>Searching internal database...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Microphone Error Diagnosis Banner */}
          {micError && (
            <div className="flex items-center justify-between border-t border-rose-500/30 bg-rose-500/15 px-3 py-2 text-xs text-rose-300 animate-in fade-in">
              <div className="flex items-center gap-1.5 min-w-0">
                <AlertCircle size={14} className="shrink-0 text-rose-400" />
                <span className="text-[11px] leading-tight">{micError}</span>
              </div>
              <button
                type="button"
                onClick={() => setMicError(null)}
                className="text-xs font-semibold text-rose-400 hover:text-white shrink-0 ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* Active Voice Waveform Visualizer (Siri / Binance AI Style) */}
          {isListening && (
            <div className="flex items-center justify-between border-t border-purple-500/30 bg-purple-500/15 px-4 py-2.5 text-xs text-purple-200 animate-in fade-in">
              <div className="flex items-center gap-2.5">
                {/* Dynamic voice frequency visualizer */}
                <div className="flex items-center gap-1">
                  <span
                    className="w-1 rounded-full bg-purple-400 transition-all duration-75"
                    style={{ height: `${Math.max(6, (audioLevel / 100) * 20)}px` }}
                  />
                  <span
                    className="w-1 rounded-full bg-indigo-400 transition-all duration-75"
                    style={{ height: `${Math.max(8, (audioLevel / 100) * 26)}px` }}
                  />
                  <span
                    className="w-1 rounded-full bg-cyan-300 transition-all duration-75"
                    style={{ height: `${Math.max(10, (audioLevel / 100) * 32)}px` }}
                  />
                  <span
                    className="w-1 rounded-full bg-indigo-400 transition-all duration-75"
                    style={{ height: `${Math.max(8, (audioLevel / 100) * 24)}px` }}
                  />
                  <span
                    className="w-1 rounded-full bg-purple-400 transition-all duration-75"
                    style={{ height: `${Math.max(6, (audioLevel / 100) * 18)}px` }}
                  />
                </div>

                <span className="font-medium text-xs">
                  {voiceLang === "my-MM"
                    ? "🎙️ မြန်မာဘာသာဖြင့် နားထောင်နေပါသည်..."
                    : "🎙️ Listening in English..."}
                </span>
              </div>

              <button
                type="button"
                onClick={stopListening}
                className="rounded-lg bg-rose-500/30 border border-rose-500/40 px-2 py-0.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/40 cursor-pointer"
              >
                Done
              </button>
            </div>
          )}

          {/* iOS-Style Pill Input Bar */}
          <div className="border-t border-white/10 p-3 bg-zinc-900/60 backdrop-blur-md">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/12 p-1.5 shadow-inner focus-within:border-purple-500/60 transition-all"
            >
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    stopSpeaking();
                    setMessages([]);
                  }}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-zinc-400 hover:text-rose-400 hover:bg-white/10 transition-colors"
                  title="Clear chat history"
                >
                  <Trash2 size={14} />
                </button>
              )}

              {/* Language Switcher Badge */}
              <button
                type="button"
                onClick={() =>
                  setVoiceLang((prev) => (prev === "my-MM" ? "en-US" : "my-MM"))
                }
                className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-zinc-300 hover:bg-white/20 transition-colors cursor-pointer"
                title="Toggle language (Burmese / English)"
              >
                {voiceLang === "my-MM" ? "🇲🇲 MM" : "🇬🇧 EN"}
              </button>

              {/* Interactive Microphone Button */}
              <button
                type="button"
                onClick={toggleListening}
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition-all cursor-pointer ${
                  isListening
                    ? "bg-rose-600 text-white shadow-[0_0_16px_rgba(244,63,94,0.8)] animate-pulse"
                    : "bg-purple-600/30 text-purple-300 hover:bg-purple-600/50"
                }`}
                title={isListening ? "Stop voice listening" : "Start speaking (Voice Input)"}
              >
                {isListening ? <MicOff size={15} /> : <Mic size={15} />}
              </button>

              {/* Text Input */}
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isListening
                    ? "Listening to voice..."
                    : "Ask or speak in Burmese/English..."
                }
                disabled={isPending}
                className="flex-1 bg-transparent px-2 text-xs text-white placeholder-zinc-400 focus:outline-hidden"
              />

              {/* Send Button */}
              <button
                type="submit"
                disabled={!input.trim() || isPending}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-30 transition-all shadow-sm cursor-pointer"
                title="Send message"
              >
                <Send size={14} />
              </button>
            </form>

            <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-400 px-2">
              <span>
                Tap 🎙️ to talk • <kbd className="font-mono text-zinc-300">Ctrl+J</kbd>
              </span>
              <span>Internal data strictly</span>
            </div>
          </div>
        </aside>
      )}
    </>
  );
}
