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

    const isCodeQuery =
      /\b(code|github|git|repo|repository|npm|library|sdk|package|script|programming)\b/i.test(
        query
      );

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
        if (
          cleanUrl.startsWith("http") &&
          !cleanUrl.includes("duckduckgo.com/y.js") &&
          !cleanUrl.includes("bing.com/aclick") &&
          !cleanUrl.includes("ad_domain=") &&
          (!cleanUrl.includes("github.com") || isCodeQuery) &&
          !urls.includes(cleanUrl)
        ) {
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

export const UNIVERS_CLIENT_ENTITIES: Record<
  string,
  { fullName: string; contextTerms: string[] }
> = {
  mtl: {
    fullName: "Modern Terminals Limited",
    contextTerms: [
      "Modern Terminals Limited",
      "Modern Terminals Group",
      "modernterminals.com",
    ],
  },
  hactl: {
    fullName: "Hong Kong Air Cargo Terminals",
    contextTerms: [
      "Hong Kong Air Cargo Terminals Limited",
      "HACTL SuperTerminal 1",
      "hactl.com",
    ],
  },
  hit: {
    fullName: "Hongkong International Terminals",
    contextTerms: ["Hongkong International Terminals", "HIT Hutchison Ports"],
  },
  aahk: {
    fullName: "Airport Authority Hong Kong",
    contextTerms: ["Airport Authority Hong Kong", "HKIA", "Hong Kong Airport"],
  },
  hkia: {
    fullName: "Hong Kong International Airport",
    contextTerms: ["Hong Kong International Airport", "Airport Authority"],
  },
  clp: {
    fullName: "CLP Power Hong Kong",
    contextTerms: ["CLP Power Hong Kong", "CLP Group energy"],
  },
  hec: {
    fullName: "Hongkong Electric Company",
    contextTerms: ["Hongkong Electric", "HK Electric"],
  },
  mtr: {
    fullName: "MTR Corporation",
    contextTerms: ["MTR Corporation", "MTR Hong Kong"],
  },
  swire: {
    fullName: "Swire Properties",
    contextTerms: ["Swire Properties", "Swire Pacific sustainability"],
  },
  shkp: {
    fullName: "Sun Hung Kai Properties",
    contextTerms: ["Sun Hung Kai Properties", "SHKP"],
  },
  hld: {
    fullName: "Henderson Land Development",
    contextTerms: ["Henderson Land Development", "Henderson Land"],
  },
  psa: {
    fullName: "PSA International",
    contextTerms: ["PSA International port terminals", "PSA Corporation"],
  },
  "link reit": {
    fullName: "Link Real Estate Investment Trust",
    contextTerms: ["Link REIT", "Link Asset Management"],
  },
};

async function searchWikipediaSources(
  query: string,
  limit = 3
): Promise<string[]> {
  if (!query) return [];

  // If query is an acronym matching a Univers entity, search using the expanded full name
  let targetQuery = query;
  const lower = query.toLowerCase().trim();
  if (UNIVERS_CLIENT_ENTITIES[lower]) {
    targetQuery = UNIVERS_CLIENT_ENTITIES[lower].fullName;
  } else {
    for (const [key, ent] of Object.entries(UNIVERS_CLIENT_ENTITIES)) {
      const pattern = new RegExp(`\\b${key}\\b`, "i");
      if (pattern.test(lower)) {
        targetQuery = query.replace(pattern, ent.fullName);
        break;
      }
    }
  }

  try {
    const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      targetQuery
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
  // Normalize possessives like MTL's or HACTL's to MTL / HACTL
  const normalized = query.replace(/['’]s\b/gi, "");
  const clean = normalized.replace(/[^\w\s]/g, " ");

  // Check for Univers client / facility entity acronyms and inject high-yield queries
  const lowerQuery = normalized.toLowerCase();
  for (const [key, entity] of Object.entries(UNIVERS_CLIENT_ENTITIES)) {
    const pattern = new RegExp(`\\b${key}\\b`, "i");
    if (pattern.test(lowerQuery)) {
      const rest = normalized.replace(pattern, "").replace(/\s+/g, " ").trim();
      candidates.push(`"${entity.fullName}" sustainability report`);
      candidates.push(`"${entity.fullName}" ${rest}`.trim());
      candidates.push(`"${entity.fullName}" energy electricity HVAC`);
      candidates.push(`"${entity.fullName}" decarbonization emissions`);
    }
  }

  // Clean keywords without conversational fillers
  const stopwords = new Set([
    "research", "find", "come", "up", "with", "a", "number", "for", "their",
    "and", "the", "of", "in", "to", "about", "give", "me", "tell", "what", "is", "how", "does",
    "do", "look", "into", "search", "investigate", "show", "can", "you", "please", "information", "on"
  ]);
  const words = clean
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopwords.has(w.toLowerCase()));

  if (words.length > 0) {
    const fullClean = words.join(" ");
    candidates.push(fullClean);

    // If query has 3 or more keywords, also try the primary 2-word prefix (e.g. "MTL HVAC")
    if (words.length >= 3) {
      candidates.push(words.slice(0, 2).join(" "));
    }

    // Expand common technical/operational variations (e.g. HVAC -> energy / electricity)
    const lowerClean = fullClean.toLowerCase();
    if (lowerClean.includes("hvac")) {
      candidates.push(fullClean.replace(/hvac/gi, "energy"));
      candidates.push(fullClean.replace(/hvac/gi, "electricity"));
    }
    if (lowerClean.includes("consumption")) {
      candidates.push(fullClean.replace(/consumption/gi, "sustainability"));
      candidates.push(fullClean.replace(/consumption/gi, "reduction"));
    }
  }

  // Direct original query
  if (!candidates.includes(query)) {
    candidates.push(query);
  }

  return Array.from(new Set(candidates)).filter(Boolean);
}

const PAYWALLED_DOMAINS = [
  "sciencedirect.com",
  "springer.com",
  "wiley.com",
  "tandfonline.com",
  "ieeexplore.ieee.org",
  "cell.com",
  "thelancet.com",
  "nejm.org",
  "academic.oup.com",
];

async function searchOpenAlexSources(
  query: string,
  limit = 3
): Promise<string[]> {
  if (!query) return [];
  try {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(
      query
    )}&per-page=${limit * 2}&sort=relevance_score:desc`;

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
        const isPaywalled = PAYWALLED_DOMAINS.some((domain) =>
          targetUrl.toLowerCase().includes(domain)
        );
        if (!isPaywalled && !urls.includes(targetUrl)) {
          urls.push(targetUrl);
        }
      }
      if (urls.length >= limit) break;
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

    const isCodeQuery =
      /\b(code|github|git|repo|repository|npm|library|sdk|package|script|programming)\b/i.test(
        query
      );

    for (const hit of hits) {
      const targetUrl =
        hit.url ||
        (hit.objectID ? `https://news.ycombinator.com/item?id=${hit.objectID}` : null);

      if (
        targetUrl &&
        typeof targetUrl === "string" &&
        (!targetUrl.includes("github.com") || isCodeQuery) &&
        (!targetUrl.includes("gitlab.com") || isCodeQuery) &&
        !urls.includes(targetUrl)
      ) {
        urls.push(targetUrl);
      }
    }

    return urls;
  } catch {
    return [];
  }
}

export async function searchWebSources(
  query: string,
  limit = 6
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

    // 3. Wikipedia API (Most reliable, free, comprehensive encyclopedic reference)
    if (urls.length < limit) {
      const wiki = await searchWikipediaSources(q, 3);
      for (const u of wiki) {
        if (isApprovedUrl(u) && !urls.includes(u)) urls.push(u);
      }
    }

    // 4. OpenAlex Scholarly API (Free open-access scientific & academic studies)
    if (urls.length < limit) {
      const openAlex = await searchOpenAlexSources(q, 3);
      for (const u of openAlex) {
        if (isApprovedUrl(u) && !urls.includes(u)) urls.push(u);
      }
    }

    // 5. DuckDuckGo HTML scraper fallback
    if (urls.length < limit) {
      const ddgHtml = await searchDDGHtml(q);
      for (const u of ddgHtml) {
        if (isApprovedUrl(u) && !urls.includes(u)) urls.push(u);
      }
    }

    // 6. DuckDuckGo API fallback
    if (urls.length < limit) {
      const ddgApi = await searchDDGApi(q);
      for (const u of ddgApi) {
        if (isApprovedUrl(u) && !urls.includes(u)) urls.push(u);
      }
    }

    // 7. Hacker News (Algolia API) fallback for tech discussions & web articles
    if (urls.length < limit) {
      const hn = await searchHackerNewsSources(q, 3);
      for (const u of hn) {
        if (isApprovedUrl(u) && !urls.includes(u)) urls.push(u);
      }
    }
  }

  return urls.slice(0, limit);
}