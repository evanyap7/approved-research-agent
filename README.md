# AI Research Agent

A source-grounded research tool for energy engineers and decarbonisation consultants. For each question it retrieves public webpages and PDFs, extracts their text, and answers using only that retrieved material, with source-level citations, structured findings and an explicit list of limitations.

Live: <https://approved-research-agent.vercel.app>

Built as an independent full-stack project with Next.js, TypeScript, the Vercel AI SDK, Groq (open-source models) with a Gemini fallback, Zod and Cheerio, and deployed on Vercel.

> The repository name is historical. The app does **not** restrict itself to a fixed list of approved sites; see [How sources are chosen](#how-sources-are-chosen).

## What it does

- **Facility due diligence.** Ask a question about a client facility and get a cited research brief: summary, findings with confidence, and limitations.
- **ESG claim verification.** Paste a claim and get a verdict (`VERIFIED`, `REFUTED` or `UNVERIFIED`), a 0-100 truth rating, supporting and contradicting evidence, and limitations.
- **Preset practice areas** for ports and terminals, HVAC and chiller plants, commercial real estate, SBTi decarbonisation targets, and renewables and microgrids.

## How sources are chosen

1. **Your URLs, if you give any.** When custom URLs are supplied, only those are fetched, after validation.
2. **Otherwise, search.** The app builds search queries from the question and runs them through Tavily or Serper when a key is set, falling back to DuckDuckGo, and can also draw on OpenAlex for academic work. If the question names one of 13 mapped client entities (for example MTL, HACTL or AAHK), it adds targeted `site:` queries for that entity's official domain and seeds known report URLs.
3. **Rank and fetch.** Candidates are scored: the matched client's official domain first, then PDFs, then sustainability, ESG and energy pages, and reports. Code repositories and staging sites are filtered out. Up to 5 are fetched in parallel. HTML is converted to markdown, PDFs are parsed (first 20 pages), JavaScript-heavy pages fall back to Jina Reader, and each source is trimmed to 30,000 characters.
4. **Keep the first 4 readable sources**, labelled `S1` to `S4`.

Because search results decide what is retrieved, source quality varies. The interface lists every retrieved source so the reader can judge it.

## Safeguards

- **Evidence only.** The model is told to use only the supplied source packets. In code, any finding that cites an ID that was not supplied is dropped before it reaches the interface.
- **Untrusted text.** Retrieved pages are treated as untrusted reference material, and the model is instructed to ignore instructions found inside them.
- **Request validation.** Requests are validated with Zod. Private, loopback, link-local and cloud-metadata addresses are blocked (SSRF protection).
- **Limitations are part of the schema.** Every response must state what the evidence does not cover.
- **Bounded retrieval.** Each fetch has a 6-second timeout and a size cap.

## Known limitations

- There is no allowlist mode, so nothing guarantees a source is official or reliable.
- The truth rating is the model's judgement of the retrieved text. It is not a calibrated probability.
- Citation accuracy is not yet measured by an automated evaluation.
- Search depends on third-party services, so results can vary between runs.

## Tech stack

| Area | Technologies |
| --- | --- |
| Frontend | Next.js 16, React, TypeScript, Tailwind CSS, react-markdown |
| Backend | Next.js Route Handlers, Node.js |
| AI inference | Groq (`@ai-sdk/groq`, `openai/gpt-oss-120b`), Google Gemini fallback (`@ai-sdk/google`) |
| Validation | Zod |
| Extraction | Cheerio, Turndown, pdf-parse, Jina Reader fallback |
| Retrieval | Tavily, Serper, DuckDuckGo, OpenAlex |
| Safety | ipaddr.js for address checks |
| Deployment | Vercel |

## Architecture

```text
Question (+ optional URLs, mode)
        |
        v
Route handler: validate with Zod
        |
        +--> Resolve known client names to official domains
        +--> Search (Tavily / Serper / DuckDuckGo / OpenAlex) or use supplied URLs
        +--> Rank candidates, fetch up to 5, keep the first 4 readable
        +--> Extract text (HTML, PDF, Jina Reader fallback)
        |
        v
Model call (Groq, Gemini fallback) with the sources as untrusted context
        |
        v
Validate structured output, drop findings that cite unknown sources
        |
        v
UI: brief or verdict, findings, confidence, limitations, sources
```

## Local setup

### Prerequisites

- Node.js 20.9 or later (required by Next.js 16)
- npm
- A free Groq API key (<https://console.groq.com>) or a Google Gemini API key

### Install and run

```bash
git clone https://github.com/evanyap7/approved-research-agent.git
cd approved-research-agent
npm install
cp .env.example .env.local   # then add your keys
npm run dev
```

Open <http://localhost:3000>.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `GROQ_API_KEY` | Recommended. Runs `openai/gpt-oss-120b` on Groq. |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Fallback. Runs `gemini-3.6-flash` when no Groq key is set. |
| `TAVILY_API_KEY` | Optional search provider. |
| `SERPER_API_KEY` | Optional search provider. |

Never commit `.env.local` or API keys.

## Deployment

The app deploys to Vercel. Pushing to the production branch triggers a build. Check a build locally with `npm run build`.

## Future improvements

- An optional allowlist mode that restricts retrieval to configured domains.
- An automated evaluation of citation completeness and claim grounding.
- Caching extracted pages and showing source freshness timestamps.
- Exportable research notes in Markdown or PDF.
- Saved research history with authentication.
