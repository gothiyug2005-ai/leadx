import { describe, expect, it } from "vitest";

import { parseEnv } from "@/lib/env";

const ALL_KEYS = {
  ANTHROPIC_API_KEY: "a",
  APOLLO_API_KEY: "b",
  HUNTER_API_KEY: "c",
  TAVILY_API_KEY: "d",
  GOOGLE_CLIENT_ID: "e",
  GOOGLE_CLIENT_SECRET: "f",
  TOKEN_ENCRYPTION_KEY: "g",
};

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
    const env = parseEnv({ ...ALL_KEYS, USE_MOCK_PROVIDERS: "false" });
    expect(env.USE_MOCK_PROVIDERS).toBe(false);
  });

  it("requires the Exa key when Exa is the chosen research provider", () => {
    expect(() =>
      parseEnv({
        ...ALL_KEYS,
        USE_MOCK_PROVIDERS: "false",
        RESEARCH_PROVIDER: "exa",
      }),
    ).toThrow(/EXA_API_KEY is required/);
  });

  it("rejects a daily send cap above the hard maximum of 40", () => {
    expect(() => parseEnv({ DAILY_SEND_CAP_DEFAULT: "100" })).toThrow(
      /DAILY_SEND_CAP_DEFAULT/,
    );
  });

  it("keeps dev login off unless it is switched on", () => {
    expect(parseEnv({}).ENABLE_DEV_LOGIN).toBe(false);
    expect(parseEnv({ ENABLE_DEV_LOGIN: "true" }).ENABLE_DEV_LOGIN).toBe(true);
  });

  it("treats blank keys as unset", () => {
    expect(
      parseEnv({ ANTHROPIC_API_KEY: "  " }).ANTHROPIC_API_KEY,
    ).toBeUndefined();
  });
});
