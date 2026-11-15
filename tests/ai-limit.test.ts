import type Anthropic from "@anthropic-ai/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const parse = vi.fn(async () => ({
  stop_reason: "end_turn",
  parsed_output: { greeting: "Hi" },
  model: "test-model",
  usage: { input_tokens: 1, output_tokens: 1 },
}));
const fakeClient = { beta: { messages: { parse } } } as unknown as Anthropic;
const usage = { count: 0 };

vi.mock("@/lib/ai/client", () => ({
  getAnthropic: () => fakeClient,
  getDefaultModel: () => "test-model",
}));
vi.mock("@/lib/usage/record", () => ({
  recordUsage: vi.fn(async () => undefined),
  recentUsageCount: vi.fn(async () => usage.count),
}));

const { runPrompt } = await import("@/lib/ai/run");
const { definePrompt } = await import("@/lib/ai/prompts/types");
const { getEnv } = await import("@/lib/env");

const prompt = definePrompt<{ name: string }, { greeting: string }>({
  id: "limit-test",
  version: 1,
  effort: "low",
  maxTokens: 100,
  system: "Greet.",
  outputSchema: z.object({ greeting: z.string() }),
  buildContent: (input) => input.name,
  mock: () => ({ greeting: "sample" }),
});

describe("AI daily allowance", () => {
  beforeEach(() => parse.mockClear());

  it("allows calls under the limit", async () => {
    usage.count = getEnv().AI_DAILY_CALL_LIMIT - 1;
    const result = await runPrompt(prompt, { name: "A" }, { userId: "u1" });
    expect(result.output.greeting).toBe("Hi");
    expect(parse).toHaveBeenCalledOnce();
  });

  it("refuses once the limit is reached, without calling Claude", async () => {
    usage.count = getEnv().AI_DAILY_CALL_LIMIT;
    await expect(
      runPrompt(prompt, { name: "A" }, { userId: "u1" }),
    ).rejects.toMatchObject({ code: "daily_limit" });
    expect(parse).not.toHaveBeenCalled();
  });
});
