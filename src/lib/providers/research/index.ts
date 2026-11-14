import "server-only";

import { getEnv } from "@/lib/env";

import { MockResearchProvider } from "./mock";
import type { ResearchProvider } from "./types";

export * from "./types";

/** Real adapters (Tavily or Exa, chosen by RESEARCH_PROVIDER) are registered here in Step 7. */
export function getResearchProvider(): ResearchProvider {
  if (getEnv().USE_MOCK_PROVIDERS) return new MockResearchProvider();
  throw new Error("No real research provider is implemented yet (Step 7)");
}
