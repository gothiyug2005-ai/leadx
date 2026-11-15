import { describe, expect, it } from "vitest";

import {
  formatRelative,
  greetingForHour,
  localDay,
  safeTimeZone,
  timeZoneOffsetMinutes,
  zonedTimeToUtc,
} from "@/lib/dates";

describe("timezone helpers", () => {
  it("knows the offset of a fixed timezone", () => {
    expect(
      timeZoneOffsetMinutes(new Date("2026-03-01T12:00:00Z"), "Asia/Kolkata"),
    ).toBe(330);
    expect(timeZoneOffsetMinutes(new Date("2026-03-01T12:00:00Z"), "UTC")).toBe(
      0,
    );
  });

  it("follows daylight saving time", () => {
    expect(
      timeZoneOffsetMinutes(
        new Date("2026-01-15T12:00:00Z"),
        "America/New_York",
      ),
    ).toBe(-300);
    expect(
      timeZoneOffsetMinutes(
        new Date("2026-07-15T12:00:00Z"),
        "America/New_York",
      ),
    ).toBe(-240);
  });

  it("converts local midnight to UTC", () => {
    expect(
      zonedTimeToUtc(
        { year: 2026, month: 3, day: 2 },
        "Asia/Kolkata",
      ).toISOString(),
    ).toBe("2026-03-01T18:30:00.000Z");
  });

  it("finds the user's calendar day, not the server's", () => {
    // 18:40 UTC on 1 March is already 2 March in India.
    const day = localDay(new Date("2026-03-01T18:40:00Z"), "Asia/Kolkata");
    expect(day.isoDate).toBe("2026-03-02");
    expect(day.start.toISOString()).toBe("2026-03-01T18:30:00.000Z");
    expect(day.end.toISOString()).toBe("2026-03-02T18:30:00.000Z");
    expect(day.hour).toBe(0);
  });

  it("handles the short day when clocks spring forward", () => {
    const day = localDay(new Date("2026-03-08T15:00:00Z"), "America/New_York");
    expect(day.isoDate).toBe("2026-03-08");
    expect((day.end.getTime() - day.start.getTime()) / 3600000).toBe(23);
  });

  it("falls back to UTC for unknown timezones", () => {
    expect(safeTimeZone("Mars/Olympus")).toBe("UTC");
    expect(safeTimeZone(null)).toBe("UTC");
    expect(
      localDay(new Date("2026-03-01T23:30:00Z"), "Mars/Olympus").isoDate,
    ).toBe("2026-03-01");
  });

  it("greets by time of day", () => {
    expect(greetingForHour(8)).toBe("Good morning");
    expect(greetingForHour(14)).toBe("Good afternoon");
    expect(greetingForHour(20)).toBe("Good evening");
    expect(greetingForHour(2)).toBe("Good evening");
  });

  it("describes relative times", () => {
    const now = new Date("2026-03-01T12:00:00Z");
    expect(formatRelative(new Date("2026-03-01T15:00:00Z"), now)).toBe(
      "in 3 hours",
    );
    expect(formatRelative(new Date("2026-02-27T12:00:00Z"), now)).toBe(
      "2 days ago",
    );
    expect(formatRelative(new Date("2026-03-01T12:00:20Z"), now)).toBe(
      "just now",
    );
  });
});
