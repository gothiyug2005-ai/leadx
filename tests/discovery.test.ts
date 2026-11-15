import { describe, expect, it, vi } from "vitest";

import {
  heuristicRanking,
  roleTypeFromTitle,
} from "@/lib/ai/prompts/people-rank";
import { peopleRankingSchema } from "@/lib/ai/schemas/ranking";
import { detectAngles, mergeAngles } from "@/lib/discovery/angles";
import { buildRows, pickRecommended } from "@/lib/discovery/run";
import { searchTitlesFor } from "@/lib/discovery/titles";
import { readAngles, sortPeople } from "@/lib/discovery/view";
import { cacheKey } from "@/lib/providers/cache";
import { ApolloPeopleProvider } from "@/lib/providers/people/apollo";
import type { PersonCandidate } from "@/lib/providers/people/types";

describe("search titles", () => {
  it("looks for the manager, peers, recruiters and leaders of an engineering role", () => {
    const titles = searchTitlesFor({
      role_title: "Senior Frontend Engineer",
      team: "Payments",
    });
    expect(titles[0]).toBe("Engineering Manager");
    expect(titles).toEqual(
      expect.arrayContaining([
        "Senior Frontend Engineer",
        "Technical Recruiter",
        "CTO",
      ]),
    );
    expect(titles.length).toBeLessThanOrEqual(12);
  });

  it("adapts to other functions and falls back to generic titles", () => {
    expect(
      searchTitlesFor({ role_title: "Product Designer", team: null }),
    ).toContain("Design Manager");
    expect(searchTitlesFor({ role_title: null, team: null })).toContain(
      "Recruiter",
    );
  });
});

describe("connection angles", () => {
  const user = {
    schools: ["IIT Bombay"],
    companies: ["Acme Pay Pvt Ltd"],
    location: "Bengaluru, India",
    skills: ["React"],
  };

  it("finds a shared school, past company, city and skill", () => {
    const angles = detectAngles(user, {
      schools: ["Indian Institute of Technology Bombay", "IIT Bombay"],
      pastCompanies: ["Acme Pay"],
      location: "Bengaluru (hybrid)",
      title: "React Engineer",
    });
    expect(angles.map((angle) => angle.type)).toEqual([
      "shared_school",
      "past_company",
      "location",
      "skills",
    ]);
  });

  it("does not treat 'Remote' or unrelated places as shared", () => {
    const angles = detectAngles(
      { ...user, location: "Remote" },
      {
        schools: ["MIT"],
        pastCompanies: ["Globex"],
        location: "Remote",
        title: "Engineer",
      },
    );
    expect(angles).toEqual([]);
  });

  it("merges without duplicates and keeps at most four", () => {
    const a = { type: "location" as const, detail: "You are both in Pune" };
    expect(
      mergeAngles([a], [{ ...a, detail: "you are both in pune" }]),
    ).toHaveLength(1);
  });

  it("reads stored angles defensively", () => {
    expect(
      readAngles([
        { type: "skills", detail: "x" },
        { type: "hack", detail: "y" },
        null,
        "z",
      ]),
    ).toEqual([{ type: "skills", detail: "x" }]);
    expect(readAngles({})).toEqual([]);
  });
});

describe("sample ranking", () => {
  it("puts the matching team's manager above generic HR and leadership", () => {
    const output = heuristicRanking({
      target: {
        company: "Acme",
        role: "Frontend Engineer",
        team: "Payments",
        seniority: null,
        skills: [],
        summary: null,
      },
      user: { headline: null, positioning: null, targetRoles: [] },
      candidates: [
        {
          id: "ceo",
          title: "CEO",
          location: null,
          schools: [],
          pastCompanies: [],
          angles: [],
        },
        {
          id: "hr",
          title: "HR Generalist",
          location: null,
          schools: [],
          pastCompanies: [],
          angles: [],
        },
        {
          id: "em",
          title: "Engineering Manager, Payments",
          location: null,
          schools: [],
          pastCompanies: [],
          angles: [],
        },
        {
          id: "peer",
          title: "Frontend Engineer",
          location: null,
          schools: [],
          pastCompanies: [],
          angles: [],
        },
      ],
    });
    expect(peopleRankingSchema.safeParse(output).success).toBe(true);
    expect(output.ranked[0]).toMatchObject({
      candidate_id: "em",
      role_type: "hiring_manager",
    });
    expect(output.ranked.at(-1)?.candidate_id).toBe("ceo");
  });

  it("classifies titles", () => {
    expect(roleTypeFromTitle("Senior Technical Recruiter", null)).toBe(
      "recruiter",
    );
    expect(roleTypeFromTitle("VP of Engineering", null)).toBe("leadership");
    expect(roleTypeFromTitle("Head of Design", null)).toBe("hiring_manager");
    expect(roleTypeFromTitle("Software Engineer", "Frontend Engineer")).toBe(
      "team_member",
    );
  });
});

describe("recommendations", () => {
  it("recommends up to five strong matches", () => {
    const scored = [90, 85, 80, 75, 70, 65, 30].map((score, index) => ({
      id: String(index),
      score,
    }));
    expect([...pickRecommended(scored)]).toEqual(["0", "1", "2", "3", "4"]);
  });

  it("still suggests three when matches are moderate, but never weak ones", () => {
    const scored = [55, 50, 45, 20].map((score, index) => ({
      id: String(index),
      score,
    }));
    expect([...pickRecommended(scored)]).toEqual(["0", "1", "2"]);
    expect([...pickRecommended([{ id: "x", score: 10 }])]).toEqual([]);
  });

  it("builds rows that label shared-background peers as alumni", () => {
    const candidate: PersonCandidate = {
      providerId: "p1",
      provider: "apollo",
      firstName: "Mei",
      lastName: "Ta***a",
      lastNameIsPartial: true,
      title: "Software Engineer",
      companyName: "Acme",
      companyDomain: "acme.com",
      location: null,
      linkedinUrl: null,
      schools: [],
      pastCompanies: [],
      hasEmail: true,
      isSample: false,
    };
    const rows = buildRows(
      [candidate],
      {
        ranked: [
          {
            candidate_id: "p1",
            role_type: "team_member",
            relevance_score: 72,
            reason: "Peer",
            extra_angles: [],
          },
        ],
      },
      new Map([
        ["p1", [{ type: "shared_school", detail: "You both studied at X" }]],
      ]),
      { targetId: "t", companyId: "c", alreadyHasRecommended: false },
    );
    expect(rows[0]).toMatchObject({
      full_name: "Mei Ta***a",
      role_type: "alumni",
      relevance_score: 72,
      is_recommended: true,
      source: "apollo",
      provider_person_id: "p1",
    });
  });

  it("sorts top picks first and do-not-contact last", () => {
    const people = [
      {
        id: "a",
        is_recommended: false,
        relevance_score: 90,
        do_not_contact: false,
      },
      {
        id: "b",
        is_recommended: true,
        relevance_score: 60,
        do_not_contact: false,
      },
      {
        id: "c",
        is_recommended: true,
        relevance_score: 99,
        do_not_contact: true,
      },
    ];
    expect(sortPeople(people).map((person) => person.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });
});

describe("Apollo adapter", () => {
  function fakeFetch(status: number, body: unknown) {
    return vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        }),
    );
  }

  it("sends titles and the company domain, and maps people", async () => {
    const fetchMock = fakeFetch(200, {
      people: [
        {
          id: "abc",
          first_name: "Priya",
          last_name_obfuscated: "Ra***n",
          title: "Engineering Manager",
          city: "Bengaluru",
          country: "India",
          has_email: true,
          organization: { name: "Acme", primary_domain: "acme.com" },
        },
        { id: "no-name" },
      ],
    });
    const provider = new ApolloPeopleProvider(
      "key-123",
      fetchMock as unknown as typeof fetch,
    );
    const people = await provider.searchPeople({
      companyName: "Acme",
      companyDomain: "acme.com",
      titles: ["Engineering Manager"],
      limit: 10,
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const query = new URL(url).searchParams;
    expect(
      url.startsWith("https://api.apollo.io/api/v1/mixed_people/api_search?"),
    ).toBe(true);
    expect(query.getAll("person_titles[]")).toEqual(["Engineering Manager"]);
    expect(query.getAll("q_organization_domains_list[]")).toEqual(["acme.com"]);
    expect(query.get("per_page")).toBe("10");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe(
      "key-123",
    );

    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({
      providerId: "abc",
      firstName: "Priya",
      lastName: "Ra***n",
      lastNameIsPartial: true,
      location: "Bengaluru, India",
      companyDomain: "acme.com",
      isSample: false,
    });
  });

  it("turns API failures into clear provider errors", async () => {
    const auth = new ApolloPeopleProvider(
      "bad",
      fakeFetch(403, {}) as unknown as typeof fetch,
    );
    await expect(
      auth.searchPeople({ companyName: "Acme", titles: [] }),
    ).rejects.toMatchObject({ code: "auth" });

    const limited = new ApolloPeopleProvider(
      "k",
      fakeFetch(429, {}) as unknown as typeof fetch,
    );
    await expect(
      limited.searchPeople({ companyName: "Acme", titles: [] }),
    ).rejects.toMatchObject({ code: "rate_limited" });
  });
});

describe("provider cache key", () => {
  it("is stable regardless of property order", () => {
    expect(cacheKey("apollo", "search", { a: 1, b: [2, 3] })).toBe(
      cacheKey("apollo", "search", { b: [2, 3], a: 1 }),
    );
    expect(cacheKey("apollo", "search", { a: 1 })).not.toBe(
      cacheKey("apollo", "search", { a: 2 }),
    );
  });
});

describe("sample ranking reasons", () => {
  it("keeps names in the reason capitalised", () => {
    const output = heuristicRanking({
      target: {
        company: "Acme",
        role: "Engineer",
        team: null,
        seniority: null,
        skills: [],
        summary: null,
      },
      user: { headline: null, positioning: null, targetRoles: [] },
      candidates: [
        {
          id: "a",
          title: "Engineering Manager",
          location: null,
          schools: [],
          pastCompanies: [],
          angles: [
            { type: "shared_school", detail: "You both studied at IIT Bombay" },
          ],
        },
      ],
    });
    expect(output.ranked[0]?.reason).toBe(
      "Likely manages or hires for the team this role sits in; you both studied at IIT Bombay.",
    );
  });
});
