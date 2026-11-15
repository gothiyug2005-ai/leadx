import { z } from "zod";

import { ProviderError } from "@/lib/providers/people/types";

import type {
  EmailFindInput,
  EmailFindResult,
  EmailFinderProvider,
} from "./types";

const ENDPOINT = "https://api.apollo.io/api/v1/people/match";

const matchSchema = z.object({
  person: z
    .object({
      email: z.string().nullish(),
      email_status: z.string().nullish(),
      last_name: z.string().nullish(),
    })
    .nullish(),
});

/**
 * Apollo People Enrichment (uses Apollo credits). Looks a person up by Apollo
 * id when we have one, otherwise by name and company. Also reveals the full
 * surname that Apollo search hides.
 */
export class ApolloEmailFinder implements EmailFinderProvider {
  readonly name = "apollo";

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  canFind(input: EmailFindInput): boolean {
    const hasApolloId =
      input.source === "apollo" && Boolean(input.providerPersonId);
    return (
      hasApolloId ||
      Boolean(input.firstName && (input.companyDomain || input.companyName))
    );
  }

  async findEmail(input: EmailFindInput): Promise<EmailFindResult | null> {
    if (!this.canFind(input)) return null;
    const params = new URLSearchParams({
      reveal_personal_emails: "false",
      reveal_phone_number: "false",
    });
    if (input.source === "apollo" && input.providerPersonId) {
      params.set("id", input.providerPersonId);
    } else {
      params.set("first_name", input.firstName);
      if (input.lastName && !/\*/.test(input.lastName))
        params.set("last_name", input.lastName);
      if (input.companyDomain) params.set("domain", input.companyDomain);
      else params.set("organization_name", input.companyName);
    }

    let response: Response;
    try {
      response = await this.fetchImpl(`${ENDPOINT}?${params.toString()}`, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "content-type": "application/json",
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
        "Apollo rejected the API key for enrichment.",
      );
    }
    if (response.status === 422 || response.status === 429) {
      throw new ProviderError(
        "apollo",
        "rate_limited",
        "Apollo's limit was reached. Try again later.",
      );
    }
    if (response.status === 404) return null;
    if (!response.ok)
      throw new ProviderError(
        "apollo",
        "unavailable",
        `Apollo returned ${response.status}.`,
      );

    const parsed = matchSchema.safeParse(
      await response.json().catch(() => null),
    );
    const person = parsed.success ? parsed.data.person : null;
    const email =
      person?.email && !/email_not_unlocked|not_unlocked/i.test(person.email)
        ? person.email
        : null;
    if (!email) return null;
    return {
      email: email.toLowerCase(),
      provider: this.name,
      confidence: person?.email_status === "verified" ? 90 : 60,
      // Apollo's own check is not trusted as final; the verifier decides.
      verification: null,
      lastName: person?.last_name ?? null,
    };
  }
}
