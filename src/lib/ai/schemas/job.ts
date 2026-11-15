import { z } from "zod";

export const SENIORITIES = [
  "intern",
  "entry",
  "mid",
  "senior",
  "staff",
  "principal",
  "manager",
  "director",
  "executive",
] as const;

export const jobExtractionSchema = z.object({
  is_job_posting: z
    .boolean()
    .describe("False if the text is not a job posting"),
  company_name: z.string().nullable(),
  company_domain: z
    .string()
    .nullable()
    .describe("The employer's website domain if stated, e.g. 'acme.com'"),
  role_title: z.string().nullable(),
  team: z
    .string()
    .nullable()
    .describe("Team or department, e.g. 'Payments platform'"),
  seniority: z.enum(SENIORITIES).nullable(),
  location: z
    .string()
    .nullable()
    .describe("e.g. 'Bengaluru (hybrid)' or 'Remote, India'"),
  must_have_skills: z
    .array(z.string())
    .describe("Required skills, max 8, short names"),
  nice_to_have_skills: z.array(z.string()).describe("Preferred skills, max 6"),
  summary: z
    .string()
    .describe("2 sentences: what the team does and what this role owns"),
});

export type JobExtraction = z.infer<typeof jobExtractionSchema>;
