import "server-only";

import { getEnv } from "@/lib/env";

import { MockEmailFinder, MockEmailVerifier } from "./mock";
import type { EmailFinderProvider, EmailVerifierProvider } from "./types";

export * from "./types";

/**
 * Finders in waterfall order: the first one to return an email wins.
 * Real adapters (Hunter, then Apollo; Snov and Prospeo later) are registered in Step 7.
 */
export function getEmailFinders(): EmailFinderProvider[] {
  if (getEnv().USE_MOCK_PROVIDERS) return [new MockEmailFinder()];
  throw new Error("No real email finder is implemented yet (Step 7)");
}

export function getEmailVerifier(): EmailVerifierProvider {
  if (getEnv().USE_MOCK_PROVIDERS) return new MockEmailVerifier();
  throw new Error("No real email verifier is implemented yet (Step 7)");
}
