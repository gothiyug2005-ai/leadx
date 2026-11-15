const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  bull: "•",
};

function decodeEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, code: string) => {
      if (code[0] === "#") {
        const value =
          code[1]?.toLowerCase() === "x"
            ? parseInt(code.slice(2), 16)
            : parseInt(code.slice(1), 10);
        return Number.isFinite(value) && value > 0 && value < 0x110000
          ? String.fromCodePoint(value)
          : match;
      }
      return ENTITIES[code.toLowerCase()] ?? match;
    },
  );
}

export interface PageText {
  title: string | null;
  text: string;
}

/** Good-enough readable text from an HTML page, for the AI to read. */
export function htmlToText(html: string): PageText {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = titleMatch?.[1]
    ? decodeEntities(titleMatch[1]).replace(/\s+/g, " ").trim()
    : null;

  // Many job sites embed the full posting as JSON-LD; keep its description.
  const jsonLd: string[] = [];
  for (const match of html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const data = JSON.parse(match[1] ?? "") as unknown;
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (
          item &&
          typeof item === "object" &&
          (item as { "@type"?: unknown })["@type"] === "JobPosting"
        ) {
          const posting = item as Record<string, unknown>;
          const org = posting.hiringOrganization as
            { name?: unknown } | undefined;
          jsonLd.push(
            [
              typeof posting.title === "string"
                ? `Title: ${posting.title}`
                : "",
              typeof org?.name === "string" ? `Company: ${org.name}` : "",
              typeof posting.description === "string"
                ? htmlToText(posting.description).text
                : "",
            ]
              .filter(Boolean)
              .join("\n"),
          );
        }
      }
    } catch {
      // Ignore malformed structured data.
    }
  }

  const body = html
    .replace(
      /<(script|style|noscript|svg|head|nav|footer|iframe|template)[^>]*>[\s\S]*?<\/\1>/gi,
      " ",
    )
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|ul|ol)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<[^>]+>/g, " ");

  const text = [...jsonLd, decodeEntities(body)]
    .join("\n\n")
    .split("\n")
    .map((line) => line.replace(/[ \t\f\v ]+/g, " ").trim())
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { title, text };
}
