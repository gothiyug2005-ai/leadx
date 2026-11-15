import type {
  EmailFindInput,
  EmailFindResult,
  EmailFinderProvider,
} from "@/lib/providers/email/types";

export interface WaterfallAttempt {
  provider: string;
  outcome: "found" | "not_found" | "skipped" | "error";
  error?: string;
}

export interface WaterfallResult {
  found: EmailFindResult | null;
  attempts: WaterfallAttempt[];
}

/**
 * Try each finder in order until one returns an email. A finder that errors
 * (bad key, rate limit) is skipped rather than ending the search, so one
 * provider being down never blocks the others.
 */
export async function findEmailWaterfall(
  finders: EmailFinderProvider[],
  input: EmailFindInput,
): Promise<WaterfallResult> {
  const attempts: WaterfallAttempt[] = [];
  let current = input;

  for (const finder of finders) {
    if (!finder.canFind(current)) {
      attempts.push({ provider: finder.name, outcome: "skipped" });
      continue;
    }
    try {
      const found = await finder.findEmail(current);
      if (found) {
        attempts.push({ provider: finder.name, outcome: "found" });
        return { found, attempts };
      }
      attempts.push({ provider: finder.name, outcome: "not_found" });
    } catch (error) {
      attempts.push({
        provider: finder.name,
        outcome: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
    // Nothing found yet; later finders keep the same input.
    current = { ...current };
  }
  return { found: null, attempts };
}
