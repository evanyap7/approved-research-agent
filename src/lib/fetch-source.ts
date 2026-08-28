import * as cheerio from "cheerio";
import https from "node:https";
import http from "node:http";
import { isApprovedUrl } from "./sources";

const MAX_CHARS_PER_SOURCE = 20_000;
const FETCH_TIMEOUT_MS = 15_000;

export type SourcePacket = {
  id: string;
  title: string;
  url: string;
  text: string;
};

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

function httpGetBuffer(
  targetUrl: string,
  redirectCount = 0
): Promise<{ status: number; contentType: string; buffer: Buffer }> {
  if (redirectCount > 5) {
    return Promise.reject(new Error("Too many redirects"));
  }

  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const client = parsed.protocol === "https:" ? https : http;

    const req = client.get(
      targetUrl,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        timeout: FETCH_TIMEOUT_MS,
      },
      (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          const redirectUrl = new URL(
            res.headers.location,
            targetUrl
          ).toString();
          res.resume();
          return httpGetBuffer(redirectUrl, redirectCount + 1).then(
            resolve,
            reject
          );
        }

        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode || 500,
            contentType: (res.headers["content-type"] as string) || "",
            buffer: Buffer.concat(chunks),
          });
        });
      }
    );

    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${targetUrl}`));
    });

    req.on("error", (err) => {
      reject(err);
    });
  });
}

export async function fetchApprovedSource(
  url: string,
  id: string
): Promise<SourcePacket> {
  if (!isApprovedUrl(url)) {
    throw new Error("This URL is not from an approved source.");
  }

  const { status, contentType, buffer } = await httpGetBuffer(url);

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

    $(
      "script, style, noscript, svg, iframe, nav, footer, header, .mw-editsection, .reflist, .navbox, #mw-navigation, #siteSub, #contentSub"
    ).remove();

    title = $("title").first().text().trim() || "Untitled source";
    text = $("body").text().replace(/\s+/g, " ").trim();

    // If page links to attached PDFs, parse top PDF text and append
    if (pdfLinks.length > 0) {
      for (const pdfUrl of pdfLinks.slice(0, 2)) {
        try {
          const pdfRes = await httpGetBuffer(pdfUrl);
          if (pdfRes.status >= 200 && pdfRes.status < 300) {
            const pdfText = await parsePdfBuffer(pdfRes.buffer);
            if (pdfText.length > 100) {
              text += `\n\n[Attached Report PDF (${pdfUrl})]:\n` + pdfText;
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