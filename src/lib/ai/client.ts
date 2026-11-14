import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { getEnv } from "@/lib/env";

let client: Anthropic | undefined;

/** Shared Anthropic client. All AI calls go through here so usage can be tracked per user. */
export function getAnthropic(): Anthropic {
  const { ANTHROPIC_API_KEY } = getEnv();
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  client ??= new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  return client;
}

export function getDefaultModel(): string {
  return getEnv().ANTHROPIC_MODEL;
}
