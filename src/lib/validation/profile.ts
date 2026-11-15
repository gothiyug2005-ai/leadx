import { z } from "zod";

import { isValidTimeZone } from "@/lib/dates";

const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable();

const list = (maxItems: number, maxLength: number) =>
  z
    .array(z.string().trim().min(1).max(maxLength))
    .max(maxItems)
    .transform((items) => Array.from(new Set(items)));

export const experienceFormSchema = z.object({
  company: text(120).min(1, "Company is required"),
  title: text(120).min(1, "Title is required"),
  location: optionalText(120),
  start: optionalText(40),
  end: optionalText(40),
  highlights: list(6, 300),
});

export const educationFormSchema = z.object({
  school: text(160).min(1, "School is required"),
  degree: optionalText(120),
  field: optionalText(120),
  end_year: optionalText(20),
});

export const profileFormSchema = z.object({
  full_name: text(120).min(1, "Your name is required"),
  headline: optionalText(160),
  location: optionalText(120),
  timezone: z.string().refine(isValidTimeZone, "Choose a valid timezone"),
  target_roles: list(6, 80),
  skills: list(40, 60),
  summary: optionalText(1200),
  experience: z.array(experienceFormSchema).max(12),
  education: z.array(educationFormSchema).max(8),
});

export type ProfileFormValues = z.input<typeof profileFormSchema>;
export type ProfileFormOutput = z.output<typeof profileFormSchema>;

export const TONES = ["formal", "warm", "concise"] as const;
export type Tone = (typeof TONES)[number];

export const toneFormSchema = z.object({
  tone: z.enum(TONES),
  writing_sample: optionalText(3000),
});

export const storyAnswersSchema = z
  .array(
    z.object({
      id: text(60).min(1),
      question: text(300).min(1),
      answer: text(1000),
    }),
  )
  .min(1)
  .max(6)
  .refine(
    (answers) => answers.filter((entry) => entry.answer.length > 0).length >= 2,
    "Answer at least two questions",
  );

export const positioningStatementSchema = text(400).min(
  10,
  "Write at least a short sentence",
);

export const sendingLimitSchema = z.coerce.number().int().min(1).max(40);

/** "React, TypeScript,  Node" -> ["React", "TypeScript", "Node"] */
export function splitList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export const RESUME_MAX_BYTES = 5 * 1024 * 1024;
