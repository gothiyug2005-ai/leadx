export type RoleType =
  "hiring_manager" | "recruiter" | "team_member" | "alumni" | "leadership";

export interface PeopleSearchInput {
  companyName: string;
  companyDomain?: string | null;
  /** Job titles to look for, e.g. ["Engineering Manager", "Technical Recruiter"]. */
  titles: string[];
  /** Hints from the user's own profile; only the sample provider uses them. */
  hints?: {
    schools?: string[];
    companies?: string[];
    location?: string | null;
  };
  limit?: number;
}

export interface PersonCandidate {
  /** Stable id within the provider, used for caching and de-duplication. */
  providerId: string;
  provider: string;
  firstName: string;
  /** May be partly hidden by the provider until the person is enriched. */
  lastName: string | null;
  lastNameIsPartial: boolean;
  title: string | null;
  companyName: string;
  companyDomain: string | null;
  location: string | null;
  linkedinUrl: string | null;
  /** Only filled by providers that return history; used to find shared background. */
  schools: string[];
  pastCompanies: string[];
  hasEmail: boolean | null;
  isSample: boolean;
}

export interface PeopleProvider {
  readonly name: string;
  searchPeople(input: PeopleSearchInput): Promise<PersonCandidate[]>;
}

export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly code: "auth" | "rate_limited" | "unavailable" | "bad_response",
    message: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export function candidateFullName(
  candidate: Pick<PersonCandidate, "firstName" | "lastName">,
): string {
  return [candidate.firstName, candidate.lastName].filter(Boolean).join(" ");
}
