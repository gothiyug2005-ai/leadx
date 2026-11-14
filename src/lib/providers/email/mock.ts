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

/** Deterministic fake finder: always returns first.last@domain. */
export class MockEmailFinder implements EmailFinderProvider {
  readonly name = "mock";

  async findEmail(input: EmailFindInput): Promise<EmailFindResult | null> {
    const first = normalise(input.firstName);
    const last = normalise(input.lastName);
    if (!first || !last) return null;

    return {
      email: `${first}.${last}@${input.companyDomain.toLowerCase()}`,
      provider: this.name,
      confidence: 90,
    };
  }
}

/**
 * Deterministic fake verifier. Addresses containing "risky" or "invalid"
 * return that status so those UI paths can be exercised without real data.
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
    return { email, status, provider: this.name };
  }
}
