import { describe, expect, it } from "vitest";

import { getEmailFinders, getEmailVerifier } from "@/lib/providers/email";
import { getPeopleProvider } from "@/lib/providers/people";
import { getResearchProvider } from "@/lib/providers/research";

describe("mock providers (default configuration)", () => {
  it("returns deterministic people for a company", async () => {
    const provider = getPeopleProvider();
    const first = await provider.searchPeople({
      companyName: "Acme Corp",
      limit: 3,
    });
    const second = await provider.searchPeople({
      companyName: "Acme Corp",
      limit: 3,
    });

    expect(first).toHaveLength(3);
    expect(first).toEqual(second);
    expect(first[0]?.companyDomain).toBe("acme-corp.example");
  });

  it("finds and verifies an email through the waterfall", async () => {
    const [finder] = getEmailFinders();
    const found = await finder?.findEmail({
      firstName: "Priya",
      lastName: "Raman",
      companyDomain: "Acme.example",
    });
    expect(found?.email).toBe("priya.raman@acme.example");

    const verifier = getEmailVerifier();
    expect((await verifier.verifyEmail(found!.email)).status).toBe("valid");
    expect((await verifier.verifyEmail("risky@acme.example")).status).toBe(
      "risky",
    );
    expect((await verifier.verifyEmail("invalid@acme.example")).status).toBe(
      "invalid",
    );
  });

  it("returns no email when the name is unusable", async () => {
    const [finder] = getEmailFinders();
    expect(
      await finder?.findEmail({
        firstName: "",
        lastName: "",
        companyDomain: "acme.example",
      }),
    ).toBeNull();
  });

  it("labels mock research results and respects maxResults", async () => {
    const results = await getResearchProvider().search({
      query: "Acme",
      maxResults: 1,
    });
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toMatch(/^\[Mock\]/);
  });
});
