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
        content: z.string().nullish(),
        published_date: z.string().nullish(),
      }),
    )
    .nullish(),
});

export class TavilyResearchProvider implements ResearchProvider {
  readonly name = "tavily";

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async search(input: ResearchSearchInput): Promise<ResearchResult[]> {
    const body: Record<string, unknown> = {
      query: input.query,
      max_results: Math.min(input.maxResults ?? 5, 10),
      search_depth: "basic",
      topic: input.recencyDays ? "news" : "general",
    };
    if (input.recencyDays) body.days = input.recencyDays;

    let response: Response;
    try {
      response = await this.fetchImpl("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new ProviderError(
        "tavily",
        "unavailable",
        "Tavily did not respond.",
      );
    }
    if (response.status === 401 || response.status === 403)
      throw new ProviderError("tavily", "auth", "Tavily rejected the API key.");
    if (response.status === 429 || response.status === 432)
      throw new ProviderError(
        "tavily",
        "rate_limited",
        "Tavily's limit was reached.",
      );
    if (!response.ok)
      throw new ProviderError(
        "tavily",
        "unavailable",
        `Tavily returned ${response.status}.`,
      );

    const parsed = resultSchema.safeParse(
      await response.json().catch(() => null),
    );
    if (!parsed.success)
      throw new ProviderError(
        "tavily",
        "bad_response",
        "Tavily returned an unexpected response.",
      );
    return (parsed.data.results ?? []).map((result) => ({
      title: result.title ?? result.url,
      url: result.url,
      snippet: (result.content ?? "").slice(0, 800),
      publishedAt: result.published_date ?? undefined,
    }));
  }
}
