/** The writing rules every LeadX message follows. Shared by the prompts and the checker. */

export const MESSAGE_TYPES = [
  "cold_email",
  "referral_request",
  "linkedin_note",
  "linkedin_dm",
  "follow_up",
] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export interface MessageRules {
  label: string;
  channel: "email" | "linkedin";
  hasSubject: boolean;
  maxWords: number | null;
  maxChars: number | null;
  needsOptOut: boolean;
  description: string;
}

export const RULES: Record<MessageType, MessageRules> = {
  cold_email: {
    label: "Cold email",
    channel: "email",
    hasSubject: true,
    maxWords: 120,
    maxChars: null,
    needsOptOut: true,
    description: "A first email to someone who does not know you.",
  },
  referral_request: {
    label: "Referral request",
    channel: "email",
    hasSubject: true,
    maxWords: 120,
    maxChars: null,
    needsOptOut: true,
    description: "Ask someone on the team if they would refer you.",
  },
  linkedin_note: {
    label: "LinkedIn note",
    channel: "linkedin",
    hasSubject: false,
    maxWords: null,
    maxChars: 300,
    needsOptOut: false,
    description:
      "The short note sent with a connection request (300 characters).",
  },
  linkedin_dm: {
    label: "LinkedIn message",
    channel: "linkedin",
    hasSubject: false,
    maxWords: 100,
    maxChars: null,
    needsOptOut: false,
    description: "A direct message to someone you are already connected with.",
  },
  follow_up: {
    label: "Follow-up",
    channel: "email",
    hasSubject: true,
    maxWords: 60,
    maxChars: null,
    needsOptOut: true,
    description: "A short, polite nudge after an email with no reply.",
  },
};

export const MAX_SUBJECT_WORDS = 7;

export const ANGLES = [
  "skills_match",
  "shared_background",
  "company_news",
  "team_curiosity",
] as const;
export type Angle = (typeof ANGLES)[number];

export const ANGLE_LABELS: Record<Angle, string> = {
  skills_match: "Skills match",
  shared_background: "Shared background",
  company_news: "Company news",
  team_curiosity: "Curious about the team",
};

export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/** Writing rules as plain text, for the prompts. */
export function rulesText(type: MessageType): string {
  const rules = RULES[type];
  const limits = [
    rules.maxWords ? `Body at most ${rules.maxWords} words.` : "",
    rules.maxChars
      ? `At most ${rules.maxChars} characters in total, including spaces.`
      : "",
    rules.hasSubject
      ? `Subject line at most ${MAX_SUBJECT_WORDS} words, plain and specific, no clickbait.`
      : "No subject line (set subject to null).",
    rules.needsOptOut
      ? 'End with one short, polite opt-out line, e.g. "If this isn\'t a good time, no worries at all."'
      : "No opt-out line needed.",
  ].filter(Boolean);
  return [`Message type: ${rules.label}. ${rules.description}`, ...limits].join(
    "\n",
  );
}
