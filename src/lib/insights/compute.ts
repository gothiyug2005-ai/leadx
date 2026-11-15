import { localDay, zonedTimeToUtc } from "@/lib/dates";

export interface InsightPerson {
  id: string;
  stage: string;
  role_type: string | null;
}

export interface InsightMessage {
  person_id: string;
  type: string;
  angle: string | null;
  sent_at: string;
}

export interface InsightReply {
  person_id: string;
  sent_at: string;
}

export interface RateRow {
  key: string;
  sent: number;
  replied: number;
  rate: number;
}

export interface Insights {
  sent: number;
  contacted: number;
  replied: number;
  replyRate: number;
  interviews: number;
  offers: number;
  weekly: { weekStart: string; sends: number; replies: number }[];
  funnel: {
    stage: "contacted" | "replied" | "interview" | "offer";
    count: number;
  }[];
  byAngle: RateRow[];
  byRoleType: RateRow[];
}

const FIRST_EMAILS = new Set(["cold_email", "referral_request"]);
const OUTREACH = new Set(["cold_email", "referral_request", "follow_up"]);
const INTERVIEW_OR_LATER = new Set(["interview", "offer"]);

function rate(replied: number, sent: number): number {
  return sent === 0 ? 0 : replied / sent;
}

/** Monday of the week containing `date`, in the user's time zone, as YYYY-MM-DD. */
export function weekStart(date: Date, timeZone: string): string {
  const day = localDay(date, timeZone);
  const [y, m, d] = day.isoDate.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const noon = new Date(Date.UTC(y, m - 1, d, 12));
  const weekday = (noon.getUTCDay() + 6) % 7; // Monday = 0
  const monday = new Date(Date.UTC(y, m - 1, d - weekday, 12));
  return monday.toISOString().slice(0, 10);
}

function groupRates(entries: { key: string; replied: boolean }[]): RateRow[] {
  const groups = new Map<string, { sent: number; replied: number }>();
  for (const entry of entries) {
    const group = groups.get(entry.key) ?? { sent: 0, replied: 0 };
    group.sent += 1;
    if (entry.replied) group.replied += 1;
    groups.set(entry.key, group);
  }
  return [...groups.entries()]
    .map(([key, value]) => ({
      key,
      ...value,
      rate: rate(value.replied, value.sent),
    }))
    .sort((a, b) => b.rate - a.rate || b.sent - a.sent);
}

/**
 * Turn raw rows into the dashboard's numbers. A "reply" is a real human reply
 * (not an out-of-office or bounce). Reply rate is per person contacted, so
 * follow-ups do not dilute it.
 */
export function computeInsights(
  input: {
    people: InsightPerson[];
    messages: InsightMessage[];
    replies: InsightReply[];
  },
  options: { now: Date; timeZone: string; weeks?: number },
): Insights {
  const outreach = input.messages.filter((message) =>
    OUTREACH.has(message.type),
  );
  const contactedIds = new Set(outreach.map((message) => message.person_id));
  const repliedIds = new Set(
    input.replies
      .map((reply) => reply.person_id)
      .filter((id) => contactedIds.has(id)),
  );
  const people = new Map(input.people.map((person) => [person.id, person]));

  const interviews = input.people.filter((person) =>
    INTERVIEW_OR_LATER.has(person.stage),
  ).length;
  const offers = input.people.filter(
    (person) => person.stage === "offer",
  ).length;

  const weeks = options.weeks ?? 8;
  const thisWeek = weekStart(options.now, options.timeZone);
  const [y, m, d] = thisWeek.split("-").map(Number) as [number, number, number];
  const starts = Array.from({ length: weeks }, (_, index) =>
    new Date(Date.UTC(y, m - 1, d - (weeks - 1 - index) * 7, 12))
      .toISOString()
      .slice(0, 10),
  );
  const weekly = starts.map((start) => ({
    weekStart: start,
    sends: 0,
    replies: 0,
  }));
  const bucket = new Map(weekly.map((row) => [row.weekStart, row]));
  for (const message of outreach) {
    const row = bucket.get(
      weekStart(new Date(message.sent_at), options.timeZone),
    );
    if (row) row.sends += 1;
  }
  for (const reply of input.replies) {
    const row = bucket.get(
      weekStart(new Date(reply.sent_at), options.timeZone),
    );
    if (row) row.replies += 1;
  }

  // First email per person decides the angle that earned (or did not earn) the reply.
  const firstByPerson = new Map<string, InsightMessage>();
  for (const message of [...outreach].sort((a, b) =>
    a.sent_at.localeCompare(b.sent_at),
  )) {
    if (FIRST_EMAILS.has(message.type) && !firstByPerson.has(message.person_id))
      firstByPerson.set(message.person_id, message);
  }
  const byAngle = groupRates(
    [...firstByPerson.values()]
      .filter((message) => message.angle)
      .map((message) => ({
        key: message.angle!,
        replied: repliedIds.has(message.person_id),
      })),
  );
  const byRoleType = groupRates(
    [...contactedIds].map((id) => ({
      key: people.get(id)?.role_type ?? "unknown",
      replied: repliedIds.has(id),
    })),
  );

  return {
    sent: outreach.length,
    contacted: contactedIds.size,
    replied: repliedIds.size,
    replyRate: rate(repliedIds.size, contactedIds.size),
    interviews,
    offers,
    weekly,
    funnel: [
      { stage: "contacted", count: contactedIds.size },
      { stage: "replied", count: repliedIds.size },
      { stage: "interview", count: interviews },
      { stage: "offer", count: offers },
    ],
    byAngle,
    byRoleType,
  };
}

/** UTC instant for the start of the earliest week shown, for querying. */
export function windowStart(now: Date, timeZone: string, weeks = 8): Date {
  const start = weekStart(now, timeZone);
  const [y, m, d] = start.split("-").map(Number) as [number, number, number];
  const first = new Date(Date.UTC(y, m - 1, d - (weeks - 1) * 7, 12));
  return zonedTimeToUtc(
    {
      year: first.getUTCFullYear(),
      month: first.getUTCMonth() + 1,
      day: first.getUTCDate(),
    },
    timeZone,
  );
}
