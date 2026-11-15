export type AiErrorCode =
  | "refused"
  | "truncated"
  | "invalid_output"
  | "rate_limited"
  | "unavailable"
  | "auth"
  | "bad_request"
  | "daily_limit";

const MESSAGES: Record<AiErrorCode, string> = {
  refused: "The AI declined this request. Try rephrasing or editing the input.",
  truncated: "The AI's answer was cut off. Please try again.",
  invalid_output:
    "The AI returned something we could not understand. Please try again.",
  rate_limited: "The AI is busy right now. Wait a minute and try again.",
  unavailable:
    "The AI service is temporarily unavailable. Please try again soon.",
  auth: "The AI is not set up correctly (check ANTHROPIC_API_KEY).",
  bad_request: "The AI could not process this input.",
  daily_limit:
    "You have used today's AI allowance. It frees up gradually over the next 24 hours.",
};

export class AiError extends Error {
  readonly code: AiErrorCode;

  constructor(code: AiErrorCode, detail?: string) {
    super(detail ? `${MESSAGES[code]} (${detail})` : MESSAGES[code]);
    this.name = "AiError";
    this.code = code;
  }

  /** Safe to show to the user. */
  get userMessage(): string {
    return MESSAGES[this.code];
  }
}
