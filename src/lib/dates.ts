/**
 * Timezone helpers. LeadX schedules and counts things in the user's own
 * calendar day, so "today" always means today where the user is.
 */

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Fall back to UTC for missing or unknown timezones. */
export function safeTimeZone(timeZone: string | null | undefined): string {
  return timeZone && isValidTimeZone(timeZone) ? timeZone : "UTC";
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const values: Record<string, number> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  return {
    year: values.year ?? 1970,
    month: values.month ?? 1,
    day: values.day ?? 1,
    hour: values.hour ?? 0,
    minute: values.minute ?? 0,
    second: values.second ?? 0,
  };
}

/** Minutes the timezone is ahead of UTC at the given instant (India = 330). */
export function timeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  const whole = Math.floor(date.getTime() / 1000) * 1000;
  return Math.round((asUtc - whole) / 60000);
}

/** The UTC instant of a wall-clock time in a timezone. Handles DST transitions. */
export function zonedTimeToUtc(
  wall: {
    year: number;
    month: number;
    day: number;
    hour?: number;
    minute?: number;
  },
  timeZone: string,
): Date {
  const naive = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour ?? 0,
    wall.minute ?? 0,
  );
  let guess = naive - timeZoneOffsetMinutes(new Date(naive), timeZone) * 60000;
  // A second pass settles the offset when the first guess crossed a DST change.
  guess = naive - timeZoneOffsetMinutes(new Date(guess), timeZone) * 60000;
  return new Date(guess);
}

export interface LocalDay {
  /** Calendar date in the timezone, e.g. "2026-03-01". */
  isoDate: string;
  /** First instant of that day, in UTC. */
  start: Date;
  /** First instant of the next day, in UTC (exclusive end). */
  end: Date;
  hour: number;
}

export function localDay(now: Date, timeZone: string): LocalDay {
  const tz = safeTimeZone(timeZone);
  const p = zonedParts(now, tz);
  const start = zonedTimeToUtc(
    { year: p.year, month: p.month, day: p.day },
    tz,
  );
  const next = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
  const end = zonedTimeToUtc(
    {
      year: next.getUTCFullYear(),
      month: next.getUTCMonth() + 1,
      day: next.getUTCDate(),
    },
    tz,
  );
  const isoDate = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  return { isoDate, start, end, hour: p.hour };
}

export function greetingForHour(hour: number): string {
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function formatLongDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone(timeZone),
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

/** "in 3 hours", "2 days ago". */
export function formatRelative(date: Date, now: Date): string {
  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, seconds] of units) {
    if (Math.abs(diffSeconds) >= seconds) {
      return formatter.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  return "just now";
}
