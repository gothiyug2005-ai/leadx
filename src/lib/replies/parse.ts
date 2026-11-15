/** Parsing Gmail API messages into what LeadX needs. Pure functions, easy to test. */

export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailPart {
  mimeType?: string | null;
  headers?: GmailHeader[] | null;
  body?: { data?: string | null } | null;
  parts?: GmailPart[] | null;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  internalDate?: string | null;
  snippet?: string | null;
  labelIds?: string[] | null;
  payload?: GmailPart | null;
}

export function header(message: GmailMessage, name: string): string | null {
  const lower = name.toLowerCase();
  return (
    message.payload?.headers?.find(
      (entry) => entry.name.toLowerCase() === lower,
    )?.value ?? null
  );
}

/** "Priya Raman <priya@acme.com>" -> { name: "Priya Raman", email: "priya@acme.com" } */
export function parseAddress(value: string | null): {
  name: string | null;
  email: string | null;
} {
  if (!value) return { name: null, email: null };
  const angled = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(value);
  if (angled)
    return {
      name: angled[1]?.trim() || null,
      email: angled[2]!.trim().toLowerCase(),
    };
  const bare = /([^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)/.exec(value);
  return { name: null, email: bare?.[1]?.toLowerCase() ?? null };
}

function decodeBase64Url(data: string): string {
  return Buffer.from(
    data.replace(/-/g, "+").replace(/_/g, "/"),
    "base64",
  ).toString("utf8");
}

function findPart(
  part: GmailPart | null | undefined,
  mimeType: string,
): GmailPart | null {
  if (!part) return null;
  if (part.mimeType === mimeType && part.body?.data) return part;
  for (const child of part.parts ?? []) {
    const found = findPart(child, mimeType);
    if (found) return found;
  }
  return null;
}

function htmlToPlain(html: string): string {
  return html
    .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"');
}

/** The readable text of a message: plain text if there is one, otherwise the HTML stripped. */
export function bodyText(message: GmailMessage): string {
  const plain = findPart(message.payload, "text/plain");
  if (plain?.body?.data) return decodeBase64Url(plain.body.data);
  const html = findPart(message.payload, "text/html");
  if (html?.body?.data) return htmlToPlain(decodeBase64Url(html.body.data));
  return message.snippet ?? "";
}

/** Drop the quoted earlier conversation so only the new reply is kept. */
export function stripQuoted(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const kept: string[] = [];
  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    if (
      /^On .+wrote:$/i.test(trimmed) ||
      (/^On .+$/i.test(trimmed) && /wrote:\s*$/i.test(lines[index + 1] ?? ""))
    )
      break;
    if (/^-{2,}\s*Original Message\s*-{2,}/i.test(trimmed)) break;
    if (/^From:\s.+/i.test(trimmed) && kept.length > 0) break;
    if (trimmed.startsWith(">")) continue;
    kept.push(line);
  }
  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type InboundKind = "human" | "auto_reply" | "bounce";

/** Bounces and out-of-office replies must not stop a sequence or count as a reply. */
export function classifyKind(message: GmailMessage): InboundKind {
  const from = (header(message, "From") ?? "").toLowerCase();
  const subject = (header(message, "Subject") ?? "").toLowerCase();
  if (
    /mailer-daemon|postmaster/.test(from) ||
    /delivery status notification|undeliverable|delivery has failed|returned mail|failure notice/.test(
      subject,
    )
  ) {
    return "bounce";
  }
  const autoSubmitted = (header(message, "Auto-Submitted") ?? "").toLowerCase();
  if (
    (autoSubmitted && autoSubmitted !== "no") ||
    header(message, "X-Autoreply") ||
    header(message, "X-Autorespond") ||
    /^(auto(matic)?[- ]?reply|out of (the )?office|ooo\b|away from|on leave|vacation)/.test(
      subject.replace(/^(re|aw):\s*/, ""),
    )
  ) {
    return "auto_reply";
  }
  return "human";
}

/** The failed address in a bounce, so it can be marked invalid. */
export function bouncedAddress(
  message: GmailMessage,
  text: string,
): string | null {
  const failed = header(message, "X-Failed-Recipients");
  if (failed) return failed.split(",")[0]!.trim().toLowerCase();
  return (
    /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i.exec(text)?.[1]?.toLowerCase() ??
    null
  );
}

export function sentAt(message: GmailMessage): Date {
  const ms = Number(message.internalDate);
  return Number.isFinite(ms) && ms > 0 ? new Date(ms) : new Date();
}
