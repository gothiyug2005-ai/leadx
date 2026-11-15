import "server-only";

import { getEnv } from "@/lib/env";

import { ExaResearchProvider } from "./exa";
import { MockResearchProvider } from "./mock";
import { TavilyResearchProvider } from "./tavily";
import type { ResearchProvider } from "./types";

export * from "./types";

/** Tavily or Exa (chosen by RESEARCH_PROVIDER) when its key is set; otherwise sample results. */
export function getResearchProvider(): ResearchProvider {
  const { RESEARCH_PROVIDER, TAVILY_API_KEY, EXA_API_KEY } = getEnv();
  if (RESEARCH_PROVIDER === "exa" && EXA_API_KEY)
    return new ExaResearchProvider(EXA_API_KEY);
  if (RESEARCH_PROVIDER === "tavily" && TAVILY_API_KEY)
    return new TavilyResearchProvider(TAVILY_API_KEY);
  return new MockResearchProvider();
}
