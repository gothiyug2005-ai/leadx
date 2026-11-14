import type { z } from "zod";

/**
 * Every prompt is a versioned function. Bump `version` whenever the wording
 * changes so stored outputs can be traced back to the prompt that made them.
 */
export interface PromptDefinition<TInput, TOutput> {
  id: string;
  version: number;
  system: string;
  buildUserMessage: (input: TInput) => string;
  /** AI output is never trusted until it parses against this schema. */
  outputSchema: z.ZodType<TOutput>;
}

export function definePrompt<TInput, TOutput>(
  prompt: PromptDefinition<TInput, TOutput>,
): PromptDefinition<TInput, TOutput> {
  return prompt;
}
