import type {
  ResearchProvider,
  ResearchResult,
  ResearchSearchInput,
} from "./types";

/** Deterministic fake search results, clearly labelled so they are never mistaken for real news. */
export class MockResearchProvider implements ResearchProvider {
  readonly name = "mock";

  async search(input: ResearchSearchInput): Promise<ResearchResult[]> {
    const topic = input.query.replace(/"/g, "").replace(/\s+/g, " ").trim();
    const results: ResearchResult[] = [
      {
        title: `[Mock] Recent announcement related to “${topic}”`,
        url: "https://example.com/mock/announcement",
        snippet:
          "Placeholder result from the mock research provider. Set USE_MOCK_PROVIDERS=false for real search.",
      },
      {
        title: `[Mock] Engineering blog post related to “${topic}”`,
        url: "https://example.com/mock/blog",
        snippet:
          "Placeholder result from the mock research provider describing a team's current focus.",
      },
    ];
    return results.slice(0, input.maxResults ?? results.length);
  }
}
