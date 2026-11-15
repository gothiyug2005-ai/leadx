import { z } from "zod";

import { ProviderError } from "@/lib/providers/people/types";

import {
  hasHiddenCharacters,
  type EmailFindInput,
  type EmailFindResult,
  type EmailFinderProvider,
  type EmailVerificationResult,
  type EmailVerificationStatus,
  type EmailVerifierProvider,
} from "./types";

const BASE = "https://api.hunter.io/v2";

/**
 * Hunter's verifier statuses mapped to LeadX's. accept_all ("catch-all") and
 * webmail cannot be confirmed, so they need the user's explicit go-ahead.
 */
export function mapHunterStatus(
  status: string | null | undefined,
): EmailVerificationStatus {
  switch (status) {
    case "valid":
      return "valid";
    case "invalid":
    case "disposable":
      return "invalid";
    case "accept_all":
    case "webmail":
      return "risky";
    default:
      return "unknown";
  }
}

async function call(fetchImpl: typeof fetch, url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      signal: AbortSignal.timeout(20_000),
      headers: { accept: "application/json" },
    });
  } catch {
    throw new ProviderError("hunter", "unavailable", "Hunter did not respond.");
  }
  if (response.status === 401 || response.status === 403) {
    throw new ProviderError(
      "hunter",
      "auth",
      "Hunter rejected the API key, or the plan ran out of credits.",
    );
  }
  if (response.status === 429)
    throw new ProviderError(
      "hunter",
      "rate_limited",
      "Hunter's rate limit was reached.",
    );
  // 404 / 400 for "not found" style answers: treat as no result.
  if (
    response.status === 404 ||
    response.status === 400 ||
    response.status === 451
  )
    return null;
  if (!response.ok)
    throw new ProviderError(
      "hunter",
      "unavailable",
      `Hunter returned ${response.status}.`,
    );
  return response.json().catch(() => null);
}

const finderSchema = z.object({
  data: z
    .object({
      email: z.string().nullish(),
      score: z.number().nullish(),
      last_name: z.string().nullish(),
      verification: z.object({ status: z.string().nullish() }).nullish(),
    })
    .nullish(),
});

const verifierSchema = z.object({
  data: z.object({ status: z.string().nullish() }).nullish(),
});

export class HunterEmailFinder implements EmailFinderProvider {
  readonly name = "hunter";

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  canFind(input: EmailFindInput): boolean {
    return Boolean(
      input.companyDomain &&
      input.firstName &&
      input.lastName &&
      !hasHiddenCharacters(input.lastName),
    );
  }

  async findEmail(input: EmailFindInput): Promise<EmailFindResult | null> {
    if (!this.canFind(input)) return null;
    const params = new URLSearchParams({
      domain: input.companyDomain ?? "",
      first_name: input.firstName,
      last_name: input.lastName ?? "",
      api_key: this.apiKey,
    });
    const parsed = finderSchema.safeParse(
      await call(this.fetchImpl, `${BASE}/email-finder?${params.toString()}`),
    );
    const data = parsed.success ? parsed.data.data : null;
    if (!data?.email) return null;
    return {
      email: data.email.toLowerCase(),
      provider: this.name,
      confidence: Math.max(0, Math.min(100, Math.round(data.score ?? 0))),
      verification: data.verification?.status
        ? mapHunterStatus(data.verification.status)
        : null,
      lastName: data.last_name ?? null,
    };
  }
}

export class HunterEmailVerifier implements EmailVerifierProvider {
  readonly name = "hunter";

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async verifyEmail(email: string): Promise<EmailVerificationResult> {
    const params = new URLSearchParams({ email, api_key: this.apiKey });
    const parsed = verifierSchema.safeParse(
      await call(this.fetchImpl, `${BASE}/email-verifier?${params.toString()}`),
    );
    const status = parsed.success ? (parsed.data.data?.status ?? null) : null;
    return {
      email,
      status: mapHunterStatus(status),
      provider: this.name,
      detail: status,
    };
  }
}
