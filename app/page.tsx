"use client";

import { useState, useEffect, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";

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
    category: "🏢 Company Research",
    question: "Research Modern Terminals Limited (MTL)'s sustainability reports and port operations",
  },
  {
    category: "🏋️ Health & Fitness",
    question: "What is the science behind Zone 2 cardio training for mitochondrial health?",
  },
  {
    category: "🏛️ History",
    question: "What were the primary economic drivers behind the Bronze Age Collapse?",
  },
  {
    category: "🔬 Science & Tech",
    question: "How do solid-state lithium batteries compare to conventional lithium-ion batteries?",
  },
];

const CLAIM_SAMPLES = [
  {
    category: "🏢 Corporate Claim",
    question: "Modern Terminals Limited is committed to sustainability and environmental policies in its port operations",
  },
  {
    category: "🏋️ Health & Fitness Claim",
    question: "Cold water immersion after strength training reduces long-term muscle hypertrophy",
  },
  {
    category: "🌐 General Knowledge Claim",
    question: "The Great Wall of China is visible from space with the naked eye",
  },
];

export default function Home() {
  const [mode, setMode] = useState<"topic" | "claim">("topic");
  const [question, setQuestion] = useState("");
  const [customUrlInput, setCustomUrlInput] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ResearchResponse | null>(null);
  const [error, setError] = useState("");
  const [selectedSource, setSelectedSource] = useState<SourceMetadata | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem("gemini_api_key");
    if (savedKey) setApiKey(savedKey);
  }, []);

  function handleApiKeyChange(val: string) {
    setApiKey(val);
    if (val.trim()) {
      localStorage.setItem("gemini_api_key", val.trim());
    } else {
      localStorage.removeItem("gemini_api_key");
    }
  }

  async function runResearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

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
          question,
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
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Something went wrong.";
      setError(msg);
      if (msg.includes("API key")) {
        setShowApiKeyInput(true);
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
        report += `## Key Findings\n\n`;
        for (const f of data.result.findings) {
          report += `- ${f.claim} (Sources: ${f.sourceIds.join(", ")})\n`;
        }
      }
    } else {
      report += `## Claim: ${data.result.claim}\n\n`;
      report += `**Verdict**: ${data.result.verdict} (${data.result.truthRating}% truth rating)\n\n`;
      report += `### Rationale\n${data.result.reasoning}\n\n`;
    }

    if (data.sources.length > 0) {
      report += `\n## Retrived Sources\n`;
      for (const s of data.sources) {
        report += `- [${s.id}] ${s.title} - ${s.url}\n`;
      }
    }

    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl p-6 md:p-8">
      {/* Header */}
      <header className="border-b border-gray-200 pb-6">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold tracking-wide text-blue-700">
            Powered by Gemini & Real Web Sources
          </span>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
          Open Web Research & Claim Verification Agent
        </h1>
        <p className="mt-2 text-gray-600">
          Access live web sources across any company, science, health, or history topic and verify factual claims against verified evidence.
        </p>

        {/* Mode Selector Tabs */}
        <div className="mt-6 flex rounded-xl bg-gray-100 p-1 max-w-md">
          <button
            type="button"
            onClick={() => {
              setMode("topic");
              setData(null);
            }}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
              mode === "topic"
                ? "bg-white text-black shadow-sm"
                : "text-gray-600 hover:text-black"
            }`}
          >
            🌐 Open Web Topic Research
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("claim");
              setData(null);
            }}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
              mode === "claim"
                ? "bg-white text-black shadow-sm"
                : "text-gray-600 hover:text-black"
            }`}
          >
            🔍 Claim Verification
          </button>
        </div>

        {/* Sample Topics / Claims */}
        <div className="mt-4 flex flex-wrap gap-2">
          {(mode === "topic" ? SAMPLE_PROMPTS : CLAIM_SAMPLES).map((sample, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setQuestion(sample.question)}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-black"
            >
              {sample.category}
            </button>
          ))}
        </div>
      </header>

      {/* Input Form */}
      <form onSubmit={runResearch} className="mt-6 space-y-5">
        <div>
          <label className="block font-semibold text-gray-800" htmlFor="question">
            {mode === "topic" ? "Research Question or Company Topic" : "Statement or Claim to Verify"}
          </label>
          <textarea
            id="question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={
              mode === "topic"
                ? "e.g. Research Modern Terminals Limited (MTL)'s sustainability reports"
                : "e.g. Modern Terminals Limited is committed to sustainability in port operations"
            }
            className="mt-2 min-h-28 w-full rounded-xl border border-gray-300 p-4 shadow-sm focus:border-black focus:outline-none"
            minLength={3}
            maxLength={1000}
            required
          />
        </div>

        <div>
          <label className="block font-semibold text-gray-800" htmlFor="customUrls">
            Target Source URLs <span className="text-sm font-normal text-gray-500">(Optional)</span>
          </label>
          <p className="text-xs text-gray-500 mt-0.5">
            Leave blank to automatically search the live web, or provide specific webpage URLs to analyze.
          </p>
          <textarea
            id="customUrls"
            value={customUrlInput}
            onChange={(event) => setCustomUrlInput(event.target.value)}
            placeholder="Optional: Paste specific webpage or PDF URLs here (one per line)..."
            className="mt-2 min-h-16 w-full rounded-xl border border-gray-300 p-3 text-sm shadow-sm focus:border-black focus:outline-none"
          />
        </div>

        {/* Optional Custom API Key Field */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <button
            type="button"
            onClick={() => setShowApiKeyInput(!showApiKeyInput)}
            className="flex items-center justify-between w-full text-xs font-semibold text-gray-700 hover:text-black"
          >
            <span>🔑 Gemini API Key {apiKey ? " (Saved)" : " (Optional)"}</span>
            <span className="text-gray-400">{showApiKeyInput ? "▲ Hide" : "▼ Enter custom key"}</span>
          </button>
          {showApiKeyInput && (
            <div className="mt-3 space-y-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full rounded-lg border border-gray-300 p-2.5 text-xs focus:border-black focus:outline-none"
              />
              <p className="text-[11px] text-gray-500">
                Get a free key from{" "}
                <a
                  href="https://aistudio.google.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-blue-600 underline"
                >
                  Google AI Studio
                </a>{" "}
                or configure <code className="bg-gray-200 px-1 py-0.5 rounded text-[10px]">GOOGLE_GENERATIVE_AI_API_KEY</code> in environment variables.
              </p>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-black px-6 py-3 font-medium text-white shadow-md transition-all hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? mode === "topic"
              ? "Searching Web & Synthesizing..."
              : "Verifying Claim Across Web Sources..."
            : mode === "topic"
            ? "Run Open Web Research"
            : "Verify Claim"}
        </button>
      </form>

      {/* Error Message */}
      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <h2 className="font-semibold text-red-800">Research Error</h2>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      )}

      {/* Results Controls */}
      {data && (
        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={copyMarkdownReport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
          >
            {copied ? "✓ Copied to Clipboard!" : "📋 Copy Report as Markdown"}
          </button>
        </div>
      )}

      {/* Topic Research Output */}
      {data && data.result.mode === "topic" && (
        <section className="mt-4 space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">Synthesized Web Answer</h2>
            <div className="prose prose-sm mt-3 max-w-none text-gray-800 leading-relaxed">
              <ReactMarkdown>{data.result.answer}</ReactMarkdown>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">Extracted Key Findings</h2>

            {data.result.findings.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">
                No specific verified findings were extracted from the retrieved sources.
              </p>
            ) : (
              <ul className="mt-4 space-y-4">
                {data.result.findings.map((finding, idx) => (
                  <li
                    key={idx}
                    className="rounded-xl border border-gray-100 bg-gray-50 p-4 transition-all hover:border-gray-300"
                  >
                    <p className="font-medium text-gray-900">{finding.claim}</p>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-gray-500">Sources:</span>
                      {finding.sourceIds.map((id) => {
                        const s = sourceFor(id);
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => s && setSelectedSource(s)}
                            className="rounded-md bg-blue-100 px-2 py-1 font-semibold text-blue-800 hover:bg-blue-200 transition-colors"
                            title={s?.title || id}
                          >
                            [{id}] {s?.title ? s.title.slice(0, 25) + "..." : id}
                          </button>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Limitations section */}
          {data.result.limitations && data.result.limitations.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
              <h3 className="text-sm font-bold text-amber-900">⚠️ Research Limitations & Gaps</h3>
              <ul className="mt-2 list-disc list-inside text-xs text-amber-800 space-y-1">
                {data.result.limitations.map((lim, idx) => (
                  <li key={idx}>{lim}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Claim Verification Output */}
      {data && data.result.mode === "claim" && (
        <section className="mt-4 space-y-6">
          {/* Verdict Banner */}
          <div
            className={`rounded-2xl border p-6 shadow-sm ${
              data.result.verdict === "VERIFIED"
                ? "border-green-300 bg-green-50 text-green-950"
                : data.result.verdict === "REFUTED"
                ? "border-red-300 bg-red-50 text-red-950"
                : "border-amber-300 bg-amber-50 text-amber-950"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider opacity-75">
                  Truth Verdict
                </span>
                <h2 className="text-2xl font-extrabold tracking-tight mt-0.5">
                  {data.result.verdict === "VERIFIED" && "🟢 VERIFIED"}
                  {data.result.verdict === "REFUTED" && "🔴 REFUTED"}
                  {data.result.verdict === "UNVERIFIED" && "🟡 UNVERIFIED / INSUFFICIENT EVIDENCE"}
                </h2>
              </div>

              <div className="text-right">
                <span className="text-xs font-semibold opacity-75">Truth Rating</span>
                <p className="text-3xl font-black">{data.result.truthRating}%</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-4 h-2.5 w-full rounded-full bg-black/10">
              <div
                className={`h-2.5 rounded-full transition-all duration-500 ${
                  data.result.verdict === "VERIFIED"
                    ? "bg-green-600"
                    : data.result.verdict === "REFUTED"
                    ? "bg-red-600"
                    : "bg-amber-600"
                }`}
                style={{ width: `${data.result.truthRating}%` }}
              />
            </div>

            <div className="mt-5 border-t border-black/10 pt-4 prose prose-sm max-w-none">
              <h3 className="text-sm font-bold opacity-90">Reasoning & Verdict Explanation</h3>
              <div className="mt-1.5 text-sm leading-relaxed opacity-90">
                <ReactMarkdown>{data.result.reasoning}</ReactMarkdown>
              </div>
            </div>
          </div>

          {/* Supporting Evidence */}
          {data.result.supportingEvidence.length > 0 && (
            <div className="rounded-2xl border border-green-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-green-900">
                Supporting Evidence ({data.result.supportingEvidence.length})
              </h3>
              <ul className="mt-3 space-y-3">
                {data.result.supportingEvidence.map((item, idx) => (
                  <li key={idx} className="rounded-xl border border-green-100 bg-green-50/50 p-4">
                    <p className="text-sm font-medium text-gray-900">{item.claim}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {item.sourceIds.map((id) => {
                        const s = sourceFor(id);
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => s && setSelectedSource(s)}
                            className="rounded bg-green-200 px-2 py-0.5 font-medium text-green-900 hover:bg-green-300"
                          >
                            [{id}] {s?.title ? s.title.slice(0, 25) + "..." : id}
                          </button>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Contradicting Evidence */}
          {data.result.contradictingEvidence.length > 0 && (
            <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-red-900">
                Contradicting / Disproving Evidence ({data.result.contradictingEvidence.length})
              </h3>
              <ul className="mt-3 space-y-3">
                {data.result.contradictingEvidence.map((item, idx) => (
                  <li key={idx} className="rounded-xl border border-red-100 bg-red-50/50 p-4">
                    <p className="text-sm font-medium text-gray-900">{item.claim}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {item.sourceIds.map((id) => {
                        const s = sourceFor(id);
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => s && setSelectedSource(s)}
                            className="rounded bg-red-200 px-2 py-0.5 font-medium text-red-900 hover:bg-red-300"
                          >
                            [{id}] {s?.title ? s.title.slice(0, 25) + "..." : id}
                          </button>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Limitations section */}
          {data.result.limitations && data.result.limitations.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
              <h3 className="text-sm font-bold text-amber-900">⚠️ Evidence Limitations & Missing Data</h3>
              <ul className="mt-2 list-disc list-inside text-xs text-amber-800 space-y-1">
                {data.result.limitations.map((lim, idx) => (
                  <li key={idx}>{lim}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Sources Display Grid */}
      {data && data.sources && data.sources.length > 0 && (
        <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900">Retrieved Web Sources ({data.sources.length})</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {data.sources.map((source) => (
              <div
                key={source.id}
                className="flex flex-col justify-between rounded-xl border border-gray-100 bg-gray-50 p-4 transition-all hover:border-gray-300"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-black px-2 py-0.5 text-xs font-bold text-white">
                      {source.id}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedSource(source)}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      View Text Snippet
                    </button>
                  </div>
                  <h3 className="font-semibold text-gray-900 mt-2 line-clamp-1">{source.title}</h3>
                  <p className="mt-2 text-xs text-gray-600 line-clamp-3">{source.text}</p>
                </div>

                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center text-xs font-semibold text-blue-600 hover:underline"
                >
                  Visit Original Source →
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Interactive Source Snippet Modal */}
      {selectedSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <span className="rounded-md bg-black px-2.5 py-1 text-xs font-bold text-white">
                  Source {selectedSource.id}
                </span>
                <h3 className="text-lg font-bold text-gray-900 mt-2">{selectedSource.title}</h3>
                <a
                  href={selectedSource.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 hover:underline break-all"
                >
                  {selectedSource.url}
                </a>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSource(null)}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-black"
              >
                ✕
              </button>
            </div>

            <div className="mt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Extracted Markdown Content</h4>
              <div className="mt-2 rounded-xl bg-gray-50 p-4 text-xs font-mono text-gray-800 whitespace-pre-wrap max-h-96 overflow-y-auto border border-gray-200">
                {selectedSource.text}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedSource(null)}
                className="rounded-xl bg-black px-5 py-2 text-sm font-semibold text-white hover:bg-gray-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}