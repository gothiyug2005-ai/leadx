import { describe, expect, it } from "vitest";

import {
  positioningPrompt,
  resumeParsePrompt,
  storyQuestionsPrompt,
} from "@/lib/ai/prompts";

const answers = [
  {
    id: "proudest_work",
    question: "Proudest work?",
    answer:
      "I rebuilt our signup flow and conversions rose 20%. It took a quarter.",
  },
  {
    id: "why_this_role",
    question: "Why this role?",
    answer: "I want to own a product area end to end.",
  },
  { id: "edge", question: "Your edge?", answer: "" },
];

describe("onboarding prompts", () => {
  it("produce sample output that matches their own schemas", () => {
    const resume = resumeParsePrompt.mock({
      pdfBase64: "",
      fileName: "cv.pdf",
    });
    expect(resumeParsePrompt.outputSchema.safeParse(resume).success).toBe(true);
    expect(resume.headline).toMatch(/sample/i);

    const questions = storyQuestionsPrompt.mock({ resume, targetRoles: [] });
    expect(storyQuestionsPrompt.outputSchema.safeParse(questions).success).toBe(
      true,
    );
    expect(questions.questions.length).toBeGreaterThanOrEqual(3);
    expect(questions.questions.length).toBeLessThanOrEqual(4);
  });

  it("builds the sample positioning only from the user's own answers", () => {
    const output = positioningPrompt.mock({
      resume: null,
      targetRoles: ["Frontend Engineer"],
      answers,
    });
    expect(positioningPrompt.outputSchema.safeParse(output).success).toBe(true);
    expect(output.statement).toBe(
      "I'm looking for a Frontend Engineer role. Recently, I rebuilt our signup flow and conversions rose 20%. Next, I want to own a product area end to end.",
    );
    expect(output.alternatives).toHaveLength(2);
  });

  it("sends the resume as a PDF document block", () => {
    const content = resumeParsePrompt.buildContent({
      pdfBase64: "JVBERi0=",
      fileName: "cv.pdf",
    });
    expect(Array.isArray(content)).toBe(true);
    expect((content as { type: string }[])[0]).toMatchObject({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: "JVBERi0=",
      },
    });
  });

  it("wraps user text as data and skips blank answers", () => {
    const content = positioningPrompt.buildContent({
      resume: null,
      targetRoles: ["PM"],
      answers,
    });
    expect(typeof content).toBe("string");
    expect(content).toContain("<answers>");
    expect(content).toContain("Proudest work?");
    expect(content).not.toContain("Your edge?");
  });
});
