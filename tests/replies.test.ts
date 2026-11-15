import { describe, expect, it } from "vitest";

import { classifyReplyPrompt, followUpPrompt } from "@/lib/ai/prompts";
import { heuristicClassification } from "@/lib/ai/prompts/replies";
import {
  bodyText,
  bouncedAddress,
  classifyKind,
  parseAddress,
  stripQuoted,
  type GmailMessage,
} from "@/lib/replies/parse";
import type { WriterContext } from "@/lib/writer/context";
import { checkMessage } from "@/lib/writer/quality";

const b64 = (text: string) =>
  Buffer.from(text, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

function message(
  headers: Record<string, string>,
  payload: Partial<GmailMessage["payload"]> = {},
): GmailMessage {
  return {
    id: "m1",
    threadId: "t1",
    payload: {
      headers: Object.entries(headers).map(([name, value]) => ({
        name,
        value,
      })),
      ...payload,
    },
  };
}

describe("parsing Gmail messages", () => {
  it("reads names and addresses", () => {
    expect(parseAddress('"Priya Raman" <Priya@Acme.com>')).toEqual({
      name: "Priya Raman",
      email: "priya@acme.com",
    });
    expect(parseAddress("priya@acme.com")).toEqual({
      name: null,
      email: "priya@acme.com",
    });
    expect(parseAddress(null)).toEqual({ name: null, email: null });
  });

  it("prefers the plain-text part, falls back to HTML", () => {
    const multipart = message(
      {},
      {
        mimeType: "multipart/alternative",
        parts: [
          {
            mimeType: "text/html",
            body: { data: b64("<p>Hello <b>there</b></p>") },
          },
          { mimeType: "text/plain", body: { data: b64("Hello there") } },
        ],
      },
    );
    expect(bodyText(multipart)).toBe("Hello there");
    const htmlOnly = message(
      {},
      {
        mimeType: "text/html",
        body: { data: b64("<div>Hi&nbsp;Asha<br>Thanks</div>") },
      },
    );
    expect(bodyText(htmlOnly)).toBe("Hi Asha\nThanks\n");
  });

  it("keeps only the new reply, not the quoted thread", () => {
    const text =
      "Happy to chat next week!\n\nPriya\n\nOn Mon, 2 Mar 2026 at 10:00, Asha Verma <asha@gmail.com> wrote:\n> Hi Priya,\n> Would you be open to a chat?";
    expect(stripQuoted(text)).toBe("Happy to chat next week!\n\nPriya");
    expect(stripQuoted("Sure.\n-----Original Message-----\nFrom: Asha")).toBe(
      "Sure.",
    );
  });

  it("tells real replies from bounces and out-of-office messages", () => {
    expect(
      classifyKind(
        message({
          From: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>",
          Subject: "Delivery Status Notification (Failure)",
        }),
      ),
    ).toBe("bounce");
    expect(
      classifyKind(
        message({
          From: "priya@acme.com",
          Subject: "Out of office: back Monday",
        }),
      ),
    ).toBe("auto_reply");
    expect(
      classifyKind(
        message({
          From: "priya@acme.com",
          Subject: "Re: hello",
          "Auto-Submitted": "auto-replied",
        }),
      ),
    ).toBe("auto_reply");
    expect(
      classifyKind(
        message({ From: "priya@acme.com", Subject: "Re: Frontend role" }),
      ),
    ).toBe("human");
    expect(
      classifyKind(
        message({
          From: "priya@acme.com",
          Subject: "Re: hello",
          "Auto-Submitted": "no",
        }),
      ),
    ).toBe("human");
  });

  it("finds the address that bounced", () => {
    expect(
      bouncedAddress(message({ "X-Failed-Recipients": "Priya@Acme.com" }), ""),
    ).toBe("priya@acme.com");
    expect(
      bouncedAddress(
        message({}),
        "Your message to wrong@acme.com couldn't be delivered.",
      ),
    ).toBe("wrong@acme.com");
  });
});

const base = {
  senderFirstName: "Asha",
  recipientFirstName: "Priya",
  role: "Frontend Engineer",
  company: "Acme",
  ourEmail: "Hi",
};

describe("sample reply classification", () => {
  it.each([
    ["Sure, happy to chat! Thursday?", "interested"],
    ["I can refer you, send me your resume.", "referral_offered"],
    ["We're on a hiring freeze until next quarter.", "not_now"],
    ["I'm not the right person for this.", "not_relevant"],
    ["Please remove me from your list.", "opt_out"],
    ["Happy to refer you, but please stop emailing me after this.", "opt_out"],
  ])("%s -> %s", (theirReply, expected) => {
    const result = heuristicClassification({ ...base, theirReply });
    expect(result.classification).toBe(expected);
    expect(classifyReplyPrompt.outputSchema.safeParse(result).success).toBe(
      true,
    );
    if (expected === "opt_out") expect(result.suggested_reply).toBe("");
    else expect(result.suggested_reply).toContain("Priya");
  });
});

describe("sample follow-ups", () => {
  const context: WriterContext = {
    type: "follow_up",
    sender: {
      fullName: "Asha Verma",
      firstName: "Asha",
      headline: null,
      positioning: null,
      tone: "warm",
      writingSample: null,
      skills: [],
      highlights: [],
      storyAnswers: [],
    },
    recipient: {
      firstName: "Priya",
      fullName: "Priya Raman",
      title: null,
      roleType: "hiring_manager",
    },
    target: {
      company: "Acme",
      role: "Frontend Engineer",
      team: null,
      skills: [],
      summary: null,
    },
    angles: [],
    brief: null,
    previous: { subject: "Frontend role", body: "" },
  };

  it("writes two short, polite follow-ups within the 60-word rule", () => {
    for (const step of [1, 2] as const) {
      const output = followUpPrompt.mock({ context, step });
      const report = checkMessage({
        type: "follow_up",
        subject: output.subject,
        body: output.body,
        sourceText: "",
      });
      expect(
        report.issues.filter((issue) => issue.severity === "error"),
        output.body,
      ).toEqual([]);
      expect(report.words).toBeLessThanOrEqual(60);
    }
    expect(followUpPrompt.mock({ context, step: 2 }).body).toMatch(
      /won't follow up again/,
    );
  });
});
