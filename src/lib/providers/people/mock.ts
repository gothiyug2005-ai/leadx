import type {
  PeopleProvider,
  PeopleSearchInput,
  PersonCandidate,
} from "./types";

const SAMPLE_PEOPLE = [
  { firstName: "Priya", lastName: "Raman", title: "Engineering Manager" },
  {
    firstName: "Daniel",
    lastName: "Okafor",
    title: "Senior Technical Recruiter",
  },
  { firstName: "Mei", lastName: "Tanaka", title: "Senior Software Engineer" },
  { firstName: "Lucas", lastName: "Ferreira", title: "VP of Engineering" },
  { firstName: "Sara", lastName: "Lindqvist", title: "Product Manager" },
  {
    firstName: "Omar",
    lastName: "Haddad",
    title: "Talent Acquisition Partner",
  },
] as const;

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Deterministic fake people so the product is usable without provider keys. */
export class MockPeopleProvider implements PeopleProvider {
  readonly name = "mock";

  async searchPeople(input: PeopleSearchInput): Promise<PersonCandidate[]> {
    const domain = input.companyDomain ?? `${slug(input.companyName)}.example`;
    const limit = input.limit ?? SAMPLE_PEOPLE.length;

    return SAMPLE_PEOPLE.slice(0, limit).map((person) => ({
      providerId: `mock-${slug(input.companyName)}-${slug(person.firstName)}-${slug(person.lastName)}`,
      provider: this.name,
      fullName: `${person.firstName} ${person.lastName}`,
      firstName: person.firstName,
      lastName: person.lastName,
      title: person.title,
      companyName: input.companyName,
      companyDomain: domain,
      location: "Remote",
    }));
  }
}
