"use client";

import { FormEvent, useState } from "react";

type Finding = {
  claim: string;
  sourceIds: string[];
  confidence: "high" | "medium" | "low";
};

type EvidenceItem = {
  claim: string;
  sourceIds: string[];
};

type TopicResponse = {
  mode: "topic";
  result: {
    answer: string;
    findings: Finding[];
    limitations: string[];
    sourcesUsed: string[];
  };
  sourceMetadata: {
    id: string;
    title: string;
    url: string;
  }[];
};

type ClaimResponse = {
  mode: "claim";
  result: {
    claim: string;
    verdict: "VERIFIED" | "REFUTED" | "UNVERIFIED";
    truthRating: number;
    reasoning: string;
    supportingEvidence: EvidenceItem[];
    contradictingEvidence: EvidenceItem[];
    limitations: string[];
    sourcesUsed: string[];
  };
  sourceMetadata: {
    id: string;
    title: string;
    url: string;
  }[];
};

type ResearchResponse = TopicResponse | ClaimResponse;

const TOPIC_SAMPLE_PROMPTS = [
  {
    category: "🏢 Company Research",
    question: "Research Modern Terminal Limited (MTL)'s sustainability reports",
  },
  {
    category: "🏋️‍♂️ Health & Fitness",
    question: "What is the correlation between exercise frequency and muscle hypertrophy?",
  },
  {
    category: "🏛️ History",
    question: "What were the primary socio-economic causes of the Industrial Revolution?",
  },
  {
    category: "🔬 Science & Tech",
    question: "How do mRNA vaccines stimulate adaptive immunity in humans?",
  },
];

const CLAIM_SAMPLE_PROMPTS = [
  {
    category: "🏢 Company Claim",
    question: "Modern Terminals Limited is committed to sustainability and environmental policies in its port operations",
  },
  {
    category: "🏋️‍♂️ Health Claim",
    question: "Creatine supplementation causes hair loss in healthy adults",
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
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ResearchResponse | null>(null);
  const [error, setError] = useState("");

  async function runResearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setData(null);
    setError("");

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
          ...(customUrls.length > 0 ? { customUrls } : {}),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Research request failed.");
      }

      setData(payload);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  function sourceFor(id: string) {
    return data?.sourceMetadata.find((source) => source.id === id);
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl p-6 md:p-8">
      {/* Header */}
      <header className="border-b pb-6">
        <h1 className="text-3xl font-bold tracking-tight">
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

        {/* Sample Prompts */}
        <div className="mt-4 flex flex-wrap gap-2">
          {(mode === "topic" ? TOPIC_SAMPLE_PROMPTS : CLAIM_SAMPLE_PROMPTS).map(
            (sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setQuestion(sample.question)}
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                {sample.category}
              </button>
            )
          )}
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
                ? "e.g. Research Modern Terminal Limited (MTL)'s sustainability reports"
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

      {/* Error Alert */}
      {error && (
        <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700 border border-red-200">
          <p className="font-semibold">Research Error</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {/* Results Display */}
      {data && (
        <section className="mt-10 space-y-8 border-t pt-8">
          {/* CLAIM VERIFICATION MODE DISPLAY */}
          {data.mode === "claim" ? (
            <div className="space-y-8">
              {/* Verdict Banner */}
              <div
                className={`rounded-2xl border p-6 shadow-sm ${
                  data.result.verdict === "VERIFIED"
                    ? "bg-green-50/70 border-green-200"
                    : data.result.verdict === "REFUTED"
                    ? "bg-red-50/70 border-red-200"
                    : "bg-amber-50/70 border-amber-200"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <span
                      className={`text-2xl ${
                        data.result.verdict === "VERIFIED"
                          ? "text-green-600"
                          : data.result.verdict === "REFUTED"
                          ? "text-red-600"
                          : "text-amber-600"
                      }`}
                    >
                      {data.result.verdict === "VERIFIED"
                        ? "🟢"
                        : data.result.verdict === "REFUTED"
                        ? "🔴"
                        : "🟡"}
                    </span>
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight text-gray-900">
                        {data.result.verdict === "VERIFIED"
                          ? "CLAIM VERIFIED"
                          : data.result.verdict === "REFUTED"
                          ? "CLAIM REFUTED"
                          : "INCONCLUSIVE / UNVERIFIED"}
                      </h2>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mt-0.5">
                        Verification Status
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-2xl font-black text-gray-900">
                      {data.result.truthRating}%
                    </div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Truth Score
                    </p>
                  </div>
                </div>

                {/* Truth Score Progress Bar */}
                <div className="mt-4 h-2.5 w-full rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      data.result.verdict === "VERIFIED"
                        ? "bg-green-600"
                        : data.result.verdict === "REFUTED"
                        ? "bg-red-600"
                        : "bg-amber-500"
                    }`}
                    style={{ width: `${data.result.truthRating}%` }}
                  />
                </div>

                <div className="mt-5 border-t border-gray-200/60 pt-4">
                  <h3 className="text-sm font-semibold text-gray-900">Verification Rationale</h3>
                  <p className="mt-1 text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">
                    {data.result.reasoning}
                  </p>
                </div>
              </div>

              {/* Supporting Evidence */}
              {data.result.supportingEvidence.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <span className="text-green-600">✓</span> Supporting Evidence
                  </h3>
                  <div className="mt-3 space-y-3">
                    {data.result.supportingEvidence.map((item, idx) => (
                      <div key={idx} className="rounded-xl border border-green-200 bg-white p-4 shadow-sm">
                        <p className="text-sm text-gray-900 font-medium">{item.claim}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.sourceIds.map((id) => {
                            const source = sourceFor(id);
                            return source ? (
                              <a
                                key={id}
                                href={source.url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded bg-green-50 border border-green-200 px-2 py-0.5 text-xs text-green-700 underline hover:bg-green-100"
                              >
                                [{id}] {source.title}
                              </a>
                            ) : null;
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contradicting Evidence */}
              {data.result.contradictingEvidence.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <span className="text-red-600">✗</span> Contradicting Evidence / Disproof
                  </h3>
                  <div className="mt-3 space-y-3">
                    {data.result.contradictingEvidence.map((item, idx) => (
                      <div key={idx} className="rounded-xl border border-red-200 bg-white p-4 shadow-sm">
                        <p className="text-sm text-gray-900 font-medium">{item.claim}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.sourceIds.map((id) => {
                            const source = sourceFor(id);
                            return source ? (
                              <a
                                key={id}
                                href={source.url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded bg-red-50 border border-red-200 px-2 py-0.5 text-xs text-red-700 underline hover:bg-red-100"
                              >
                                [{id}] {source.title}
                              </a>
                            ) : null;
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* TOPIC RESEARCH MODE DISPLAY */
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Synthesized Web Answer</h2>
                <div className="mt-3 rounded-xl bg-gray-50 p-5 border border-gray-200 leading-relaxed text-gray-800 whitespace-pre-wrap">
                  {data.result.answer}
                </div>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900">Key Findings & Grounded Claims</h2>

                {data.result.findings.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500">
                    No explicit claims were found in the retrieved web sources.
                  </p>
                ) : (
                  <div className="mt-4 space-y-4">
                    {data.result.findings.map((finding, index) => (
                      <article key={index} className="rounded-xl border p-5 shadow-sm bg-white">
                        <p className="font-medium text-gray-900">{finding.claim}</p>

                        <div className="mt-3 flex items-center justify-between">
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wider ${
                              finding.confidence === "high"
                                ? "bg-green-100 text-green-800"
                                : finding.confidence === "medium"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            Confidence: {finding.confidence}
                          </span>

                          <div className="flex flex-wrap gap-2">
                            {finding.sourceIds.map((id) => {
                              const source = sourceFor(id);
                              if (!source) return null;
                              return (
                                <a
                                  key={id}
                                  href={source.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-blue-600 underline hover:bg-gray-200"
                                >
                                  [{id}] {source.title}
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sources Consulted List */}
          <div>
            <h2 className="text-xl font-bold text-gray-900">Web Sources Consulted</h2>
            <ul className="mt-3 divide-y divide-gray-100 rounded-xl border bg-white p-2 shadow-sm">
              {data.sourceMetadata.map((source) => (
                <li key={source.id} className="p-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <span className="rounded-md bg-black px-2 py-0.5 text-xs font-bold text-white shrink-0">
                      {source.id}
                    </span>
                    <span className="font-medium text-sm text-gray-900 truncate">
                      {source.title}
                    </span>
                  </div>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-4 shrink-0 text-xs text-blue-600 underline font-medium"
                  >
                    View Source ↗
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Scope & Limitations */}
          {data.result.limitations.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900">Scope & Limitations</h2>

              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700">
                {data.result.limitations.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </main>
  );
}