import { z } from "zod";

export const storyQuestionsSchema = z.object({
  questions: z
    .array(
      z.object({
        id: z.string().describe("Short slug, e.g. 'proudest_work'"),
        question: z.string(),
        hint: z.string().describe("One short example of a good answer"),
      }),
    )
    .describe("Exactly 3 or 4 questions"),
});

export const positioningSchema = z.object({
  statement: z
    .string()
    .describe("At most 2 sentences, first person, no buzzwords"),
  alternatives: z.array(z.string()).describe("Exactly 2 alternative versions"),
});

export type StoryQuestions = z.infer<typeof storyQuestionsSchema>;
export type Positioning = z.infer<typeof positioningSchema>;

export interface StoryAnswer {
  id: string;
  question: string;
  answer: string;
}
