import { describe, expect, it } from "vitest";

import { localDay } from "@/lib/dates";
import {
  inferTimeZone,
  scheduleSendTime,
  spacingMinutes,
} from "@/lib/sequences/timing";

function localParts(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return {
    weekday: parts.weekday,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

describe("recipient timezone", () => {
  it("guesses from the location and falls back to the user's", () => {
    expect(inferTimeZone("Bengaluru (hybrid)", "UTC")).toBe("Asia/Kolkata");
    expect(inferTimeZone("San Francisco Bay Area", "UTC")).toBe(
      "America/Los_Angeles",
    );
    expect(inferTimeZone("Remote", "Europe/London")).toBe("Europe/London");
    expect(inferTimeZone(null, "Mars/Base")).toBe("UTC");
  });
});

describe("send scheduling", () => {
  // Wednesday 4 March 2026, 15:00 UTC.
  const from = new Date("2026-03-04T15:00:00Z");

  it("sends N days later on a weekday morning in the recipient's time", () => {
    const when = scheduleSendTime({
      from,
      days: 3,
      timeZone: "Asia/Kolkata",
      random: () => 0.5,
    });
    // 3 days after Wed is Sat, so it rolls to Monday 9 March.
    expect(localDay(when, "Asia/Kolkata").isoDate).toBe("2026-03-09");
    const { weekday, minutes } = localParts(when, "Asia/Kolkata");
    expect(weekday).toBe("Mon");
    expect(minutes).toBe(9 * 60 + 75);
  });

  it("always lands inside 09:00-11:30 local time, on a weekday, after the start", () => {
    for (const timeZone of [
      "America/Los_Angeles",
      "Europe/London",
      "Asia/Tokyo",
    ]) {
      for (const days of [0, 3, 7]) {
        for (const r of [0, 0.25, 0.99]) {
          const when = scheduleSendTime({
            from,
            days,
            timeZone,
            random: () => r,
          });
          const { weekday, minutes } = localParts(when, timeZone);
          expect(["Sat", "Sun"]).not.toContain(weekday);
          expect(minutes).toBeGreaterThanOrEqual(540);
          expect(minutes).toBeLessThan(690);
          expect(when.getTime()).toBeGreaterThan(from.getTime());
        }
      }
    }
  });

  it("pushes a same-day slot that has already passed to the next weekday", () => {
    const lateMorning = new Date("2026-03-04T06:30:00Z"); // 12:00 in India, after the window
    const when = scheduleSendTime({
      from: lateMorning,
      days: 0,
      timeZone: "Asia/Kolkata",
      random: () => 0,
    });
    expect(localDay(when, "Asia/Kolkata").isoDate).toBe("2026-03-05");
  });

  it("spaces sends a few minutes apart", () => {
    expect(spacingMinutes(() => 0)).toBe(3);
    expect(spacingMinutes(() => 0.999)).toBe(9);
  });
});
