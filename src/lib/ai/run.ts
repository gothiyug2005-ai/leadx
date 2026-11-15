import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";

import { getEnv } from "@/lib/env";
import { recentUsageCount, recordUsage } from "@/lib/usage/record";

import { getAnthropic, getDefaultModel } from "./client";
import { AiError } from "./errors";
import type { PromptDefinition } from "./prompts/types";

export interface RunResult<TOutput> {
  output: TOutput;
  /** True when this came from the sample generator, not from Claude. */
  isSample: boolean;
  model: string | null;
  promptId: string;
  promptVersion: number;
}

interface RunOptions {
  userId: string;
  /** Injected in tests; defaults to the shared client (or sample mode when null). */
  client?: Anthropic | null;
  model?: string;
}

/**
 * Run a versioned prompt and return output validated against its schema.
 * Every AI feature in LeadX goes through here, so errors, usage tracking and
 * sample mode behave the same everywhere.
 */
export async function runPrompt<TInput, TOutput>(
  prompt: PromptDefinition<TInput, TOutput>,
  input: TInput,
  options: RunOptions,
): Promise<RunResult<TOutput>> {
  const client = options.client === undefined ? getAnthropic() : options.client;
  const operation = `${prompt.id}@v${prompt.version}`;

  if (!client) {
    const output = prompt.outputSchema.parse(prompt.mock(input));
    await recordUsage({
      userId: options.userId,
      provider: "anthropic",
      operation,
      isMock: true,
    });
    return {
      output,
      isSample: true,
      model: null,
      promptId: prompt.id,
      promptVersion: prompt.version,
    };
  }

  // Cost guard: only real calls count, and only when they would hit Claude.
  if (options.client === undefined) {
    const used = await recentUsageCount(
      options.userId,
      "anthropic",
      24 * 60 * 60 * 1000,
    );
    if (used >= getEnv().AI_DAILY_CALL_LIMIT) throw new AiError("daily_limit");
  }

  const model = options.model ?? getDefaultModel();
  let response;
  try {
    response = await client.beta.messages.parse({
      model,
      max_tokens: prompt.maxTokens,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.buildContent(input) }],
      output_config: {
        effort: prompt.effort,
        format: betaZodOutputFormat(prompt.outputSchema),
      },
      // If a safety classifier declines, the API retries on a fallback model in the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
  } catch (error) {
    throw toAiError(error);
  }

  await recordUsage({
    userId: options.userId,
    provider: "anthropic",
    operation,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    model: response.model,
  });

  if (response.stop_reason === "refusal") {
    throw new AiError("refused", response.stop_details?.category ?? undefined);
  }
  if (response.stop_reason === "max_tokens") {
    throw new AiError("truncated");
  }

  const parsed = prompt.outputSchema.safeParse(response.parsed_output);
  if (!parsed.success) {
    throw new AiError("invalid_output");
  }

  return {
    output: parsed.data,
    isSample: false,
    model: response.model,
    promptId: prompt.id,
    promptVersion: prompt.version,
  };
}

function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  if (error instanceof Anthropic.RateLimitError)
    return new AiError("rate_limited");
  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError
  ) {
    return new AiError("auth");
  }
  if (error instanceof Anthropic.BadRequestError) {
    return new AiError("bad_request", error.message);
  }
  if (error instanceof Anthropic.APIError)
    return new AiError("unavailable", error.message);
  // The SDK raises its own error when structured output fails to parse.
  if (error instanceof Error && /parse|json|schema/i.test(error.message)) {
    return new AiError("invalid_output");
  }
  return new AiError("unavailable");
}
