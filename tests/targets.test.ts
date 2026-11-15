import { describe, expect, it } from "vitest";

import { heuristicJobExtraction } from "@/lib/ai/prompts/job-extract";
import { jobExtractionSchema } from "@/lib/ai/schemas/job";
import { progressFor } from "@/lib/data/targets";
import {
  personTargetSchema,
  readPostingSchema,
  targetFormSchema,
} from "@/lib/validation/target";

const POSTING = `Senior Frontend Engineer
Location: Bengaluru (hybrid)
Team: Payments

About Northwind: we build checkout tools for small shops.

Requirements
- 4+ years with React and TypeScript
- Experience with GraphQL and accessibility

Nice to have: Next.js
`;

describe("sample-mode job extraction", () => {
  it("reads the role, location, team, seniority and skills from the text", () => {
    const result = heuristicJobExtraction({
      text: POSTING,
      url: "https://careers.northwind.example/jobs/1",
      pageTitle: null,
    });
    expect(jobExtractionSchema.safeParse(result).success).toBe(true);
    expect(result).toMatchObject({
      is_job_posting: true,
      company_name: "Northwind",
      company_domain: "northwind.example",
      role_title: "Senior Frontend Engineer",
      team: "Payments",
      seniority: "senior",
      location: "Bengaluru (hybrid)",
    });
    expect(result.must_have_skills).toEqual(
      expect.arrayContaining([
        "React",
        "TypeScript",
        "GraphQL",
        "Accessibility",
      ]),
    );
    expect(result.must_have_skills).not.toContain("Next.js");
    expect(result.nice_to_have_skills).toEqual(["Next.js"]);
  });

  it("does not invent a company or skills that are not there", () => {
    const result = heuristicJobExtraction({
      text: "We are hiring someone great to help us.",
      url: null,
      pageTitle: null,
    });
    expect(result.company_name).toBeNull();
    expect(result.must_have_skills).toEqual([]);
  });
});

describe("target validation", () => {
  it("normalises the company website and trims fields", () => {
    const parsed = targetFormSchema.parse({
      kind: "company",
      company_name: " Acme ",
      company_domain: "https://www.acme.com/about",
      role_title: "",
      must_have_skills: ["React", "React"],
      nice_to_have_skills: [],
    });
    expect(parsed).toMatchObject({
      company_name: "Acme",
      company_domain: "acme.com",
      role_title: null,
      job_url: null,
    });
    expect(parsed.must_have_skills).toEqual(["React"]);
  });

  it("rejects a bad website or link", () => {
    const base = {
      kind: "company",
      company_name: "Acme",
      must_have_skills: [],
      nice_to_have_skills: [],
    };
    expect(
      targetFormSchema.safeParse({ ...base, company_domain: "not a site" })
        .success,
    ).toBe(false);
    expect(
      targetFormSchema.safeParse({ ...base, job_url: "javascript:alert(1)" })
        .success,
    ).toBe(false);
  });

  it("needs a link or enough pasted text to read a posting", () => {
    expect(
      readPostingSchema.safeParse({ url: "", text: "too short" }).success,
    ).toBe(false);
    expect(
      readPostingSchema.safeParse({ url: "https://acme.com/jobs/1" }).success,
    ).toBe(true);
    expect(readPostingSchema.safeParse({ text: POSTING }).success).toBe(true);
  });

  it("requires a name and company for a person target", () => {
    expect(
      personTargetSchema.safeParse({ full_name: "", company_name: "Acme" })
        .success,
    ).toBe(false);
    expect(
      personTargetSchema.parse({
        full_name: "Priya Raman",
        company_name: "Acme",
      }),
    ).toMatchObject({
      linkedin_url: null,
      company_domain: null,
    });
  });
});

describe("target progress", () => {
  it("counts people found, contacted and replied", () => {
    const stages = [
      "to_contact",
      "contacted",
      "followed_up",
      "replied",
      "interview",
      "closed",
    ];
    expect(progressFor(stages.map((stage) => ({ stage })))).toEqual({
      found: 6,
      contacted: 5,
      replied: 2,
    });
  });
});
