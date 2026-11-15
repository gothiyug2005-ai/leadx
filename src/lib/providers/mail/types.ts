export interface OutgoingEmail {
  to: string;
  subject: string;
  body: string;
  fromName: string | null;
  /** Continue an existing Gmail thread (follow-ups). */
  threadId?: string | null;
  inReplyTo?: string | null;
}

export interface SentEmail {
  messageId: string;
  threadId: string | null;
  rfcMessageId: string | null;
}

export interface MailProvider {
  /** Matches the provider recorded by the send gate: "gmail" or "mock". */
  readonly name: "gmail" | "mock";
  readonly fromAddress: string;
  send(email: OutgoingEmail): Promise<SentEmail>;
}

export class MailError extends Error {
  constructor(
    readonly code: "auth" | "rate_limited" | "rejected" | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "MailError";
  }
}
