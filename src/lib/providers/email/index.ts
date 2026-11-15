import "server-only";

import { getEnv } from "@/lib/env";

import { ApolloEmailFinder } from "./apollo";
import { HunterEmailFinder, HunterEmailVerifier } from "./hunter";
import { MockEmailFinder, MockEmailVerifier } from "./mock";
import type { EmailFinderProvider, EmailVerifierProvider } from "./types";

export * from "./types";

/**
 * Finders in waterfall order: the first one to return an email wins.
 * Hunter first (cheap, verifies as it finds), then Apollo (can also reveal
 * hidden surnames). Snov or Prospeo can be appended here later.
 */
export function getEmailFinders(): EmailFinderProvider[] {
  const { HUNTER_API_KEY, APOLLO_API_KEY } = getEnv();
  const finders: EmailFinderProvider[] = [];
  if (HUNTER_API_KEY) finders.push(new HunterEmailFinder(HUNTER_API_KEY));
  if (APOLLO_API_KEY) finders.push(new ApolloEmailFinder(APOLLO_API_KEY));
  return finders.length ? finders : [new MockEmailFinder()];
}

export function getEmailVerifier(): EmailVerifierProvider | null {
  const { HUNTER_API_KEY } = getEnv();
  if (HUNTER_API_KEY) return new HunterEmailVerifier(HUNTER_API_KEY);
  // With real finders but no verifier, emails stay "unknown" and need confirmation.
  return getEmailFinders()[0]?.name === "mock" ? new MockEmailVerifier() : null;
}
