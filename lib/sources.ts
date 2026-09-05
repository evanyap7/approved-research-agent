import * as cheerio from "cheerio";
import ipaddr from "ipaddr.js";

export function isApprovedUrl(value: string): boolean {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return false;
    }

    const host = url.hostname.toLowerCase();

    // Check domain extensions / hostnames known to be internal/private
    if (
      host === "localhost" ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      host.endsWith(".lan") ||
      host === "metadata.google.internal"
    ) {
      return false;
    }

    // Try parsing as IP address (v4 or v6) using ipaddr.js
    if (ipaddr.isValid(host)) {
      const addr = ipaddr.parse(host);
      const rangeName = addr.range() as string;

      // Block non-unicast or private IP ranges
      if (
        rangeName === "loopback" ||
        rangeName === "private" ||
        rangeName === "linkLocal" ||
        rangeName === "broadcast" ||
        rangeName === "carrierGradeNat" ||
        rangeName === "carrierNat" ||
        rangeName === "unspecified" ||
        rangeName === "reserved" ||
        rangeName === "multicast"
      ) {
        return false;
      }
    }

    // Block cloud metadata IP explicitly
    if (host === "169.254.169.254") {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

async function searchTavilyApi(query: string, limit = 4): Promise<string[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: limit,
        search_depth: "basic",
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data.results)) {
      return data.results
        .map((r: { url?: string }) => r.url)
        .filter((u: unknown): u is string => typeof u === "string");
    }
  } catch {
    // ignore fetch error
  }
  return [];
}

async function searchSerperApi(query: string, limit = 4): Promise<string[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: limit }),
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data.organic)) {
      return data.organic
        .map((r: { link?: string }) => r.link)
        .filter((u: unknown): u is string => typeof u === "string");
    }
  } catch {
    // ignore
  }
  return [];
}

async function searchDDGHtml(query: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(6000),
      }
    );

    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    const urls: string[] = [];

    $(".result__url, .result__a, .result__snippet").each((_, el) => {
      const href = $(el).attr("href");
      if (href) {
        let cleanUrl = href;
        if (cleanUrl.includes("uddg=")) {
          try {
            const parsed = new URL("https://duckduckgo.com" + cleanUrl);
            const uddg = parsed.searchParams.get("uddg");
            if (uddg) cleanUrl = decodeURIComponent(uddg);
          } catch {
            // ignore
          }
        }
        if (cleanUrl.startsWith("http") && !urls.includes(cleanUrl)) {
          urls.push(cleanUrl);
        }
      }
    });

    return urls;
  } catch {
    return [];
  }
}

async function searchDDGApi(query: string): Promise<string[]> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return [];
    const parsed = await res.json();
    const urls: string[] = [];
    if (parsed.AbstractURL) urls.push(parsed.AbstractURL);
    if (parsed.Results && Array.isArray(parsed.Results)) {
      for (const r of parsed.Results) {
        if (r.FirstURL) urls.push(r.FirstURL);
      }
    }
    if (parsed.RelatedTopics && Array.isArray(parsed.RelatedTopics)) {
      for (const t of parsed.RelatedTopics) {
        if (t.FirstURL) urls.push(t.FirstURL);
      }
    }
    return urls;
  } catch {
    return [];
  }
}

async function searchWikipediaSources(
  query: string,
  limit = 3
): Promise<string[]> {
  if (!query) return [];
  try {
    const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query
    )}&format=json&srlimit=${limit}`;

    const res = await fetch(apiUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return [];
    const parsed = await res.json();
    const searchResults = parsed.query?.search || [];
    return searchResults.map(
      (item: { title: string }) =>
        `https://en.wikipedia.org/wiki/${encodeURIComponent(
          item.title.replace(/ /g, "_")
        )}`
    );
  } catch {
    return [];
  }
}

function generateCandidateQueries(query: string): string[] {
  const candidates: string[] = [];
  const clean = query.replace(/[^\w\s]/g, " ");

  // 1. Direct original query
  candidates.push(query);

  // 2. Main nouns without conversational fillers
  const stopwords = new Set([
    "research", "find", "come", "up", "with", "a", "number", "for", "their",
    "and", "the", "of", "in", "to", "about", "give", "me", "tell", "what", "is", "how", "does"
  ]);
  const words = clean
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopwords.has(w.toLowerCase()));

  if (words.length > 0) candidates.push(words.join(" "));

  return Array.from(new Set(candidates)).filter(Boolean);
}

async function searchOpenAlexSources(
  query: string,
  limit = 3
): Promise<string[]> {
  if (!query) return [];
  try {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(
      query
    )}&per-page=${limit}&sort=relevance_score:desc`;

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "ApprovedResearchAgent/1.0 (mailto:research-agent@example.com)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return [];
    const parsed = await res.json();
    const results = parsed.results || [];
    const urls: string[] = [];

    for (const r of results) {
      const targetUrl =
        r.open_access?.oa_url ||
        r.primary_location?.pdf_url ||
        r.primary_location?.landing_page_url ||
        r.doi;

      if (targetUrl && typeof targetUrl === "string") {
        urls.push(targetUrl);
      }
    }

    return urls;
  } catch {
    return [];
  }
}

async function searchHackerNewsSources(
  query: string,
  limit = 3
): Promise<string[]> {
  if (!query) return [];
  try {
    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(
      query
    )}&tags=story&hitsPerPage=${limit}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return [];
    const parsed = await res.json();
    const hits = parsed.hits || [];
    const urls: string[] = [];

    for (const hit of hits) {
      if (hit.url && typeof hit.url === "string") {
        urls.push(hit.url);
      } else if (hit.objectID) {
        urls.push(`https://news.ycombinator.com/item?id=${hit.objectID}`);
      }
    }

    return urls;
  } catch {
    return [];
  }
}

export async function searchWebSources(
  query: string,
  limit = 4
): Promise<string[]> {
  const urls: string[] = [];
  const candidateQueries = generateCandidateQueries(query);

  for (const q of candidateQueries) {
    if (urls.length >= limit) break;

    // 1. Tavily API (if configured with API key)
    const tavily = await searchTavilyApi(q, limit);
    for (const u of tavily) {
      if (isApprovedUrl(u) && !urls.includes(u)) urls.push(u);
    }

    // 2. Serper API (if configured with API key)
    if (urls.length < limit) {
      const serper = await searchSerperApi(q, limit);
      for (const u of serper) {
        if (isApprovedUrl(u) && !urls.includes(u)) urls.push(u);
      }
    }

    // 3. OpenAlex Scholarly API (Completely free, open access catalog of 250M+ research works)
    if (urls.length < limit) {
      const openAlex = await searchOpenAlexSources(q, limit);
      for (const u of openAlex) {
        if (isApprovedUrl(u) && !urls.includes(u)) urls.push(u);
      }
    }

    // 4. DuckDuckGo HTML scraper fallback
    if (urls.length < limit) {
      const ddgHtml = await searchDDGHtml(q);
      for (const u of ddgHtml) {
        if (isApprovedUrl(u) && !urls.includes(u)) urls.push(u);
      }
    }

    // 5. DuckDuckGo API fallback
    if (urls.length < limit) {
      const ddgApi = await searchDDGApi(q);
      for (const u of ddgApi) {
        if (isApprovedUrl(u) && !urls.includes(u)) urls.push(u);
      }
    }

    // 6. Hacker News (Algolia API) fallback for tech discussions and referenced web articles
    if (urls.length < limit) {
      const hn = await searchHackerNewsSources(q, limit);
      for (const u of hn) {
        if (isApprovedUrl(u) && !urls.includes(u)) urls.push(u);
      }
    }

    // 7. Wikipedia API fallback
    if (urls.length < limit) {
      const wiki = await searchWikipediaSources(q, limit);
      for (const u of wiki) {
        if (isApprovedUrl(u) && !urls.includes(u)) urls.push(u);
      }
    }
  }

  return urls.slice(0, limit);
}