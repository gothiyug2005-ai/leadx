import { z } from "zod";

import {
  ProviderError,
  type PeopleProvider,
  type PeopleSearchInput,
  type PersonCandidate,
} from "./types";

const ENDPOINT = "https://api.apollo.io/api/v1/mixed_people/api_search";

// Parsed leniently: Apollo returns more fields than this, and some are absent per person.
const apolloPersonSchema = z.object({
  id: z.string(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  last_name_obfuscated: z.string().nullish(),
  name: z.string().nullish(),
  title: z.string().nullish(),
  linkedin_url: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  country: z.string().nullish(),
  has_email: z.boolean().nullish(),
  organization: z
    .object({
      name: z.string().nullish(),
      primary_domain: z.string().nullish(),
      website_url: z.string().nullish(),
    })
    .nullish(),
});

const apolloResponseSchema = z.object({
  people: z.array(z.unknown()).nullish(),
});

function toCandidate(
  raw: unknown,
  input: PeopleSearchInput,
): PersonCandidate | null {
  const parsed = apolloPersonSchema.safeParse(raw);
  if (!parsed.success) return null;
  const person = parsed.data;
  const firstName = person.first_name ?? person.name?.split(" ")[0] ?? null;
  if (!firstName) return null;

  const lastName = person.last_name ?? person.last_name_obfuscated ?? null;
  return {
    providerId: person.id,
    provider: "apollo",
    firstName,
    lastName,
    lastNameIsPartial:
      !person.last_name && Boolean(person.last_name_obfuscated),
    title: person.title ?? null,
    companyName: person.organization?.name ?? input.companyName,
    companyDomain:
      person.organization?.primary_domain ?? input.companyDomain ?? null,
    location:
      [person.city, person.state, person.country].filter(Boolean).join(", ") ||
      null,
    linkedinUrl: person.linkedin_url ?? null,
    schools: [],
    pastCompanies: [],
    hasEmail: person.has_email ?? null,
    isSample: false,
  };
}

/**
 * Apollo People API Search. Free of credits; returns people without emails and
 * with partly hidden surnames, which enrichment (Step 7) fills in.
 */
export class ApolloPeopleProvider implements PeopleProvider {
  readonly name = "apollo";

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async searchPeople(input: PeopleSearchInput): Promise<PersonCandidate[]> {
    const params = new URLSearchParams();
    for (const title of input.titles.slice(0, 15))
      params.append("person_titles[]", title);
    if (input.companyDomain) {
      params.append("q_organization_domains_list[]", input.companyDomain);
    } else {
      params.set("q_keywords", input.companyName);
    }
    params.set("include_similar_titles", "true");
    params.set("per_page", String(Math.min(input.limit ?? 25, 100)));
    params.set("page", "1");

    let response: Response;
    try {
      response = await this.fetchImpl(`${ENDPOINT}?${params.toString()}`, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "content-type": "application/json",
          "cache-control": "no-cache",
          accept: "application/json",
        },
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new ProviderError(
        "apollo",
        "unavailable",
        "Apollo did not respond.",
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new ProviderError(
        "apollo",
        "auth",
        "Apollo rejected the API key (People Search needs a master API key).",
      );
    }
    if (response.status === 422 || response.status === 429) {
      throw new ProviderError(
        "apollo",
        "rate_limited",
        "Apollo's hourly limit was reached. Try again later.",
      );
    }
    if (!response.ok) {
      throw new ProviderError(
        "apollo",
        "unavailable",
        `Apollo returned ${response.status}.`,
      );
    }

    const body = apolloResponseSchema.safeParse(
      await response.json().catch(() => null),
    );
    if (!body.success)
      throw new ProviderError(
        "apollo",
        "bad_response",
        "Apollo returned an unexpected response.",
      );

    return (body.data.people ?? [])
      .map((raw) => toCandidate(raw, input))
      .filter((candidate): candidate is PersonCandidate => candidate !== null);
  }
}
