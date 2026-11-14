import { describe, expect, it } from "vitest";

import { parseEnv } from "@/lib/env";

describe("parseEnv", () => {
  it("defaults to mock providers with no keys set", () => {
    const env = parseEnv({});
    expect(env.USE_MOCK_PROVIDERS).toBe(true);
    expect(env.DAILY_SEND_CAP_DEFAULT).toBe(20);
    expect(env.DAILY_SEND_CAP_MAX).toBe(40);
  });

  it("requires provider keys when mocks are turned off", () => {
    expect(() => parseEnv({ USE_MOCK_PROVIDERS: "false" })).toThrow(
      /ANTHROPIC_API_KEY is required/,
    );
  });

  it("accepts real-provider mode when every key is present", () => {
    const env = parseEnv({
      USE_MOCK_PROVIDERS: "false",
      ANTHROPIC_API_KEY: "a",
      APOLLO_API_KEY: "b",
      HUNTER_API_KEY: "c",
      TAVILY_API_KEY: "d",
    });
    expect(env.USE_MOCK_PROVIDERS).toBe(false);
  });

  it("requires the Exa key when Exa is the chosen research provider", () => {
    expect(() =>
      parseEnv({
        USE_MOCK_PROVIDERS: "false",
        RESEARCH_PROVIDER: "exa",
        ANTHROPIC_API_KEY: "a",
        APOLLO_API_KEY: "b",
        HUNTER_API_KEY: "c",
        TAVILY_API_KEY: "d",
      }),
    ).toThrow(/EXA_API_KEY is required/);
  });

  it("rejects a daily send cap above the hard maximum of 40", () => {
    expect(() => parseEnv({ DAILY_SEND_CAP_DEFAULT: "100" })).toThrow(
      /DAILY_SEND_CAP_DEFAULT/,
    );
  });

  it("treats blank keys as unset", () => {
    expect(
      parseEnv({ ANTHROPIC_API_KEY: "  " }).ANTHROPIC_API_KEY,
    ).toBeUndefined();
  });
});
