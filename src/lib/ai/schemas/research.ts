import { z } from "zod";

export const companyBriefSchema = z.object({
  company_summary: z
    .string()
    .describe("2 sentences on what the company does, from the sources"),
  recent_news: z
    .array(
      z.object({
        headline: z.string(),
        why_it_matters: z
          .string()
          .describe("One sentence on why it matters for this role"),
        url: z.string().describe("The source URL exactly as given"),
      }),
    )
    .describe(
      "Up to 3 items, newest and most relevant first; empty if nothing relevant",
    ),
  team_focus: z
    .string()
    .nullable()
    .describe("What the relevant team seems to be working on, or null"),
  likely_pain_points: z
    .array(z.string())
    .describe("Up to 3, each grounded in the sources or posting"),
});

export const personBriefSchema = z.object({
  person_summary: z
    .string()
    .describe(
      "1-2 sentences on what this person likely owns, from their title and the role",
    ),
  best_hook: z
    .string()
    .describe(
      "The single best opening angle for a message to them, one sentence",
    ),
  talking_points: z
    .array(z.string())
    .describe("Up to 3 specific points worth mentioning"),
  avoid: z.array(z.string()).describe("Up to 2 things not to say or assume"),
});

export type CompanyBrief = z.infer<typeof companyBriefSchema>;
export type PersonBrief = z.infer<typeof personBriefSchema>;

export interface BriefSource {
  title: string;
  url: string;
  publishedAt?: string;
}
