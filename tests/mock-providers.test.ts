import { describe, expect, it } from "vitest";

import { getEmailFinders, getEmailVerifier } from "@/lib/providers/email";
import { getPeopleProvider } from "@/lib/providers/people";
import { getResearchProvider } from "@/lib/providers/research";

const emailInput = {
  firstName: "Priya",
  lastName: "Raman",
  companyDomain: "Acme.example",
  companyName: "Acme",
  providerPersonId: null,
  source: "mock",
};

describe("sample providers (no keys configured)", () => {
  it("returns the same labelled sample people for the same company", async () => {
    const provider = getPeopleProvider();
    expect(provider.name).toBe("mock");
    const input = {
      companyName: "Acme Corp",
      titles: ["Engineering Manager", "Recruiter"],
      limit: 3,
    };
    const first = await provider.searchPeople(input);
    const second = await provider.searchPeople(input);

    expect(first).toHaveLength(3);
    expect(first).toEqual(second);
    expect(first.every((person) => person.isSample)).toBe(true);
    expect(first[0]).toMatchObject({
      title: "Engineering Manager",
      companyDomain: "acme-corp.example",
    });
  });

  it("gives one sample person the user's school so shared background shows up", async () => {
    const people = await getPeopleProvider().searchPeople({
      companyName: "Acme",
      titles: ["Engineer"],
      hints: { schools: ["IIT Bombay"] },
    });
    expect(people.some((person) => person.schools.includes("IIT Bombay"))).toBe(
      true,
    );
  });

  it("finds and verifies a sample email", async () => {
    const finders = getEmailFinders();
    expect(finders.map((finder) => finder.name)).toEqual(["mock"]);
    const found = await finders[0]?.findEmail(emailInput);
    expect(found?.email).toBe("priya.raman@acme.example");

    const verifier = getEmailVerifier();
    expect(verifier?.name).toBe("mock");
    expect((await verifier!.verifyEmail(found!.email)).status).toBe("valid");
    expect((await verifier!.verifyEmail("risky@acme.example")).status).toBe(
      "risky",
    );
    expect((await verifier!.verifyEmail("invalid@acme.example")).status).toBe(
      "invalid",
    );
  });

  it("labels sample research results and respects maxResults", async () => {
    const results = await getResearchProvider().search({
      query: "Acme",
      maxResults: 1,
    });
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toMatch(/^\[Mock\]/);
  });
});
