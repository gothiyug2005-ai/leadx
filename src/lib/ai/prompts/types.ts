import type Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";

export type PromptContent = string | Anthropic.Beta.BetaContentBlockParam[];
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/**
 * Every prompt is a versioned definition. Bump `version` whenever the wording
 * changes, so stored outputs can be traced back to the prompt that made them.
 */
export interface PromptDefinition<TInput, TOutput> {
  id: string;
  version: number;
  system: string;
  buildContent: (input: TInput) => PromptContent;
  /** AI output is never trusted until it parses against this schema. */
  outputSchema: z.ZodType<TOutput>;
  effort: Effort;
  maxTokens: number;
  /** Deterministic sample output, used when no Anthropic key is configured. */
  mock: (input: TInput) => TOutput;
}

export function definePrompt<TInput, TOutput>(
  prompt: PromptDefinition<TInput, TOutput>,
): PromptDefinition<TInput, TOutput> {
  return prompt;
}
