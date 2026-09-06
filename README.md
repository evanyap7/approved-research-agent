# AI Research Agent

A source-grounded AI research application that answers questions using only a controlled collection of approved webpages. It produces concise research notes with source-level citations, structured findings, and transparent limitations when the available evidence is incomplete.

Built as an independent full-stack project with Next.js, TypeScript, the Vercel AI SDK, Groq LPU (Open-Source Models), Google Gemini, Zod, Cheerio, and Vercel.

## Why This Project Exists

General-purpose AI answers can be difficult to verify because sources may be missing, unreliable, or outside an intended research scope.

This project addresses that problem by constraining the research pipeline to a predefined allowlist of approved sources. The assistant does not treat the open web as its evidence base. Instead, it retrieves, extracts, normalizes, and synthesizes information only from authorized webpages.

The result is a research workflow designed around:

- Source control
- Traceability
- Structured output
- Evidence limitations
- Clear citations

## Features

- Accepts natural-language research questions
- Retrieves content only from approved webpages
- Extracts and normalizes webpage text with Cheerio
- Uses Groq LPUs (`openai/gpt-oss-120b`) for ultra-fast, free open-source synthesis (with Gemini fallback)
- Generates structured research notes instead of unbounded chat responses
- Includes source-level citations and clickable links
- Identifies evidence gaps and limitations explicitly
- Displays asynchronous loading, success, and error states
- Provides a responsive interface built with Next.js, React, TypeScript, and Tailwind CSS
- Runs as a serverless deployment on Vercel

## Tech Stack

| Area | Technologies |
| --- | --- |
| Frontend | Next.js, React, TypeScript, Tailwind CSS |
| Backend | Next.js Route Handlers, Node.js |
| AI Inference | Groq LPU (`@ai-sdk/groq`), Google Gemini (`@ai-sdk/google`) |
| Validation | Zod |
| Web Extraction | Cheerio |
| Deployment | Vercel |

## Architecture

```text
User Research Question
        |
        v
Next.js / React Interface
        |
        v
Next.js Route Handler
        |
        +--> Validate request with Zod
        |
        +--> Retrieve approved source pages only
        |
        +--> Extract normalized text with Cheerio
        |
        +--> Send approved evidence to Gemini via Vercel AI SDK
        |
        +--> Validate structured research response
        |
        v
Research Notes UI
  - Summary
  - Findings
  - Confidence
  - Limitations
  - Source citations
```

## Research Workflow

1. A user submits a research question.
2. The application identifies the relevant approved webpages.
3. Server-side code retrieves and extracts readable webpage content.
4. Cheerio normalizes webpage HTML into usable text.
5. The approved source content is provided to Gemini as the evidence context.
6. Gemini generates a structured response based only on the supplied evidence.
7. The interface renders findings, limitations, and source-level citations.

## Evidence Policy

The project follows a controlled-source approach:

- Answers are grounded in the approved source collection.
- The model is instructed not to treat unsupported claims as facts.
- Sources are shown alongside generated findings.
- The application should disclose when approved sources do not contain enough evidence to answer a question fully.
- The app prioritizes evidence traceability over broad, unsupported answers.

## Structured Output

Research responses are designed to include:

```text
Research question
Summary
Key findings
Confidence or evidence strength
Limitations
Approved sources used
Source-level citations
```

This structure makes it easier for users to distinguish between supported conclusions and areas where more evidence is needed.

## Local Setup

### Prerequisites

- Node.js 18 or later
- npm
- A Groq API key (free at https://console.groq.com) or Google Gemini API key

### Installation

Clone the repository:

```bash
git clone https://github.com/evanyap7/approved-research-agent.git
cd approved-research-agent
```

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Add your environment variables:

```env
# Free Open-Source Inference via Groq LPUs (Recommended)
GROQ_API_KEY=gsk_your_groq_api_key

# Optional fallback to Gemini
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `GROQ_API_KEY` | (Recommended) Authenticates requests to Groq Cloud for free open-source models (`openai/gpt-oss-120b`) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Authenticates fallback requests to the Google Gemini API (`gemini-3.6-flash`) |

Never commit `.env.local` or API keys to source control.

## Deployment

This project is designed for deployment on Vercel.

```bash
npm run build
```

Then push changes to the production branch connected to Vercel:

```bash
git add .
git commit -m "Deploy AI research agent"
git push
```

Vercel will build and deploy the application automatically.

## Future Improvements

- Add a source-management dashboard for maintaining approved webpages
- Cache extracted webpage content to reduce repeated retrieval work
- Add source freshness timestamps
- Add exportable research notes in Markdown or PDF
- Add user authentication and saved research history
- Support multiple research collections for different domains
- Add automated evaluation for citation completeness and claim grounding

## Resume Highlights

- Built a source-grounded AI research system that limits generation to an approved collection of webpages, improving answer traceability and evidence control.
- Engineered a server-side research pipeline with Next.js Route Handlers, Cheerio, Zod, Gemini, and the Vercel AI SDK.
- Designed a responsive research interface with structured findings, evidence limitations, confidence indicators, and source-level citations.
