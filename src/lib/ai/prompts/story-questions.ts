import type { ParsedResume } from "@/lib/ai/schemas/resume";
import {
  storyQuestionsSchema,
  type StoryQuestions,
} from "@/lib/ai/schemas/story";

import { asData } from "./shared";
import { definePrompt } from "./types";

export interface StoryQuestionsInput {
  resume: ParsedResume | null;
  targetRoles: string[];
}

export const storyQuestionsPrompt = definePrompt<
  StoryQuestionsInput,
  StoryQuestions
>({
  id: "story-questions",
  version: 1,
  effort: "low",
  maxTokens: 2000,
  system: `You help job seekers find what makes them worth talking to.
Ask 3 or 4 short questions whose answers will produce a sharp, specific 2-line positioning statement for cold outreach.
- Ask about things a resume rarely shows: proudest concrete result, why this kind of role, what they want next, an unusual edge.
- Tailor questions to their background and target roles. One idea per question, under 20 words.
- Each hint is a short, realistic example answer in plain language.`,
  outputSchema: storyQuestionsSchema,
  buildContent: (input) =>
    [
      asData("target_roles", input.targetRoles.join(", ") || "(not set)"),
      asData(
        "resume",
        input.resume ? JSON.stringify(input.resume) : "(no resume yet)",
      ),
    ].join("\n\n"),
  mock: () => ({
    questions: [
      {
        id: "proudest_work",
        question:
          "What piece of work are you proudest of, and what changed because of it?",
        hint: "I rebuilt our signup flow and conversions went up 20%.",
      },
      {
        id: "why_this_role",
        question: "Why do you want this kind of role next?",
        hint: "I want to own a product area end to end, not just tickets.",
      },
      {
        id: "edge",
        question: "What do you bring that most candidates don't?",
        hint: "I've worked on both design and engineering, so I bridge the two.",
      },
    ],
  }),
});
