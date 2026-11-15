import { describe, expect, it } from "vitest";

import {
  computeInsights,
  weekStart,
  windowStart,
} from "@/lib/insights/compute";

const now = new Date("2026-03-11T10:00:00Z"); // Wednesday

const people = [
  { id: "a", stage: "interview", role_type: "hiring_manager" },
  { id: "b", stage: "replied", role_type: "recruiter" },
  { id: "c", stage: "followed_up", role_type: "recruiter" },
  { id: "d", stage: "offer", role_type: "hiring_manager" },
  { id: "e", stage: "to_contact", role_type: "team_member" },
];
const messages = [
  {
    person_id: "a",
    type: "cold_email",
    angle: "shared_background",
    sent_at: "2026-03-02T05:00:00Z",
  },
  {
    person_id: "a",
    type: "follow_up",
    angle: null,
    sent_at: "2026-03-05T05:00:00Z",
  },
  {
    person_id: "b",
    type: "cold_email",
    angle: "skills_match",
    sent_at: "2026-03-03T05:00:00Z",
  },
  {
    person_id: "c",
    type: "cold_email",
    angle: "skills_match",
    sent_at: "2026-03-10T05:00:00Z",
  },
  {
    person_id: "c",
    type: "follow_up",
    angle: null,
    sent_at: "2026-03-11T05:00:00Z",
  },
  {
    person_id: "d",
    type: "referral_request",
    angle: "shared_background",
    sent_at: "2026-02-20T05:00:00Z",
  },
  {
    person_id: "b",
    type: "reply",
    angle: null,
    sent_at: "2026-03-09T05:00:00Z",
  },
];
const replies = [
  { person_id: "a", sent_at: "2026-03-06T05:00:00Z" },
  { person_id: "b", sent_at: "2026-03-09T05:00:00Z" },
  { person_id: "d", sent_at: "2026-02-23T05:00:00Z" },
];

describe("insights", () => {
  const insights = computeInsights(
    { people, messages, replies },
    { now, timeZone: "Asia/Kolkata" },
  );

  it("counts outreach, not replies to people who wrote back", () => {
    expect(insights.sent).toBe(6);
    expect(insights.contacted).toBe(4);
    expect(insights.replied).toBe(3);
    expect(insights.replyRate).toBeCloseTo(0.75);
    expect(insights.interviews).toBe(2);
    expect(insights.offers).toBe(1);
  });

  it("buckets sends and replies into the last 8 weeks, oldest first", () => {
    expect(insights.weekly).toHaveLength(8);
    expect(insights.weekly.at(-1)).toEqual({
      weekStart: "2026-03-09",
      sends: 2,
      replies: 1,
    });
    expect(insights.weekly.at(-2)).toEqual({
      weekStart: "2026-03-02",
      sends: 3,
      replies: 1,
    });
    expect(insights.weekly.at(-3)).toEqual({
      weekStart: "2026-02-23",
      sends: 0,
      replies: 1,
    });
    expect(insights.weekly.at(-4)).toEqual({
      weekStart: "2026-02-16",
      sends: 1,
      replies: 0,
    });
  });

  it("builds the funnel", () => {
    expect(insights.funnel.map((step) => step.count)).toEqual([4, 3, 2, 1]);
  });

  it("ranks first-email angles and role types by reply rate", () => {
    expect(insights.byAngle).toEqual([
      { key: "shared_background", sent: 2, replied: 2, rate: 1 },
      { key: "skills_match", sent: 2, replied: 1, rate: 0.5 },
    ]);
    expect(insights.byRoleType).toEqual([
      { key: "hiring_manager", sent: 2, replied: 2, rate: 1 },
      { key: "recruiter", sent: 2, replied: 1, rate: 0.5 },
    ]);
  });

  it("is all zeros with no data, without dividing by zero", () => {
    const empty = computeInsights(
      { people: [], messages: [], replies: [] },
      { now, timeZone: "UTC" },
    );
    expect(empty).toMatchObject({
      sent: 0,
      replyRate: 0,
      byAngle: [],
      byRoleType: [],
    });
    expect(
      empty.weekly.every((week) => week.sends === 0 && week.replies === 0),
    ).toBe(true);
  });

  it("starts weeks on Monday in the user's time zone", () => {
    // Sunday 23:30 UTC is already Monday in India.
    expect(weekStart(new Date("2026-03-08T19:00:00Z"), "Asia/Kolkata")).toBe(
      "2026-03-09",
    );
    expect(weekStart(new Date("2026-03-08T19:00:00Z"), "UTC")).toBe(
      "2026-03-02",
    );
    expect(windowStart(now, "UTC").toISOString()).toBe(
      "2026-01-19T00:00:00.000Z",
    );
  });
});
