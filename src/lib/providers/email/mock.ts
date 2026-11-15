import type {
  EmailFindInput,
  EmailFindResult,
  EmailFinderProvider,
  EmailVerificationResult,
  EmailVerifierProvider,
} from "./types";

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

/** Deterministic sample finder: first.last@domain. */
export class MockEmailFinder implements EmailFinderProvider {
  readonly name = "mock";

  canFind(input: EmailFindInput): boolean {
    return Boolean(input.firstName && input.lastName && input.companyDomain);
  }

  async findEmail(input: EmailFindInput): Promise<EmailFindResult | null> {
    const first = normalise(input.firstName);
    const last = normalise(input.lastName ?? "");
    if (!first || !last || !input.companyDomain) return null;
    return {
      email: `${first}.${last}@${input.companyDomain.toLowerCase()}`,
      provider: this.name,
      confidence: 90,
      verification: null,
      lastName: null,
    };
  }
}

/**
 * Deterministic sample verifier. Addresses containing "risky" or "invalid"
 * get that status so those paths can be tried without real data.
 */
export class MockEmailVerifier implements EmailVerifierProvider {
  readonly name = "mock";

  async verifyEmail(email: string): Promise<EmailVerificationResult> {
    const lower = email.toLowerCase();
    const status = lower.includes("invalid")
      ? "invalid"
      : lower.includes("risky")
        ? "risky"
        : "valid";
    return { email, status, provider: this.name, detail: "sample" };
  }
}
