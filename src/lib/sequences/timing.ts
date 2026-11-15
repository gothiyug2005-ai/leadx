import { localDay, safeTimeZone, zonedTimeToUtc } from "@/lib/dates";

/** Best guess at a recipient's timezone from a free-text location. */
const LOCATION_ZONES: [RegExp, string][] = [
  [
    /\b(india|bengaluru|bangalore|mumbai|delhi|gurgaon|gurugram|noida|hyderabad|pune|chennai|kolkata)\b/i,
    "Asia/Kolkata",
  ],
  [/\b(singapore)\b/i, "Asia/Singapore"],
  [/\b(dubai|uae|abu dhabi)\b/i, "Asia/Dubai"],
  [
    /\b(london|uk|united kingdom|england|manchester|edinburgh)\b/i,
    "Europe/London",
  ],
  [/\b(dublin|ireland)\b/i, "Europe/Dublin"],
  [
    /\b(berlin|munich|germany|paris|france|amsterdam|netherlands|madrid|spain|stockholm|sweden|zurich|switzerland|warsaw|poland)\b/i,
    "Europe/Berlin",
  ],
  [
    /\b(new york|nyc|boston|washington|atlanta|miami|toronto|ontario|philadelphia)\b/i,
    "America/New_York",
  ],
  [/\b(chicago|austin|dallas|houston|texas|minneapolis)\b/i, "America/Chicago"],
  [/\b(denver|colorado|salt lake)\b/i, "America/Denver"],
  [
    /\b(san francisco|bay area|seattle|los angeles|california|portland|vancouver|palo alto|mountain view|san jose)\b/i,
    "America/Los_Angeles",
  ],
  [/\b(sydney|melbourne|australia)\b/i, "Australia/Sydney"],
  [/\b(tokyo|japan)\b/i, "Asia/Tokyo"],
];

export function inferTimeZone(
  location: string | null | undefined,
  fallback: string,
): string {
  if (location) {
    for (const [pattern, zone] of LOCATION_ZONES)
      if (pattern.test(location)) return zone;
  }
  return safeTimeZone(fallback);
}

/** Morning window in the recipient's own time, when work email is most likely read. */
const WINDOW_START_MINUTES = 9 * 60;
const WINDOW_LENGTH_MINUTES = 150; // 09:00 to 11:30

function weekdayIn(date: Date, timeZone: string): number {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

/**
 * When to send something `days` after `from`: a weekday morning in the
 * recipient's timezone, at a random minute so sends never look scheduled.
 * Weekends roll forward to Monday. Never earlier than `from`.
 */
export function scheduleSendTime(input: {
  from: Date;
  days: number;
  timeZone: string;
  random?: () => number;
}): Date {
  const random = input.random ?? Math.random;
  const timeZone = safeTimeZone(input.timeZone);
  const start = localDay(input.from, timeZone);
  const [year, month, day] = start.isoDate.split("-").map(Number) as [
    number,
    number,
    number,
  ];

  for (let extra = 0; extra < 14; extra += 1) {
    const candidateDay = new Date(
      Date.UTC(year, month - 1, day + input.days + extra, 12),
    );
    const minutes =
      WINDOW_START_MINUTES + Math.floor(random() * WINDOW_LENGTH_MINUTES);
    const when = zonedTimeToUtc(
      {
        year: candidateDay.getUTCFullYear(),
        month: candidateDay.getUTCMonth() + 1,
        day: candidateDay.getUTCDate(),
        hour: Math.floor(minutes / 60),
        minute: minutes % 60,
      },
      timeZone,
    );
    const weekday = weekdayIn(when, timeZone);
    if (weekday === 0 || weekday === 6) continue;
    if (when.getTime() <= input.from.getTime()) continue;
    return when;
  }
  // Unreachable in practice: there is always a weekday within two weeks.
  return new Date(input.from.getTime() + input.days * 86_400_000);
}

/** A few random minutes between one user's sends, so a batch never goes out in a burst. */
export function spacingMinutes(random: () => number = Math.random): number {
  return 3 + Math.floor(random() * 7);
}
