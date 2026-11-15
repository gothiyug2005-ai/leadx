import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { htmlToText, type PageText } from "./html-to-text";

export class FetchPageError extends Error {
  constructor(
    readonly code:
      | "invalid_url"
      | "blocked"
      | "unreachable"
      | "not_html"
      | "too_large"
      | "empty",
    message: string,
  ) {
    super(message);
    this.name = "FetchPageError";
  }
}

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

/** True for loopback, private, link-local, carrier-grade NAT and other non-public addresses. */
export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const parts = address.split(".").map(Number);
    const [a = 0, b = 0] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (version === 6) {
    const lower = address.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped?.[1]) return isPrivateAddress(mapped[1]);
    return (
      lower === "::" ||
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe8") ||
      lower.startsWith("fe9") ||
      lower.startsWith("fea") ||
      lower.startsWith("feb") ||
      lower.startsWith("ff")
    );
  }
  return true;
}

/** Only public http(s) URLs on standard ports, resolving to public addresses. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new FetchPageError(
      "invalid_url",
      "That does not look like a web address.",
    );
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new FetchPageError(
      "invalid_url",
      "Only http and https links are supported.",
    );
  }
  if (url.username || url.password) {
    throw new FetchPageError(
      "blocked",
      "Links with a username or password are not supported.",
    );
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new FetchPageError("blocked", "That link uses an unusual port.");
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host.endsWith(".local")
  ) {
    throw new FetchPageError(
      "blocked",
      "That address is not on the public internet.",
    );
  }
  const addresses = isIP(host)
    ? [host]
    : await lookup(host, { all: true, verbatim: true })
        .then((results) => results.map((entry) => entry.address))
        .catch(() => {
          throw new FetchPageError(
            "unreachable",
            "We could not find that website.",
          );
        });
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new FetchPageError(
      "blocked",
      "That address is not on the public internet.",
    );
  }
  return url;
}

/**
 * Fetch a public web page and return its readable text. Redirects are
 * followed by hand so every hop is checked against private addresses.
 */
export async function fetchPageText(
  rawUrl: string,
): Promise<PageText & { finalUrl: string }> {
  let url = await assertPublicUrl(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "user-agent":
            "Mozilla/5.0 (compatible; LeadXBot/1.0; job posting reader)",
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
        },
      });
    } catch {
      throw new FetchPageError(
        "unreachable",
        "That page did not respond. Paste the job text instead.",
      );
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) break;
      url = await assertPublicUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) {
      throw new FetchPageError(
        "unreachable",
        response.status === 401 ||
          response.status === 403 ||
          response.status === 999
          ? "That site does not let us read the page. Paste the job text instead."
          : "We could not open that page. Paste the job text instead.",
      );
    }

    const type = response.headers.get("content-type") ?? "";
    if (type && !/text\/html|application\/xhtml|text\/plain/i.test(type)) {
      throw new FetchPageError(
        "not_html",
        "That link is not a web page. Paste the job text instead.",
      );
    }
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES)
      throw new FetchPageError("too_large", "That page is too large to read.");

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES)
      throw new FetchPageError("too_large", "That page is too large to read.");
    const raw = new TextDecoder().decode(buffer);
    const page = /text\/plain/i.test(type)
      ? { title: null, text: raw.trim() }
      : htmlToText(raw);

    if (page.text.length < 200) {
      throw new FetchPageError(
        "empty",
        "We could not find the job description on that page (some sites need a browser). Paste the job text instead.",
      );
    }
    return { ...page, finalUrl: url.toString() };
  }

  throw new FetchPageError(
    "unreachable",
    "That link redirects too many times.",
  );
}
