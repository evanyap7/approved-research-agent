import * as cheerio from "cheerio";
import TurndownService from "turndown";
import { isApprovedUrl } from "./sources";

const MAX_CHARS_PER_SOURCE = 25_000;
const FETCH_TIMEOUT_MS = 15_000;

export type SourcePacket = {
  id: string;
  title: string;
  url: string;
  text: string;
};

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

// Configure Turndown rules to strip noise elements cleanly
turndownService.remove(["script", "style", "noscript", "iframe", "svg", "nav", "footer"]);

async function parsePdfBuffer(buffer: Buffer): Promise<string> {
  try {
    if (typeof globalThis.DOMMatrix === "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).DOMMatrix = class DOMMatrix {};
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PDFParse } = require("pdf-parse");
    const uint8 = new Uint8Array(buffer);
    const p = new PDFParse(uint8);
    await p.load();
    const res = await p.getText();
    return (res.text || String(res)).replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

async function fetchBufferWithTimeout(
  targetUrl: string,
  redirectCount = 0
): Promise<{ status: number; contentType: string; buffer: Buffer }> {
  if (redirectCount > 5) {
    throw new Error("Too many redirects");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeoutId);

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get("content-type") || "";

    return {
      status: response.status,
      contentType,
      buffer,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Timeout fetching ${targetUrl}`);
    }
    throw error;
  }
}

export async function fetchApprovedSource(
  url: string,
  id: string
): Promise<SourcePacket> {
  if (!isApprovedUrl(url)) {
    throw new Error("This URL is not from an approved source.");
  }

  const { status, contentType, buffer } = await fetchBufferWithTimeout(url);

  if (status < 200 || status >= 300) {
    throw new Error(`Could not retrieve source (${url}): ${status}`);
  }

  let title = "Web Source";
  let text = "";

  // Handle PDF files directly
  if (
    contentType.includes("application/pdf") ||
    url.toLowerCase().endsWith(".pdf")
  ) {
    title = `PDF Document (${url.split("/").pop() || "Report"})`;
    text = await parsePdfBuffer(buffer);
  } else {
    // Handle HTML pages
    const html = buffer.toString("utf8");
    const $ = cheerio.load(html);

    // Extract attached PDF links on landing pages (e.g. Sustainability reports)
    const pdfLinks: string[] = [];
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      if (href.toLowerCase().includes(".pdf")) {
        try {
          const fullPdfUrl = new URL(href, url).toString();
          if (isApprovedUrl(fullPdfUrl) && !pdfLinks.includes(fullPdfUrl)) {
            pdfLinks.push(fullPdfUrl);
          }
        } catch {
          // ignore invalid URLs
        }
      }
    });

    title = $("title").first().text().trim() || "Untitled source";

    // Clean up unnecessary boilerplate before markdown conversion
    $(
      "script, style, noscript, svg, iframe, nav, footer, header, .mw-editsection, .reflist, .navbox, #mw-navigation, #siteSub, #contentSub, .ads, .cookie-banner"
    ).remove();

    const mainHtml = $("main").length ? $("main").html() : $("body").html();
    
    if (mainHtml) {
      try {
        text = turndownService.turndown(mainHtml).trim();
      } catch {
        text = $("body").text().replace(/\s+/g, " ").trim();
      }
    } else {
      text = $("body").text().replace(/\s+/g, " ").trim();
    }

    // If page links to attached PDFs, parse top PDF text and append
    if (pdfLinks.length > 0) {
      for (const pdfUrl of pdfLinks.slice(0, 2)) {
        try {
          const pdfRes = await fetchBufferWithTimeout(pdfUrl);
          if (pdfRes.status >= 200 && pdfRes.status < 300) {
            const pdfText = await parsePdfBuffer(pdfRes.buffer);
            if (pdfText.length > 100) {
              text += `\n\n### [Attached Report PDF (${pdfUrl})]:\n` + pdfText;
            }
          }
        } catch {
          // ignore PDF fetch failures
        }
      }
    }
  }

  text = text.slice(0, MAX_CHARS_PER_SOURCE);

  if (text.length < 50) {
    throw new Error("The source did not contain enough readable text.");
  }

  return { id, title, url, text };
}