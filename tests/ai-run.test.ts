import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { AiError } from "@/lib/ai/errors";
import { definePrompt } from "@/lib/ai/prompts/types";
import { runPrompt } from "@/lib/ai/run";

const prompt = definePrompt<{ name: string }, { greeting: string }>({
  id: "test-greeting",
  version: 3,
  effort: "low",
  maxTokens: 500,
  system: "Greet the person.",
  outputSchema: z.object({ greeting: z.string() }),
  buildContent: (input) => `Name: ${input.name}`,
  mock: (input) => ({ greeting: `Hello, ${input.name} (sample)` }),
});

function fakeClient(response: unknown) {
  const parse = vi.fn<(request: unknown) => Promise<unknown>>(
    async () => response,
  );
  return {
    client: { beta: { messages: { parse } } } as unknown as Anthropic,
    parse,
  };
}

function failingClient(error: unknown) {
  return {
    beta: {
      messages: {
        parse: vi.fn(async () => {
          throw error;
        }),
      },
    },
  } as unknown as Anthropic;
}

const usage = { input_tokens: 10, output_tokens: 5 };

describe("runPrompt", () => {
  it("returns labelled sample output when no client is configured", async () => {
    const result = await runPrompt(
      prompt,
      { name: "Priya" },
      { userId: "u1", client: null },
    );
    expect(result).toEqual({
      output: { greeting: "Hello, Priya (sample)" },
      isSample: true,
      model: null,
      promptId: "test-greeting",
      promptVersion: 3,
    });
  });

  it("sends a schema-constrained request and returns validated output", async () => {
    const { client, parse } = fakeClient({
      stop_reason: "end_turn",
      parsed_output: { greeting: "Hi Priya" },
      model: "claude-opus-5-5",
      usage,
    });

    const result = await runPrompt(
      prompt,
      { name: "Priya" },
      { userId: "u1", client, model: "claude-opus-5-5" },
    );

    expect(result).toMatchObject({
      output: { greeting: "Hi Priya" },
      isSample: false,
      model: "claude-opus-5-5",
    });
    const request = parse.mock.calls[0]![0] as Record<string, unknown>;
    expect(request).toMatchObject({
      model: "claude-opus-5-5",
      max_tokens: 500,
      system: "Greet the person.",
      messages: [{ role: "user", content: "Name: Priya" }],
      fallbacks: "default",
    });
    expect((request.output_config as { effort: string }).effort).toBe("low");
  });

  it("reports a refusal instead of returning content", async () => {
    const { client } = fakeClient({
      stop_reason: "refusal",
      stop_details: { category: "cyber" },
      parsed_output: null,
      model: "claude-opus-5-5",
      usage,
    });
    await expect(
      runPrompt(prompt, { name: "x" }, { userId: "u1", client }),
    ).rejects.toMatchObject({
      code: "refused",
    });
  });

  it("reports a cut-off answer", async () => {
    const { client } = fakeClient({
      stop_reason: "max_tokens",
      parsed_output: null,
      model: "m",
      usage,
    });
    await expect(
      runPrompt(prompt, { name: "x" }, { userId: "u1", client }),
    ).rejects.toMatchObject({
      code: "truncated",
    });
  });

  it("never trusts output that does not match the schema", async () => {
    const { client } = fakeClient({
      stop_reason: "end_turn",
      parsed_output: { greeting: 42 },
      model: "m",
      usage,
    });
    await expect(
      runPrompt(prompt, { name: "x" }, { userId: "u1", client }),
    ).rejects.toMatchObject({
      code: "invalid_output",
    });
  });

  it("turns API errors into friendly, typed errors", async () => {
    const rateLimited = new Anthropic.RateLimitError(
      429,
      undefined,
      "slow down",
      new Headers(),
    );
    await expect(
      runPrompt(
        prompt,
        { name: "x" },
        { userId: "u1", client: failingClient(rateLimited) },
      ),
    ).rejects.toMatchObject({ code: "rate_limited" });

    const auth = new Anthropic.AuthenticationError(
      401,
      undefined,
      "bad key",
      new Headers(),
    );
    const error = await runPrompt(
      prompt,
      { name: "x" },
      { userId: "u1", client: failingClient(auth) },
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AiError);
    expect((error as AiError).userMessage).toMatch(/ANTHROPIC_API_KEY/);
  });
});
