export type RoleType =
  "hiring_manager" | "recruiter" | "team_member" | "alumni" | "leadership";

export interface PeopleSearchInput {
  companyName: string;
  companyDomain?: string;
  /** Job titles or keywords to bias the search, e.g. ["engineering manager", "recruiter"]. */
  titleKeywords?: string[];
  limit?: number;
}

export interface PersonCandidate {
  /** Stable id within the provider, used for caching and de-duplication. */
  providerId: string;
  provider: string;
  fullName: string;
  firstName: string;
  lastName: string;
  title: string;
  companyName: string;
  companyDomain?: string;
  location?: string;
  linkedinUrl?: string;
  /** Present only if the provider returns it as part of search. */
  email?: string;
}

export interface PeopleProvider {
  readonly name: string;
  searchPeople(input: PeopleSearchInput): Promise<PersonCandidate[]>;
}
