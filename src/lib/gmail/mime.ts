/**
 * Build a plain-text RFC 5322 message for the Gmail API. Header values are
 * stripped of line breaks so nothing can inject extra headers or recipients.
 */

export interface MimeInput {
  from: string;
  fromName?: string | null;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string | null;
  references?: string | null;
  date?: Date;
}

const ADDRESS =
  /^[^\s@<>()",;:\\[\]]+@[^\s@<>()",;:\\[\]]+\.[^\s@<>()",;:\\[\]]+$/;

export function sanitizeHeader(value: string): string {
  return value
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isPlainAddress(value: string): boolean {
  return ADDRESS.test(value);
}

/** RFC 2047 encoded-word for non-ASCII header text. */
export function encodeHeaderWord(value: string): string {
  const clean = sanitizeHeader(value);
  // Printable ASCII only can go as-is.
  if (/^[\x20-\x7e]*$/.test(clean)) return clean;
  return `=?UTF-8?B?${Buffer.from(clean, "utf8").toString("base64")}?=`;
}

function formatAddress(address: string, name?: string | null): string {
  if (!name) return address;
  const clean = sanitizeHeader(name).replace(/["\\]/g, "");
  return /^[\x20-\x7e]*$/.test(clean)
    ? `"${clean}" <${address}>`
    : `${encodeHeaderWord(clean)} <${address}>`;
}

export function buildMimeMessage(input: MimeInput): string {
  const to = sanitizeHeader(input.to);
  const from = sanitizeHeader(input.from);
  if (!isPlainAddress(to)) throw new Error("Invalid recipient address.");
  if (!isPlainAddress(from)) throw new Error("Invalid sender address.");

  const headers = [
    `From: ${formatAddress(from, input.fromName)}`,
    `To: ${to}`,
    `Subject: ${encodeHeaderWord(input.subject)}`,
    `Date: ${(input.date ?? new Date()).toUTCString()}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
  ];
  if (input.inReplyTo)
    headers.push(`In-Reply-To: ${sanitizeHeader(input.inReplyTo)}`);
  if (input.references)
    headers.push(`References: ${sanitizeHeader(input.references)}`);

  // Normalise line endings and wrap the base64 body at 76 characters per RFC 2045.
  const body = input.body.replace(/\r\n|\r|\n/g, "\r\n");
  const encoded = Buffer.from(body, "utf8")
    .toString("base64")
    .replace(/.{76}(?=.)/g, "$&\r\n");
  return `${headers.join("\r\n")}\r\n\r\n${encoded}`;
}

/** The Gmail API wants the whole message as base64url. */
export function toBase64Url(message: string): string {
  return Buffer.from(message, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
