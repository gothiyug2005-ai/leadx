import { z } from "zod";

import { ProviderError } from "@/lib/providers/people/types";

import type {
  ResearchProvider,
  ResearchResult,
  ResearchSearchInput,
} from "./types";

const resultSchema = z.object({
  results: z
    .array(
      z.object({
        title: z.string().nullish(),
        url: z.string(),
        publishedDate: z.string().nullish(),
        text: z.string().nullish(),
        highlights: z.array(z.string()).nullish(),
      }),
    )
    .nullish(),
});

export class ExaResearchProvider implements ResearchProvider {
  readonly name = "exa";

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async search(input: ResearchSearchInput): Promise<ResearchResult[]> {
    const body: Record<string, unknown> = {
      query: input.query,
      numResults: Math.min(input.maxResults ?? 5, 10),
      contents: { text: { maxCharacters: 800 } },
    };
    if (input.recencyDays) {
      body.startPublishedDate = new Date(
        Date.now() - input.recencyDays * 86_400_000,
      ).toISOString();
    }

    let response: Response;
    try {
      response = await this.fetchImpl("https://api.exa.ai/search", {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new ProviderError("exa", "unavailable", "Exa did not respond.");
    }
    if (response.status === 401 || response.status === 403)
      throw new ProviderError("exa", "auth", "Exa rejected the API key.");
    if (response.status === 429)
      throw new ProviderError(
        "exa",
        "rate_limited",
        "Exa's limit was reached.",
      );
    if (!response.ok)
      throw new ProviderError(
        "exa",
        "unavailable",
        `Exa returned ${response.status}.`,
      );

    const parsed = resultSchema.safeParse(
      await response.json().catch(() => null),
    );
    if (!parsed.success)
      throw new ProviderError(
        "exa",
        "bad_response",
        "Exa returned an unexpected response.",
      );
    return (parsed.data.results ?? []).map((result) => ({
      title: result.title ?? result.url,
      url: result.url,
      snippet: (result.highlights?.join(" … ") || result.text || "").slice(
        0,
        800,
      ),
      publishedAt: result.publishedDate ?? undefined,
    }));
  }
}
