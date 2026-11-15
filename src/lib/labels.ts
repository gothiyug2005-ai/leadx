/** Human-readable labels for values stored in the database. */

export const ROLE_TYPE_LABELS = {
  hiring_manager: "Hiring manager",
  recruiter: "Recruiter",
  team_member: "Team member",
  alumni: "Alumni",
  leadership: "Leadership",
} as const satisfies Record<string, string>;

export const STAGE_LABELS = {
  to_contact: "To contact",
  contacted: "Contacted",
  followed_up: "Followed up",
  replied: "Replied",
  interview: "Interview",
  offer: "Offer",
  closed: "Closed",
} as const satisfies Record<string, string>;

export const CLASSIFICATION_LABELS = {
  interested: "Interested",
  referral_offered: "Referral offered",
  not_now: "Not now",
  not_relevant: "Not relevant",
  opt_out: "Opted out",
} as const satisfies Record<string, string>;

export function labelFor<T extends Record<string, string>>(
  labels: T,
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  return (labels as Record<string, string>)[value] ?? null;
}
