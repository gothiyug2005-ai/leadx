import { describe, expect, it } from "vitest";

import {
  profileFormSchema,
  sendingLimitSchema,
  splitList,
  storyAnswersSchema,
} from "@/lib/validation/profile";

const valid = {
  full_name: " Yug ",
  headline: "",
  location: "Bengaluru",
  timezone: "Asia/Kolkata",
  target_roles: [
    "Frontend Engineer",
    "Frontend Engineer",
    "Full-stack Engineer",
  ],
  skills: ["React"],
  summary: "",
  experience: [
    {
      company: "Acme",
      title: "Engineer",
      location: "",
      start: "2022",
      end: "",
      highlights: ["Shipped X"],
    },
  ],
  education: [],
};

describe("profile validation", () => {
  it("trims, de-duplicates and turns blanks into null", () => {
    const parsed = profileFormSchema.parse(valid);
    expect(parsed.full_name).toBe("Yug");
    expect(parsed.headline).toBeNull();
    expect(parsed.target_roles).toEqual([
      "Frontend Engineer",
      "Full-stack Engineer",
    ]);
    expect(parsed.experience[0]?.end).toBeNull();
  });

  it("rejects an unknown timezone and a missing name", () => {
    expect(
      profileFormSchema.safeParse({ ...valid, timezone: "Mars/Base" }).success,
    ).toBe(false);
    expect(
      profileFormSchema.safeParse({ ...valid, full_name: "  " }).success,
    ).toBe(false);
  });

  it("limits target roles to six", () => {
    const roles = Array.from({ length: 7 }, (_, index) => `Role ${index}`);
    expect(
      profileFormSchema.safeParse({ ...valid, target_roles: roles }).success,
    ).toBe(false);
  });

  it("keeps the daily sending limit between 1 and 40", () => {
    expect(sendingLimitSchema.parse("25")).toBe(25);
    expect(sendingLimitSchema.safeParse(41).success).toBe(false);
    expect(sendingLimitSchema.safeParse(0).success).toBe(false);
    expect(sendingLimitSchema.safeParse(2.5).success).toBe(false);
  });

  it("needs at least two answered story questions", () => {
    const one = [
      { id: "a", question: "Q1", answer: "yes" },
      { id: "b", question: "Q2", answer: "" },
    ];
    expect(storyAnswersSchema.safeParse(one).success).toBe(false);
    expect(
      storyAnswersSchema.safeParse([
        ...one,
        { id: "c", question: "Q3", answer: "also" },
      ]).success,
    ).toBe(true);
  });

  it("splits comma and line separated lists", () => {
    expect(splitList("React,  TypeScript\nNode, ,")).toEqual([
      "React",
      "TypeScript",
      "Node",
    ]);
  });
});
