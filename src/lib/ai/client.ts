import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { getEnv } from "@/lib/env";

let client: Anthropic | undefined;

/** Shared Anthropic client, or null when no API key is configured (sample mode). */
export function getAnthropic(): Anthropic | null {
  const { ANTHROPIC_API_KEY } = getEnv();
  if (!ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  return client;
}

export function getDefaultModel(): string {
  return getEnv().ANTHROPIC_MODEL;
}

/** True when AI features return labelled sample output instead of calling Claude. */
export function isAiSampleMode(): boolean {
  return getAnthropic() === null;
}
