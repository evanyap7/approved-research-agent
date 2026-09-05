"use client";

import { useState, useEffect, type FormEvent, useRef } from "react";
import ReactMarkdown from "react-markdown";
import {
  Search,
  Sparkles,
  ShieldCheck,
  BookOpen,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Key,
  RefreshCw,
  FileText,
  Globe,
  Database,
  Layers,
  ArrowRight,
  X,
  Building2,
  Atom,
  HeartPulse,
  History,
  Sliders,
} from "lucide-react";

type Finding = {
  claim: string;
  sourceIds: string[];
  confidence?: "high" | "medium" | "low";
};

type EvidenceItem = {
  claim: string;
  sourceIds: string[];
  confidence?: "high" | "medium" | "low";
};

type TopicResult = {
  mode: "topic";
  answer: string;
  findings: Finding[];
  limitations?: string[];
  sourcesUsed?: string[];
};

type ClaimResult = {
  mode: "claim";
  claim: string;
  verdict: "VERIFIED" | "REFUTED" | "UNVERIFIED";
  truthRating: number;
  reasoning: string;
  supportingEvidence: EvidenceItem[];
  contradictingEvidence: EvidenceItem[];
  limitations?: string[];
  sourcesUsed?: string[];
};

type SourceMetadata = {
  id: string;
  title: string;
  url: string;
  text: string;
};

type ResearchResponse = {
  result: TopicResult | ClaimResult;
  sources: SourceMetadata[];
};

const SAMPLE_PROMPTS = [
  {
    icon: Building2,
    category: "Corporate",
    label: "HACTL HVAC & Sustainability",
    question: "Research HACTL's HVAC consumption, terminal energy savings, and SBTi emissions targets",
  },
  {
    icon: Building2,
    category: "Logistics",
    label: "Modern Terminals Port Operations",
    question: "Research Modern Terminals Limited (MTL)'s sustainability reports and green port initiatives",
  },
  {
    icon: HeartPulse,
    category: "Health & Bio",
    label: "Zone 2 Cardio Science",
    question: "What is the science behind Zone 2 cardio training for mitochondrial health and longevity?",
  },
  {
    icon: Atom,
    category: "Deep Tech",
    label: "Quantum Error Correction",
    question: "How do topological surface codes compare to conventional fault-tolerant quantum error correction?",
  },
  {
    icon: History,
    category: "History",
    label: "Bronze Age Collapse",
    question: "What were the primary economic, trade, and climate drivers behind the Late Bronze Age Collapse?",
  },
];

const CLAIM_SAMPLES = [
  {
    icon: Building2,
    category: "Corporate Claim",
    label: "HACTL Carbon Commitments",
    question: "HACTL has committed to Science Based Targets initiative (SBTi) for net zero airport operations by 2050",
  },
  {
    icon: HeartPulse,
    category: "Health Claim",
    label: "Cold Plunges & Hypertrophy",
    question: "Cold water immersion immediately following resistance training significantly impairs muscle hypertrophy",
  },
  {
    icon: Globe,
    category: "Geographic Claim",
    label: "Great Wall from Space",
    question: "The Great Wall of China is visible from low Earth orbit with the unaided human eye",
  },
  {
    icon: Atom,
    category: "Tech Claim",
    label: "Quantum Supremacy",
    question: "Google's Sycamore quantum processor demonstrated a computational task impossible on classical supercomputers",
  },
];

const LOADING_STAGES = [
  { title: "Query Decomposition", desc: "Expanding query across entity variations & technical synonyms..." },
  { title: "Multi-Source Gathering", desc: "Querying Wikipedia, OpenAlex research works, and live web indices..." },
  { title: "Headless Rendering", desc: "Ingesting live web packets & extracting client-side SPA DOMs..." },
  { title: "Fact Grounding & Synthesis", desc: "Validating cross-citations, filtering noise, and generating conclusions..." },
];

export default function Home() {
  const [mode, setMode] = useState<"topic" | "claim">("topic");
  const [question, setQuestion] = useState("");
  const [customUrlInput, setCustomUrlInput] = useState("");
  const [showCustomUrls, setShowCustomUrls] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [data, setData] = useState<ResearchResponse | null>(null);
  const [error, setError] = useState("");
  const [selectedSource, setSelectedSource] = useState<SourceMetadata | null>(null);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const savedKey = localStorage.getItem("gemini_api_key");
    if (savedKey) setApiKey(savedKey);
  }, []);

  // Multi-step loading progression effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev < LOADING_STAGES.length - 1 ? prev + 1 : prev));
      }, 3200);
    }
    return () => clearInterval(interval);
  }, [loading]);

  function handleApiKeyChange(val: string) {
    setApiKey(val);
    if (val.trim()) {
      localStorage.setItem("gemini_api_key", val.trim());
    } else {
      localStorage.removeItem("gemini_api_key");
    }
  }

  async function runResearch(event?: FormEvent<HTMLFormElement>) {
    if (event) event.preventDefault();
    if (!question.trim() || loading) return;

    setLoading(true);
    setData(null);
    setError("");
    setSelectedSource(null);

    const customUrls = customUrlInput
      .split(/[\n,]/)
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: question.trim(),
          mode,
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          ...(customUrls.length > 0 ? { customUrls } : {}),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Research request failed.");
      }

      setData(payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(msg);
      if (msg.includes("API key")) {
        setShowSettingsModal(true);
      }
    } finally {
      setLoading(false);
    }
  }

  function sourceFor(id: string) {
    return data?.sources.find((source) => source.id === id);
  }

  function copyMarkdownReport() {
    if (!data) return;
    let report = `# Research Report: ${question}\n\n`;
    if (data.result.mode === "topic") {
      report += `## Synthesized Answer\n\n${data.result.answer}\n\n`;
      if (data.result.findings.length > 0) {
        report += `## Key Grounded Findings\n\n`;
        for (const f of data.result.findings) {
          report += `- ${f.claim} (Sources: ${f.sourceIds.join(", ")})\n`;
        }
      }
    } else {
      report += `## Claim: ${data.result.claim}\n\n`;
      report += `**Verdict**: ${data.result.verdict} (${data.result.truthRating}% truth rating)\n\n`;
      report += `### Rationale\n${data.result.reasoning}\n\n`;
      if (data.result.supportingEvidence.length > 0) {
        report += `### Supporting Evidence\n`;
        for (const e of data.result.supportingEvidence) {
          report += `- ${e.claim} [${e.sourceIds.join(", ")}]\n`;
        }
      }
      if (data.result.contradictingEvidence.length > 0) {
        report += `\n### Contradicting Evidence\n`;
        for (const e of data.result.contradictingEvidence) {
          report += `- ${e.claim} [${e.sourceIds.join(", ")}]\n`;
        }
      }
    }

    if (data.sources.length > 0) {
      report += `\n## Retrieved & Verified Sources\n`;
      for (const s of data.sources) {
        report += `- [${s.id}] ${s.title} (${s.url})\n`;
      }
    }

    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="relative min-h-screen bg-[#07090e] text-slate-100 flex flex-col justify-between overflow-x-hidden ambient-glow">
      {/* Background Decorative Gradients */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-gradient-to-b from-indigo-600/15 via-sky-500/10 to-transparent blur-3xl opacity-70" />
      <div className="pointer-events-none absolute top-96 -left-64 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute top-96 -right-64 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl" />

      {/* Top Floating Glass Navigation */}
      <header className="sticky top-0 z-40 w-full border-b border-white/[0.07] bg-[#07090e]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-cyan-400 p-[1px] shadow-lg shadow-indigo-500/20">
              <div className="flex h-full w-full items-center justify-center rounded-[11px] bg-[#090d16]">
                <Sparkles className="h-4 w-4 text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-bold tracking-tight text-white font-mono">
                  VERITAS
                </span>
                <span className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-300">
                  AGENT v2.5
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Autonomous Grounded Research & Claim Verification
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            {/* Live Status Pill */}
            <div className="hidden md:flex items-center space-x-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              <span>OpenAlex + Wikipedia + SPA Reader Active</span>
            </div>

            {/* API Key / Settings Trigger */}
            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              className="flex items-center space-x-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 transition-all hover:bg-white/[0.08] hover:text-white"
            >
              <Key className="h-3.5 w-3.5 text-slate-400" />
              <span className="hidden sm:inline">
                {apiKey ? "API Key Configured" : "Custom Key"}
              </span>
              {apiKey && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        {/* Hero Section */}
        <section className="mb-8 text-center sm:mb-10">
          <div className="inline-flex items-center space-x-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1 text-xs text-slate-300 backdrop-blur-md mb-4 shadow-inner">
            <Globe className="h-3.5 w-3.5 text-cyan-400" />
            <span>Multi-Engine Real-Time Web & Academic Synthesis</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            Research Any Topic.{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-sky-300 to-teal-300 bg-clip-text text-transparent">
              Verified by Evidence.
            </span>
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-400 sm:text-base">
            Deep-dive company filings, academic journals, Single-Page Applications, and news archives with cryptographic source citations and cross-verification.
          </p>

          {/* Mode Switcher */}
          <div className="mx-auto mt-7 flex max-w-md rounded-2xl border border-white/10 bg-[#0d121f]/90 p-1.5 shadow-2xl backdrop-blur-md">
            <button
              type="button"
              onClick={() => {
                setMode("topic");
                setData(null);
                setError("");
              }}
              className={`flex flex-1 items-center justify-center space-x-2 rounded-xl py-2.5 text-xs font-semibold transition-all sm:text-sm ${
                mode === "topic"
                  ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <BookOpen className="h-4 w-4" />
              <span>Deep Topic Research</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("claim");
                setData(null);
                setError("");
              }}
              className={`flex flex-1 items-center justify-center space-x-2 rounded-xl py-2.5 text-xs font-semibold transition-all sm:text-sm ${
                mode === "claim"
                  ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Claim Fact-Check</span>
            </button>
          </div>
        </section>

        {/* Search Command Center */}
        <section className="relative rounded-2xl border border-white/[0.12] bg-[#0b0f1a]/95 p-4 shadow-2xl backdrop-blur-2xl transition-all sm:p-6 focus-within:border-indigo-500/60 focus-within:ring-1 focus-within:ring-indigo-500/40">
          <form onSubmit={runResearch} className="space-y-4">
            <div className="relative">
              <label htmlFor="question-input" className="sr-only">
                Research Question
              </label>
              <textarea
                id="question-input"
                ref={textareaRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    runResearch();
                  }
                }}
                placeholder={
                  mode === "topic"
                    ? "Enter any company, scientific paper, policy, or operational topic (e.g. 'research HACTL's HVAC consumption & energy reduction')..."
                    : "Enter a specific statement or factual claim to verify (e.g. 'Cold water immersion impairs muscle hypertrophy after resistance training')..."
                }
                rows={3}
                className="w-full resize-none rounded-xl border border-transparent bg-transparent p-2 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all sm:text-base"
              />
            </div>

            {/* Custom URLs Section (Collapsible) */}
            {showCustomUrls && (
              <div className="rounded-xl border border-white/10 bg-[#090d16]/80 p-3 text-xs transition-all">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-slate-300 flex items-center space-x-1.5">
                    <Database className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Target Source URLs (Optional override)</span>
                  </span>
                  <span className="text-[10px] text-slate-500">
                    One URL per line (HTML, SPA, or PDF)
                  </span>
                </div>
                <textarea
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  placeholder="https://example.com/report.pdf&#10;https://company.com/sustainability"
                  rows={2}
                  className="w-full rounded-lg border border-white/10 bg-black/40 p-2 font-mono text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-indigo-500/50"
                />
              </div>
            )}

            {/* Form Action Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-3">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCustomUrls(!showCustomUrls)}
                  className={`inline-flex items-center space-x-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                    showCustomUrls || customUrlInput.trim()
                      ? "border border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                      : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                  }`}
                >
                  <Sliders className="h-3.5 w-3.5" />
                  <span>Custom URLs</span>
                  {customUrlInput.trim() && (
                    <span className="ml-1 rounded-full bg-cyan-500/30 px-1.5 text-[10px] font-bold text-cyan-200">
                      {customUrlInput.split(/[\n,]/).filter((u) => u.trim()).length}
                    </span>
                  )}
                </button>

                {question && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuestion("");
                      setData(null);
                      setError("");
                    }}
                    className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-3">
                <span className="hidden text-[11px] text-slate-500 sm:inline">
                  Press <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">⌘</kbd> + <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd>
                </span>

                <button
                  type="submit"
                  disabled={!question.trim() || loading}
                  className="inline-flex items-center space-x-2 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-cyan-500 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all hover:scale-[1.02] hover:shadow-indigo-500/40 active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin text-white" />
                      <span>Synthesizing...</span>
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4" />
                      <span>{mode === "topic" ? "Run Synthesis" : "Verify Claim"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </section>

        {/* Curated Sample Chips */}
        <section className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center space-x-1">
            <Sparkles className="h-3 w-3 text-amber-400" />
            <span>Try:</span>
          </span>
          {(mode === "topic" ? SAMPLE_PROMPTS : CLAIM_SAMPLES).map((sample, idx) => {
            const Icon = sample.icon;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setQuestion(sample.question);
                  if (textareaRef.current) textareaRef.current.focus();
                }}
                className="group flex items-center space-x-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-xs text-slate-300 transition-all hover:border-indigo-500/40 hover:bg-white/[0.07] hover:text-white"
              >
                <Icon className="h-3 w-3 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                <span>{sample.label}</span>
              </button>
            );
          })}
        </section>

        {/* Error Notification */}
        {error && (
          <div className="mt-6 flex items-start space-x-3 rounded-2xl border border-red-500/30 bg-red-950/40 p-4 text-red-200 backdrop-blur-md">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-red-300">Research Pipeline Error</p>
              <p className="mt-1 text-xs text-red-300/80 leading-relaxed">{error}</p>
              {error.includes("API key") && (
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(true)}
                  className="mt-2 text-xs font-semibold text-white underline hover:no-underline"
                >
                  Configure Gemini API Key →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Multi-Step Pipeline Visualizer (When Loading) */}
        {loading && (
          <div className="mt-8 rounded-2xl border border-indigo-500/20 bg-[#0a0f1d]/90 p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <RefreshCw className="h-4 w-4 animate-spin text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">
                  Autonomous Research Engine in Progress
                </h3>
              </div>
              <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs font-medium text-indigo-300">
                Step {loadingStep + 1} of 4
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              {LOADING_STAGES.map((stage, idx) => {
                const isActive = idx === loadingStep;
                const isDone = idx < loadingStep;
                return (
                  <div
                    key={idx}
                    className={`rounded-xl border p-3 transition-all ${
                      isActive
                        ? "border-indigo-500/60 bg-indigo-500/10 shadow-lg shadow-indigo-500/10 animate-pulse"
                        : isDone
                        ? "border-emerald-500/30 bg-emerald-500/5 text-slate-300"
                        : "border-white/[0.05] bg-white/[0.02] text-slate-500"
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                            isActive
                              ? "bg-indigo-500 text-white"
                              : "bg-white/10 text-slate-400"
                          }`}
                        >
                          {idx + 1}
                        </span>
                      )}
                      <h4
                        className={`text-xs font-semibold ${
                          isActive ? "text-indigo-300" : isDone ? "text-slate-200" : "text-slate-400"
                        }`}
                      >
                        {stage.title}
                      </h4>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400 line-clamp-2">
                      {stage.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Results Section */}
        {data && (
          <section className="mt-8 space-y-6 animate-in fade-in-50 duration-500">
            {/* Report Actions Header Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0d121f]/80 p-3.5 backdrop-blur-xl">
              <div className="flex items-center space-x-2">
                <span className="rounded-lg bg-indigo-500/20 px-2.5 py-1 text-xs font-bold text-indigo-300 uppercase tracking-wider">
                  {data.result.mode === "topic" ? "Synthesized Topic Report" : "Fact-Check Verdict"}
                </span>
                <span className="text-xs text-slate-400">
                  {data.sources.length} Verified Sources Used
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={copyMarkdownReport}
                  className="inline-flex items-center space-x-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 transition-all hover:bg-white/[0.08] hover:text-white cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-300">Report Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Markdown</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* TOPIC MODE SYNTHESIS */}
            {data.result.mode === "topic" && (
              <>
                {/* Executive Answer Card */}
                <div className="rounded-2xl border border-white/10 bg-[#0b101c]/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
                  <div className="flex items-center space-x-2 border-b border-white/[0.07] pb-4">
                    <FileText className="h-5 w-5 text-indigo-400" />
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      Comprehensive Synthesis
                    </h2>
                  </div>

                  <div className="prose-custom mt-5 leading-relaxed">
                    <ReactMarkdown>{data.result.answer}</ReactMarkdown>
                  </div>
                </div>

                {/* Key Grounded Findings Grid */}
                {data.result.findings && data.result.findings.length > 0 && (
                  <div className="rounded-2xl border border-white/10 bg-[#0b101c]/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
                    <div className="flex items-center justify-between border-b border-white/[0.07] pb-4">
                      <div className="flex items-center space-x-2">
                        <Layers className="h-5 w-5 text-cyan-400" />
                        <h3 className="text-base font-bold text-white">
                          Verified Findings & Evidence Breakdown ({data.result.findings.length})
                        </h3>
                      </div>
                      <span className="text-xs text-slate-500">
                        Click citations to inspect original text
                      </span>
                    </div>

                    <div className="mt-5 grid gap-3.5 md:grid-cols-2">
                      {data.result.findings.map((finding, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-4.5 transition-all hover:border-white/15 hover:bg-white/[0.04]"
                        >
                          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                            {finding.claim}
                          </p>

                          <div className="mt-3.5 flex flex-wrap items-center gap-1.5 border-t border-white/[0.04] pt-2.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                              Cited In:
                            </span>
                            {finding.sourceIds.map((id) => {
                              const s = sourceFor(id);
                              return (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() => s && setSelectedSource(s)}
                                  className="inline-flex items-center space-x-1 rounded-md bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 text-[11px] font-mono font-medium text-indigo-300 hover:bg-indigo-500/30 transition-colors cursor-pointer"
                                >
                                  <span>[{id}]</span>
                                  <span className="max-w-[120px] truncate text-[10px]">
                                    {s?.title ?? id}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* CLAIM VERIFICATION MODE */}
            {data.result.mode === "claim" && (
              <>
                {/* Hero Verdict Plaque */}
                <div
                  className={`relative overflow-hidden rounded-2xl border p-6 sm:p-8 backdrop-blur-2xl shadow-2xl ${
                    data.result.verdict === "VERIFIED"
                      ? "border-emerald-500/40 bg-gradient-to-b from-emerald-950/50 to-[#0b101c]"
                      : data.result.verdict === "REFUTED"
                      ? "border-rose-500/40 bg-gradient-to-b from-rose-950/50 to-[#0b101c]"
                      : "border-amber-500/40 bg-gradient-to-b from-amber-950/50 to-[#0b101c]"
                  }`}
                >
                  <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center space-x-3">
                        <span
                          className={`inline-flex items-center space-x-1.5 rounded-full px-3 py-1 text-xs font-extrabold tracking-wider uppercase ${
                            data.result.verdict === "VERIFIED"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : data.result.verdict === "REFUTED"
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          }`}
                        >
                          {data.result.verdict === "VERIFIED" && (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          {data.result.verdict === "REFUTED" && (
                            <XCircle className="h-4 w-4" />
                          )}
                          {data.result.verdict === "UNVERIFIED" && (
                            <HelpCircle className="h-4 w-4" />
                          )}
                          <span>{data.result.verdict}</span>
                        </span>
                      </div>

                      <h3 className="mt-3 text-lg font-bold text-white sm:text-2xl leading-snug">
                        &ldquo;{data.result.claim}&rdquo;
                      </h3>
                    </div>

                    {/* Truth Gauge Meter */}
                    <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-black/40 p-4 min-w-[150px]">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Evidence Rating
                      </span>
                      <span className="mt-1 text-3xl font-extrabold font-mono text-white">
                        {data.result.truthRating}%
                      </span>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className={`h-full transition-all duration-1000 ${
                            data.result.truthRating >= 75
                              ? "bg-emerald-500"
                              : data.result.truthRating <= 25
                              ? "bg-rose-500"
                              : "bg-amber-500"
                          }`}
                          style={{ width: `${data.result.truthRating}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Verification Rationale */}
                  <div className="mt-6 border-t border-white/[0.08] pt-5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Step-by-Step Rationale
                    </h4>
                    <div className="prose-custom mt-2 text-sm text-slate-300 leading-relaxed">
                      <ReactMarkdown>{data.result.reasoning}</ReactMarkdown>
                    </div>
                  </div>
                </div>

                {/* Evidence Dual Column Grid */}
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Supporting Evidence */}
                  <div className="rounded-2xl border border-emerald-500/20 bg-[#09121a]/80 p-6 backdrop-blur-xl">
                    <div className="flex items-center space-x-2 border-b border-emerald-500/20 pb-3">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <h4 className="text-sm font-bold text-emerald-200">
                        Supporting Evidence ({data.result.supportingEvidence.length})
                      </h4>
                    </div>

                    {data.result.supportingEvidence.length === 0 ? (
                      <p className="mt-4 text-xs text-slate-400 italic">
                        No direct supporting evidence found in the retrieved sources.
                      </p>
                    ) : (
                      <ul className="mt-4 space-y-3">
                        {data.result.supportingEvidence.map((item, idx) => (
                          <li
                            key={idx}
                            className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.03] p-3 text-xs leading-relaxed text-slate-300"
                          >
                            <p>{item.claim}</p>
                            <div className="mt-2 flex items-center space-x-1">
                              {item.sourceIds.map((id) => {
                                const s = sourceFor(id);
                                return (
                                  <button
                                    key={id}
                                    type="button"
                                    onClick={() => s && setSelectedSource(s)}
                                    className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/30"
                                  >
                                    [{id}] {s?.title ? s.title.slice(0, 20) + "..." : id}
                                  </button>
                                );
                              })}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Contradicting Evidence */}
                  <div className="rounded-2xl border border-rose-500/20 bg-[#160b13]/80 p-6 backdrop-blur-xl">
                    <div className="flex items-center space-x-2 border-b border-rose-500/20 pb-3">
                      <XCircle className="h-4 w-4 text-rose-400" />
                      <h4 className="text-sm font-bold text-rose-200">
                        Contradicting Evidence ({data.result.contradictingEvidence.length})
                      </h4>
                    </div>

                    {data.result.contradictingEvidence.length === 0 ? (
                      <p className="mt-4 text-xs text-slate-400 italic">
                        No contradicting evidence identified in the retrieved sources.
                      </p>
                    ) : (
                      <ul className="mt-4 space-y-3">
                        {data.result.contradictingEvidence.map((item, idx) => (
                          <li
                            key={idx}
                            className="rounded-xl border border-rose-500/10 bg-rose-500/[0.03] p-3 text-xs leading-relaxed text-slate-300"
                          >
                            <p>{item.claim}</p>
                            <div className="mt-2 flex items-center space-x-1">
                              {item.sourceIds.map((id) => {
                                const s = sourceFor(id);
                                return (
                                  <button
                                    key={id}
                                    type="button"
                                    onClick={() => s && setSelectedSource(s)}
                                    className="rounded bg-rose-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-rose-300 hover:bg-rose-500/30"
                                  >
                                    [{id}] {s?.title ? s.title.slice(0, 20) + "..." : id}
                                  </button>
                                );
                              })}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Limitations & Gaps Section */}
            {data.result.limitations && data.result.limitations.length > 0 && (
              <div className="rounded-2xl border border-amber-500/20 bg-[#141008]/80 p-5 backdrop-blur-xl">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-amber-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    Evidentiary Limitations & Gaps
                  </h4>
                </div>
                <ul className="mt-2.5 list-disc list-inside text-xs text-amber-200/80 space-y-1 leading-relaxed">
                  {data.result.limitations.map((lim, idx) => (
                    <li key={idx}>{lim}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Retrieved Web Sources Grid */}
            {data.sources && data.sources.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-[#0b101c]/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center justify-between border-b border-white/[0.07] pb-4">
                  <div className="flex items-center space-x-2">
                    <Globe className="h-5 w-5 text-indigo-400" />
                    <h3 className="text-base font-bold text-white">
                      Retrieved & Ingested Live Sources ({data.sources.length})
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500">
                    Parsed via Cheerio, PDFParse & Jina SPA Reader
                  </span>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {data.sources.map((source) => {
                    let hostname = "";
                    try {
                      hostname = new URL(source.url).hostname;
                    } catch {
                      hostname = "web-source";
                    }

                    return (
                      <div
                        key={source.id}
                        className="group flex flex-col justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] p-4.5 transition-all hover:border-indigo-500/40 hover:bg-white/[0.04]"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="rounded-md bg-indigo-500/20 border border-indigo-500/30 px-2 py-0.5 font-mono text-xs font-bold text-indigo-300">
                              {source.id}
                            </span>
                            <span className="rounded bg-white/[0.06] px-2 py-0.5 text-[10px] font-mono text-slate-400">
                              {hostname}
                            </span>
                          </div>

                          <h4 className="mt-2.5 text-xs sm:text-sm font-semibold text-white line-clamp-2 leading-snug">
                            {source.title}
                          </h4>

                          <p className="mt-2 text-xs text-slate-400 line-clamp-3 leading-relaxed">
                            {source.text}
                          </p>
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-white/[0.05] pt-3 text-xs">
                          <button
                            type="button"
                            onClick={() => setSelectedSource(source)}
                            className="text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                          >
                            Inspect Extracted Text →
                          </button>

                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center space-x-1 text-slate-400 hover:text-white"
                          >
                            <span>Open Link</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-white/[0.07] py-6 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-5xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 Veritas Autonomous Research Agent. Grounded with real sources.</p>
          <div className="flex items-center space-x-3 text-slate-400">
            <span>OpenAlex API</span>
            <span>•</span>
            <span>Wikipedia Action API</span>
            <span>•</span>
            <span>Jina SPA Reader</span>
            <span>•</span>
            <span>Google Gemini</span>
          </div>
        </div>
      </footer>

      {/* Interactive Source Inspector Modal */}
      {selectedSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-in fade-in-50">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-white/15 bg-[#0d121f] shadow-2xl flex flex-col">
            <div className="flex items-start justify-between border-b border-white/10 p-5">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="rounded-md bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-0.5 font-mono text-xs font-bold text-indigo-300">
                    Source {selectedSource.id}
                  </span>
                  <span className="text-xs text-slate-400">
                    {selectedSource.text.length.toLocaleString()} characters extracted
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mt-1 line-clamp-1">
                  {selectedSource.title}
                </h3>
                <a
                  href={selectedSource.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1 text-xs text-indigo-400 hover:underline break-all"
                >
                  <span>{selectedSource.url}</span>
                  <ExternalLink className="h-3 w-3 inline" />
                </a>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSource(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Extracted Context Text (Provided to AI)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(selectedSource.text);
                  }}
                  className="text-xs text-indigo-400 hover:underline inline-flex items-center space-x-1"
                >
                  <Copy className="h-3 w-3" />
                  <span>Copy Source Text</span>
                </button>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/50 p-4 font-mono text-xs leading-relaxed text-slate-300 whitespace-pre-wrap max-h-[50vh] overflow-y-auto">
                {selectedSource.text}
              </div>
            </div>

            <div className="border-t border-white/10 p-4 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedSource(null)}
                className="rounded-xl bg-white/10 px-5 py-2 text-xs font-semibold text-white hover:bg-white/15 transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings / API Key Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-in fade-in-50">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0d121f] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center space-x-2">
                <Key className="h-5 w-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Engine Configuration</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="api-key-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5"
                >
                  Gemini API Key (Optional)
                </label>
                <input
                  id="api-key-input"
                  type="password"
                  value={apiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full rounded-xl border border-white/10 bg-black/50 p-2.5 font-mono text-xs text-white placeholder-slate-600 outline-none focus:border-indigo-500/60"
                />
                <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
                  If the server environment variable is not configured or exceeds quota, you can supply your personal Google AI Studio key here. It is saved in your local browser storage.
                </p>
              </div>

              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-xs text-slate-400 space-y-1.5">
                <div className="flex items-center space-x-2 text-slate-300 font-semibold">
                  <Database className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Enabled Search Pipeline</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  1. OpenAlex Academic Works (250M+ items)
                  <br />
                  2. Wikipedia Action API (Official summaries)
                  <br />
                  3. DuckDuckGo Real-Time Web Index
                  <br />
                  4. Jina Headless SPA DOM Reader
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:from-indigo-600 hover:to-indigo-700 shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}