import https from "node:https";

export function isApprovedUrl(value: string): boolean {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return false;
    }

    const host = url.hostname.toLowerCase();

    // SSRF Guard: Block localhost & private IP ranges
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      host.startsWith("172.16.") ||
      host.startsWith("172.17.") ||
      host.startsWith("172.18.") ||
      host.startsWith("172.19.") ||
      host.startsWith("172.20.") ||
      host.startsWith("172.31.") ||
      host.endsWith(".local") ||
      host.endsWith(".internal")
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function searchDDGApi(query: string): Promise<string[]> {
  return new Promise((resolve) => {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`;
    https.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
        timeout: 6000,
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            const urls: string[] = [];
            if (parsed.AbstractURL) urls.push(parsed.AbstractURL);
            if (parsed.Results) {
              for (const r of parsed.Results) {
                if (r.FirstURL) urls.push(r.FirstURL);
              }
            }
            if (parsed.RelatedTopics) {
              for (const t of parsed.RelatedTopics) {
                if (t.FirstURL) urls.push(t.FirstURL);
              }
            }
            resolve(urls);
          } catch {
            resolve([]);
          }
        });
      }
    ).on("error", () => resolve([]));
  });
}

function searchWikipediaSources(query: string, limit = 3): Promise<string[]> {
  return new Promise((resolve) => {
    if (!query) return resolve([]);
    const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query
    )}&format=json&srlimit=${limit}`;

    const req = https.get(
      apiUrl,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
        timeout: 6000,
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            const searchResults = parsed.query?.search || [];
            const urls = searchResults.map(
              (item: { title: string }) =>
                `https://en.wikipedia.org/wiki/${encodeURIComponent(
                  item.title.replace(/ /g, "_")
                )}`
            );
            resolve(urls);
          } catch {
            resolve([]);
          }
        });
      }
    );

    req.on("timeout", () => {
      req.destroy();
      resolve([]);
    });

    req.on("error", () => {
      resolve([]);
    });
  });
}

function generateCandidateQueries(query: string): string[] {
  const candidates: string[] = [];
  const clean = query.replace(/[^\w\s]/g, " ");

  // 1. Direct original query
  candidates.push(query);

  // 2. Main nouns without conversational fillers
  const stopwords = new Set([
    "research", "find", "come", "up", "with", "a", "number", "for", "their",
    "and", "the", "of", "in", "to", "about", "give", "me", "tell", "what", "is"
  ]);
  const words = clean
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopwords.has(w.toLowerCase()));

  if (words.length > 0) candidates.push(words.join(" "));
  if (words.length >= 2) candidates.push(words.slice(0, 2).join(" "));
  if (words.length >= 1) candidates.push(words[0]);

  return Array.from(new Set(candidates)).filter(Boolean);
}

export async function searchWebSources(
  query: string,
  limit = 4
): Promise<string[]> {
  const urls: string[] = [];
  const candidateQueries = generateCandidateQueries(query);

  for (const q of candidateQueries) {
    if (urls.length >= limit) break;

    try {
      const ddgUrls = await searchDDGApi(q);
      for (const u of ddgUrls) {
        if (isApprovedUrl(u) && !urls.includes(u)) urls.push(u);
      }
    } catch {
      // ignore
    }

    if (urls.length < limit) {
      try {
        const wikiUrls = await searchWikipediaSources(q, limit);
        for (const u of wikiUrls) {
          if (isApprovedUrl(u) && !urls.includes(u)) urls.push(u);
        }
      } catch {
        // ignore
      }
    }
  }

  return urls.slice(0, limit);
}