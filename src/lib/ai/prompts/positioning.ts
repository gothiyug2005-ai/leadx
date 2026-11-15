import type { ParsedResume } from "@/lib/ai/schemas/resume";
import {
  positioningSchema,
  type Positioning,
  type StoryAnswer,
} from "@/lib/ai/schemas/story";

import { HONESTY_RULES, asData } from "./shared";
import { definePrompt } from "./types";

export interface PositioningInput {
  resume: ParsedResume | null;
  targetRoles: string[];
  answers: StoryAnswer[];
}

function firstSentence(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  const end = trimmed.search(/[.!?](\s|$)/);
  const sentence = end === -1 ? trimmed : trimmed.slice(0, end);
  // Lower-case the first word so it reads mid-sentence, unless it is "I" or an acronym.
  const firstWord = sentence.split(/[\s']/)[0] ?? "";
  if (firstWord === "I" || firstWord === firstWord.toUpperCase())
    return sentence;
  return sentence.charAt(0).toLowerCase() + sentence.slice(1);
}

export const positioningPrompt = definePrompt<PositioningInput, Positioning>({
  id: "positioning",
  version: 1,
  effort: "medium",
  maxTokens: 2000,
  system: `You write positioning statements for job seekers' cold outreach.
A positioning statement is at most 2 sentences, first person, that says who they are, the concrete proof, and what they want next.
${HONESTY_RULES}
- Specific beats impressive: numbers, products, domains. No buzzwords ("passionate", "results-driven", "synergy").
- Write like a person talking, not a resume.
- Give one main statement and exactly 2 alternatives with different emphasis.`,
  outputSchema: positioningSchema,
  buildContent: (input) =>
    [
      asData("target_roles", input.targetRoles.join(", ") || "(not set)"),
      asData(
        "resume",
        input.resume ? JSON.stringify(input.resume) : "(no resume)",
      ),
      asData(
        "answers",
        input.answers
          .filter((entry) => entry.answer.trim())
          .map((entry) => `Q: ${entry.question}\nA: ${entry.answer}`)
          .join("\n\n"),
      ),
    ].join("\n\n"),
  // Sample mode stitches the user's own answers together, so it never invents anything.
  mock: (input) => {
    const role =
      input.targetRoles[0] ?? input.resume?.headline ?? "my next role";
    const [proof, motivation] = input.answers
      .map((entry) => entry.answer)
      .filter((a) => a.trim());
    const proofLine = proof ? `Recently, ${firstSentence(proof)}.` : "";
    const nextLine = motivation ? ` Next, ${firstSentence(motivation)}.` : "";
    const statement =
      `I'm looking for a ${role} role. ${proofLine}${nextLine}`.trim();
    return {
      statement,
      alternatives: [
        `${proof ? `${firstSentence(proof).charAt(0).toUpperCase()}${firstSentence(proof).slice(1)}. ` : ""}Now I'm looking for a ${role} role.`,
        `I'm a ${input.resume?.headline ?? "builder"} looking for a ${role} role.`,
      ],
    };
  },
});
