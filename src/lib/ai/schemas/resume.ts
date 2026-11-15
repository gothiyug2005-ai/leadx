import { z } from "zod";

// Structured-output schemas avoid optional keys: every field is present and
// uses null (or an empty array) when the resume does not say.

export const experienceSchema = z.object({
  company: z.string(),
  title: z.string(),
  location: z.string().nullable(),
  start: z
    .string()
    .nullable()
    .describe("As written, e.g. 'Jan 2022' or '2022'"),
  end: z.string().nullable().describe("As written, or 'Present'"),
  highlights: z.array(z.string()).describe("Concrete achievements, max 4"),
});

export const educationSchema = z.object({
  school: z.string(),
  degree: z.string().nullable(),
  field: z.string().nullable(),
  end_year: z.string().nullable(),
});

export const parsedResumeSchema = z.object({
  full_name: z.string().nullable(),
  headline: z
    .string()
    .nullable()
    .describe("One line, e.g. 'Frontend engineer, 3 years in fintech'"),
  location: z.string().nullable(),
  email: z.string().nullable(),
  summary: z
    .string()
    .nullable()
    .describe("2-3 sentences, only from the resume"),
  skills: z.array(z.string()),
  experience: z.array(experienceSchema),
  education: z.array(educationSchema),
  links: z.array(z.string()),
  suggested_target_roles: z
    .array(z.string())
    .describe("2-4 role titles this person is a credible fit for"),
});

export type ParsedResume = z.infer<typeof parsedResumeSchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type Education = z.infer<typeof educationSchema>;
