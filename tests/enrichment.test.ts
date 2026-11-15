import { describe, expect, it, vi } from "vitest";

import { companyBriefPrompt, personBriefPrompt } from "@/lib/ai/prompts";
import { findEmailWaterfall } from "@/lib/enrichment/waterfall";
import { ApolloEmailFinder } from "@/lib/providers/email/apollo";
import {
  HunterEmailFinder,
  HunterEmailVerifier,
  mapHunterStatus,
} from "@/lib/providers/email/hunter";
import type {
  EmailFindInput,
  EmailFinderProvider,
} from "@/lib/providers/email/types";
import { ProviderError } from "@/lib/providers/people/types";
import { ExaResearchProvider } from "@/lib/providers/research/exa";
import { TavilyResearchProvider } from "@/lib/providers/research/tavily";

const input: EmailFindInput = {
  firstName: "Priya",
  lastName: "Raman",
  companyDomain: "acme.com",
  companyName: "Acme",
  providerPersonId: "apollo-1",
  source: "apollo",
};

function finder(
  name: string,
  behaviour: "found" | "none" | "error" | "skip",
): EmailFinderProvider {
  return {
    name,
    canFind: () => behaviour !== "skip",
    findEmail: vi.fn(async () => {
      if (behaviour === "error")
        throw new ProviderError(name, "unavailable", `${name} is down`);
      if (behaviour === "none") return null;
      return {
        email: `priya@${name}.test`,
        provider: name,
        confidence: 80,
        verification: null,
        lastName: null,
      };
    }),
  };
}

function json(status: number, body: unknown) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
  );
}

describe("email waterfall", () => {
  it("stops at the first provider that finds an email", async () => {
    const second = finder("b", "found");
    const third = finder("c", "found");
    const result = await findEmailWaterfall(
      [finder("a", "none"), second, third],
      input,
    );
    expect(result.found?.provider).toBe("b");
    expect(third.findEmail).not.toHaveBeenCalled();
    expect(result.attempts.map((attempt) => attempt.outcome)).toEqual([
      "not_found",
      "found",
    ]);
  });

  it("keeps going when a provider fails or cannot look the person up", async () => {
    const result = await findEmailWaterfall(
      [finder("a", "skip"), finder("b", "error"), finder("c", "found")],
      input,
    );
    expect(result.found?.provider).toBe("c");
    expect(result.attempts).toEqual([
      { provider: "a", outcome: "skipped" },
      { provider: "b", outcome: "error", error: "b is down" },
      { provider: "c", outcome: "found" },
    ]);
  });

  it("reports nothing found when every provider comes up empty", async () => {
    const result = await findEmailWaterfall(
      [finder("a", "none"), finder("b", "none")],
      input,
    );
    expect(result.found).toBeNull();
  });
});

describe("Hunter", () => {
  it("maps verifier statuses so only confirmed addresses count as valid", () => {
    expect(mapHunterStatus("valid")).toBe("valid");
    expect(mapHunterStatus("accept_all")).toBe("risky");
    expect(mapHunterStatus("webmail")).toBe("risky");
    expect(mapHunterStatus("invalid")).toBe("invalid");
    expect(mapHunterStatus("disposable")).toBe("invalid");
    expect(mapHunterStatus("unknown")).toBe("unknown");
    expect(mapHunterStatus(undefined)).toBe("unknown");
  });

  it("finds an email and reuses Hunter's own verification", async () => {
    const fetchMock = json(200, {
      data: {
        email: "Priya@Acme.com",
        score: 94,
        verification: { status: "valid" },
      },
    });
    const result = await new HunterEmailFinder(
      "k",
      fetchMock as unknown as typeof fetch,
    ).findEmail(input);
    const url = new URL((fetchMock.mock.calls[0] as unknown as [string])[0]);
    expect(url.pathname).toBe("/v2/email-finder");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      domain: "acme.com",
      first_name: "Priya",
      last_name: "Raman",
      api_key: "k",
    });
    expect(result).toMatchObject({
      email: "priya@acme.com",
      confidence: 94,
      verification: "valid",
    });
  });

  it("skips people whose surname is hidden or whose company has no website", () => {
    const hunter = new HunterEmailFinder("k");
    expect(hunter.canFind({ ...input, lastName: "Ra***n" })).toBe(false);
    expect(hunter.canFind({ ...input, companyDomain: null })).toBe(false);
  });

  it("verifies an address", async () => {
    const result = await new HunterEmailVerifier(
      "k",
      json(200, { data: { status: "accept_all" } }) as unknown as typeof fetch,
    ).verifyEmail("a@acme.com");
    expect(result).toMatchObject({ status: "risky", detail: "accept_all" });
  });

  it("raises a clear error for a bad key", async () => {
    await expect(
      new HunterEmailFinder(
        "bad",
        json(401, {}) as unknown as typeof fetch,
      ).findEmail(input),
    ).rejects.toMatchObject({ code: "auth" });
  });
});

describe("Apollo enrichment", () => {
  it("looks a person up by Apollo id and reveals the full surname", async () => {
    const fetchMock = json(200, {
      person: {
        email: "priya.raman@acme.com",
        email_status: "verified",
        last_name: "Raman",
      },
    });
    const result = await new ApolloEmailFinder(
      "k",
      fetchMock as unknown as typeof fetch,
    ).findEmail({ ...input, lastName: "Ra***n" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(new URL(url).searchParams.get("id")).toBe("apollo-1");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("k");
    expect(result).toMatchObject({
      email: "priya.raman@acme.com",
      confidence: 90,
      lastName: "Raman",
      verification: null,
    });
  });

  it("ignores locked placeholder emails", async () => {
    const result = await new ApolloEmailFinder(
      "k",
      json(200, {
        person: { email: "email_not_unlocked@domain.com" },
      }) as unknown as typeof fetch,
    ).findEmail(input);
    expect(result).toBeNull();
  });
});

describe("research providers", () => {
  it("Tavily sends a news search with a Bearer key", async () => {
    const fetchMock = json(200, {
      results: [
        {
          title: "Acme raises",
          url: "https://news.example/a",
          content: "Funding",
          published_date: "2026-10-01",
        },
      ],
    });
    const results = await new TavilyResearchProvider(
      "tk",
      fetchMock as unknown as typeof fetch,
    ).search({ query: "Acme", recencyDays: 90 });
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect((init.headers as Record<string, string>).authorization).toBe(
      "Bearer tk",
    );
    expect(JSON.parse(init.body as string)).toMatchObject({
      query: "Acme",
      topic: "news",
      days: 90,
    });
    expect(results[0]).toMatchObject({
      title: "Acme raises",
      publishedAt: "2026-10-01",
    });
  });

  it("Exa maps results", async () => {
    const fetchMock = json(200, {
      results: [
        {
          title: "Acme blog",
          url: "https://acme.com/blog",
          highlights: ["We rebuilt checkout"],
        },
      ],
    });
    const results = await new ExaResearchProvider(
      "ek",
      fetchMock as unknown as typeof fetch,
    ).search({ query: "Acme" });
    expect(results[0]).toMatchObject({
      url: "https://acme.com/blog",
      snippet: "We rebuilt checkout",
    });
  });
});

describe("research brief prompts", () => {
  it("sample briefs match their schemas and only link to given sources", () => {
    const company = companyBriefPrompt.mock({
      company: "Acme",
      domain: "acme.com",
      role: "Engineer",
      team: "Payments",
      jobSummary: null,
      results: [
        { title: "[Mock] News", url: "https://example.com/mock", snippet: "x" },
      ],
    });
    expect(companyBriefPrompt.outputSchema.safeParse(company).success).toBe(
      true,
    );
    expect(company.recent_news.map((item) => item.url)).toEqual([
      "https://example.com/mock",
    ]);

    const person = personBriefPrompt.mock({
      person: {
        name: "Priya",
        title: "Engineering Manager",
        roleType: "hiring_manager",
        reason: null,
      },
      angles: [
        { type: "shared_school", detail: "You both studied at IIT Bombay" },
      ],
      target: { company: "Acme", role: "Engineer", team: null },
      company,
      user: { headline: null, positioning: null },
    });
    expect(personBriefPrompt.outputSchema.safeParse(person).success).toBe(true);
    expect(person.best_hook).toContain("IIT Bombay");
  });
});
