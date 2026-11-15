export interface EmailFindInput {
  firstName: string;
  /** May be partly hidden (e.g. "Ra***n") for people found through Apollo search. */
  lastName: string | null;
  companyDomain: string | null;
  companyName: string;
  /** The person's id at the provider they came from, e.g. an Apollo person id. */
  providerPersonId: string | null;
  source: string;
}

/** Only "valid" is sendable by default; "risky" needs explicit user confirmation. */
export type EmailVerificationStatus = "valid" | "risky" | "invalid" | "unknown";

export interface EmailFindResult {
  email: string;
  provider: string;
  /** 0-100, as reported by the provider. */
  confidence: number;
  /** Some finders also verify; reusing it saves a verification call. */
  verification: EmailVerificationStatus | null;
  /** Some finders reveal the full surname a search hid. */
  lastName: string | null;
}

export interface EmailVerificationResult {
  email: string;
  status: EmailVerificationStatus;
  provider: string;
  /** Provider's own wording, kept for display, e.g. "accept_all". */
  detail: string | null;
}

export interface EmailFinderProvider {
  readonly name: string;
  /** False when this provider cannot look this person up (e.g. surname hidden). */
  canFind(input: EmailFindInput): boolean;
  /** Resolves to null when this provider has no email, so the waterfall moves on. */
  findEmail(input: EmailFindInput): Promise<EmailFindResult | null>;
}

export interface EmailVerifierProvider {
  readonly name: string;
  verifyEmail(email: string): Promise<EmailVerificationResult>;
}

export function hasHiddenCharacters(value: string | null | undefined): boolean {
  return Boolean(value && /\*/.test(value));
}
