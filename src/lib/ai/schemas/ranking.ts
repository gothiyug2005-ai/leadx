import { z } from "zod";

export const ROLE_TYPES = [
  "hiring_manager",
  "recruiter",
  "team_member",
  "alumni",
  "leadership",
] as const;
export const ANGLE_TYPES = [
  "shared_school",
  "past_company",
  "location",
  "skills",
] as const;

export const peopleRankingSchema = z.object({
  ranked: z.array(
    z.object({
      candidate_id: z.string(),
      role_type: z.enum(ROLE_TYPES),
      relevance_score: z.number().int().min(0).max(100),
      reason: z
        .string()
        .describe(
          "One line, under 20 words, why this person can help with THIS role",
        ),
      extra_angles: z
        .array(z.object({ type: z.enum(ANGLE_TYPES), detail: z.string() }))
        .describe("Only angles supported by the data given; usually empty"),
    }),
  ),
});

export type PeopleRanking = z.infer<typeof peopleRankingSchema>;
