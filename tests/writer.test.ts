import { describe, expect, it } from "vitest";

import { rewritePrompt, writeVariantsPrompt } from "@/lib/ai/prompts";
import { contextSourceText, type WriterContext } from "@/lib/writer/context";
import { checkMessage } from "@/lib/writer/quality";
import { MESSAGE_TYPES, RULES, rulesText, wordCount } from "@/lib/writer/rules";
import { templateDrafts, templateRewrite } from "@/lib/writer/templates";

function context(overrides: Partial<WriterContext> = {}): WriterContext {
  return {
    type: "cold_email",
    sender: {
      fullName: "Asha Verma",
      firstName: "Asha",
      headline: "Frontend engineer",
      positioning:
        "I build fast, accessible checkout flows. Next I want to own a product area.",
      tone: "warm",
      writingSample: null,
      skills: ["React", "TypeScript", "Accessibility"],
      highlights: ["Rebuilt checkout, cutting drop-off by 18%"],
      storyAnswers: [],
    },
    recipient: {
      firstName: "Priya",
      fullName: "Priya Raman",
      title: "Engineering Manager",
      roleType: "hiring_manager",
    },
    target: {
      company: "Northwind",
      role: "Senior Frontend Engineer",
      team: "Payments",
      skills: ["React", "GraphQL"],
      summary: null,
    },
    angles: [
      { type: "shared_school", detail: "You both studied at IIT Bombay" },
    ],
    brief: {
      bestHook: "You both studied at IIT Bombay.",
      talkingPoints: ["Their checkout redesign launched this quarter"],
      avoid: [],
      news: ["Northwind launches one-click checkout"],
      teamFocus: "Rebuilding checkout for mobile",
    },
    previous: null,
    ...overrides,
  };
}

const goodEmail = {
  type: "cold_email" as const,
  subject: "Frontend role on Payments",
  body: "Hi Priya,\n\nI build fast, accessible checkout flows and I'm interested in the Senior Frontend Engineer role.\n\nWould you be open to a 15-minute chat about the team?\n\nIf this isn't a good time, no worries at all.\n\nBest,\nAsha",
  sourceText: contextSourceText(context()),
};

describe("quality checker", () => {
  it("passes a short, specific email with one ask and an opt-out", () => {
    const report = checkMessage(goodEmail);
    expect(report.issues).toEqual([]);
    expect(report.score).toBe(100);
  });

  it("flags length, subject, generic phrases, missing ask and missing opt-out", () => {
    const long = Array.from({ length: 130 }, () => "word").join(" ");
    const codes = (body: string, subject: string | null = "Hello") =>
      checkMessage({ ...goodEmail, subject, body }).issues.map(
        (issue) => issue.code,
      );

    expect(codes(long)).toContain("too_long");
    expect(
      codes(goodEmail.body, "A very long subject line that keeps on going"),
    ).toContain("subject_too_long");
    expect(codes(goodEmail.body, null)).toContain("missing_subject");
    expect(
      codes(`I hope this email finds you well. ${goodEmail.body}`),
    ).toContain("generic_phrase");
    expect(codes("Hi Priya,\n\nI like your team.\n\nBest,\nAsha")).toEqual(
      expect.arrayContaining(["no_ask", "missing_opt_out"]),
    );
  });

  it("catches placeholders and numbers that are not in the user's material", () => {
    const issues = checkMessage({
      ...goodEmail,
      body: `${goodEmail.body}\n\nP.S. Hi [Name], I grew revenue 40% at Acme.`,
    }).issues;
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["placeholder", "unverified_claim"]),
    );
    // 18% is in the resume, so it is allowed.
    const ok = checkMessage({
      ...goodEmail,
      body: goodEmail.body.replace(
        "checkout flows",
        "checkout flows (drop-off down 18%)",
      ),
    });
    expect(ok.issues.map((issue) => issue.code)).not.toContain(
      "unverified_claim",
    );
  });

  it("uses a character limit for LinkedIn notes and needs no subject or opt-out", () => {
    const note =
      "Hi Priya, we both studied at IIT Bombay. Would you be open to connecting?";
    expect(
      checkMessage({
        type: "linkedin_note",
        subject: null,
        body: note,
        sourceText: "",
      }).issues,
    ).toEqual([]);
    expect(
      checkMessage({
        type: "linkedin_note",
        subject: null,
        body: note.repeat(6),
        sourceText: "",
      }).issues[0]?.code,
    ).toBe("too_long");
  });
});

describe("sample drafts", () => {
  it("writes three drafts with different angles for every message type, all within the rules", () => {
    for (const type of MESSAGE_TYPES) {
      const ctx = context({ type });
      const drafts = templateDrafts(ctx);
      expect(drafts).toHaveLength(3);
      expect(new Set(drafts.map((draft) => draft.angle)).size).toBe(3);
      for (const draft of drafts) {
        const report = checkMessage({
          type,
          subject: draft.subject,
          body: draft.body,
          sourceText: contextSourceText(ctx),
        });
        const errors = report.issues.filter(
          (issue) => issue.severity === "error",
        );
        expect(errors, `${type}/${draft.angle}: ${draft.body}`).toEqual([]);
        if (!RULES[type].hasSubject) expect(draft.subject).toBeNull();
        expect(draft.body).toContain("Priya");
      }
    }
  });

  it("leads with shared background when there is one, and never invents it", () => {
    expect(templateDrafts(context())[0]?.body).toContain(
      "You both studied at IIT Bombay",
    );
    const without = templateDrafts(context({ angles: [], brief: null }));
    expect(without.map((draft) => draft.angle)).not.toContain(
      "shared_background",
    );
    expect(without.every((draft) => !draft.body.includes("IIT Bombay"))).toBe(
      true,
    );
  });

  it("matches the prompt's own schema", () => {
    const output = writeVariantsPrompt.mock(context());
    expect(writeVariantsPrompt.outputSchema.safeParse(output).success).toBe(
      true,
    );
  });
});

describe("sample quick edits", () => {
  const draft = templateDrafts(context())[0]!;

  it("shorten removes a middle paragraph but keeps the ask and sign-off", () => {
    const shorter = templateRewrite(context(), draft, "shorten", null);
    expect(wordCount(shorter.body)).toBeLessThan(wordCount(draft.body));
    expect(shorter.body).toContain("?");
    expect(shorter.body.endsWith("Asha")).toBe(true);
  });

  it("warmer adds a friendly line once", () => {
    const warmer = templateRewrite(context(), draft, "warmer", null);
    expect(warmer.body).toContain("Hope your week is going well.");
    expect(templateRewrite(context(), warmer, "warmer", null).body).toBe(
      warmer.body,
    );
  });

  it("more specific adds a real talking point", () => {
    expect(
      templateRewrite(context(), draft, "more_specific", null).body,
    ).toContain("Their checkout redesign launched this quarter");
  });

  it("regenerating a paragraph leaves the greeting and sign-off alone", () => {
    const paragraphs = draft.body.split(/\n{2,}/);
    const result = templateRewrite(context(), draft, "regenerate_paragraph", 2);
    const after = result.body.split(/\n{2,}/);
    expect(after[0]).toBe(paragraphs[0]);
    expect(after.at(-1)).toBe(paragraphs.at(-1));
    expect(
      templateRewrite(context(), draft, "regenerate_paragraph", 0),
    ).toEqual(draft);
  });

  it("matches the rewrite prompt's schema", () => {
    const output = rewritePrompt.mock({
      context: context(),
      draft,
      action: "shorten",
      paragraphIndex: null,
    });
    expect(rewritePrompt.outputSchema.safeParse(output).success).toBe(true);
  });
});

describe("writing rules", () => {
  it("states the limits the user asked for", () => {
    expect(RULES.cold_email.maxWords).toBe(120);
    expect(RULES.follow_up.maxWords).toBe(60);
    expect(RULES.linkedin_note.maxChars).toBe(300);
    expect(RULES.linkedin_dm.channel).toBe("linkedin");
    expect(rulesText("cold_email")).toMatch(
      /at most 120 words[\s\S]*at most 7 words[\s\S]*opt-out/i,
    );
  });
});

describe("LinkedIn note wording", () => {
  it("continues the greeting in lower case", () => {
    const [note] = templateDrafts(context({ type: "linkedin_note" }));
    expect(
      note?.body.startsWith("Hi Priya, you both studied at IIT Bombay"),
    ).toBe(true);
  });
});
