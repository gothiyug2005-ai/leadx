export interface EmailFindInput {
  firstName: string;
  lastName: string;
  companyDomain: string;
}

export interface EmailFindResult {
  email: string;
  provider: string;
  /** 0-100, as reported by the provider. */
  confidence: number;
}

/** Only "valid" is sendable by default; "risky" needs explicit user confirmation. */
export type EmailVerificationStatus = "valid" | "risky" | "invalid" | "unknown";

export interface EmailVerificationResult {
  email: string;
  status: EmailVerificationStatus;
  provider: string;
}

export interface EmailFinderProvider {
  readonly name: string;
  /** Resolves to null when this provider has no email, so the waterfall moves on. */
  findEmail(input: EmailFindInput): Promise<EmailFindResult | null>;
}

export interface EmailVerifierProvider {
  readonly name: string;
  verifyEmail(email: string): Promise<EmailVerificationResult>;
}
