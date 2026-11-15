import type {
  PeopleProvider,
  PeopleSearchInput,
  PersonCandidate,
} from "./types";

const FIRST = [
  "Priya",
  "Daniel",
  "Mei",
  "Lucas",
  "Sara",
  "Omar",
  "Ananya",
  "Tom",
  "Leila",
  "Ravi",
  "Hannah",
  "Kenji",
];
const LAST = [
  "Raman",
  "Okafor",
  "Tanaka",
  "Ferreira",
  "Lindqvist",
  "Haddad",
  "Iyer",
  "Becker",
  "Nasser",
  "Menon",
  "Clarke",
  "Sato",
];
const SCHOOLS = ["State University", "Institute of Technology", "City College"];
const COMPANIES = ["Globex", "Initech", "Umbrella Labs", "Hooli"];

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Small deterministic hash so the same company always gets the same sample people. */
function seed(value: string): number {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

/**
 * Deterministic sample people, clearly marked as samples. Titles follow the
 * search so the ranking has something realistic to work with, and one person
 * shares the user's school so connection angles can be seen working.
 */
export class MockPeopleProvider implements PeopleProvider {
  readonly name = "mock";

  async searchPeople(input: PeopleSearchInput): Promise<PersonCandidate[]> {
    const domain = input.companyDomain ?? `${slug(input.companyName)}.example`;
    const base = seed(input.companyName.toLowerCase());
    const titles = input.titles.length
      ? input.titles
      : ["Engineering Manager", "Recruiter", "Software Engineer"];
    const count = Math.min(input.limit ?? 8, 8);
    const userSchool = input.hints?.schools?.[0];
    const userCompany = input.hints?.companies?.[0];

    return Array.from({ length: count }, (_, index) => {
      const firstName = FIRST[(base + index) % FIRST.length] ?? "Alex";
      const lastName = LAST[(base + index * 7) % LAST.length] ?? "Lee";
      const title = titles[index % titles.length] ?? "Software Engineer";
      return {
        providerId: `mock-${slug(input.companyName)}-${index}`,
        provider: this.name,
        firstName,
        lastName,
        lastNameIsPartial: false,
        title,
        companyName: input.companyName,
        companyDomain: domain,
        location:
          index % 3 === 0 && input.hints?.location
            ? input.hints.location
            : "Remote",
        linkedinUrl: null,
        schools:
          index === 2 && userSchool
            ? [userSchool]
            : [SCHOOLS[(base + index) % SCHOOLS.length] ?? "City College"],
        pastCompanies:
          index === 4 && userCompany
            ? [userCompany]
            : [COMPANIES[(base + index) % COMPANIES.length] ?? "Globex"],
        hasEmail: true,
        isSample: true,
      };
    });
  }
}
