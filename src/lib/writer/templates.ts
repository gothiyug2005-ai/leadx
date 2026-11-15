/**
 * Sample-mode writer: builds drafts from the user's real data with simple
 * templates, so the composer is fully usable before an AI key is added.
 * Every sentence comes from the context; nothing is invented.
 */
import type { WriterContext } from "./context";
import {
  ANGLES,
  MAX_SUBJECT_WORDS,
  RULES,
  wordCount,
  type Angle,
} from "./rules";

export interface Draft {
  angle: Angle;
  subject: string | null;
  body: string;
}

function firstSentence(text: string | null | undefined): string | null {
  if (!text) return null;
  const sentence = text
    .trim()
    .split(/(?<=[.!?])\s/)[0]
    ?.trim();
  return sentence || null;
}

function lowerFirst(text: string): string {
  return /^I\b/.test(text) || /^[A-Z]{2}/.test(text)
    ? text
    : text.charAt(0).toLowerCase() + text.slice(1);
}

function roleText(context: WriterContext): string {
  const role = context.target.role ?? "open roles";
  return context.target.team
    ? `${role} role on the ${context.target.team} team`
    : context.target.role
      ? `${role} role`
      : role;
}

function limitWords(text: string, max: number): string {
  const words = text.split(/\s+/);
  return words.length <= max ? text : words.slice(0, max).join(" ");
}

function subjectFor(context: WriterContext, angle: Angle): string {
  const role = context.target.role ?? context.target.company;
  const options: Record<Angle, string> = {
    skills_match: `${role} at ${context.target.company}`,
    shared_background: `${context.angles[0]?.type === "shared_school" ? "Fellow alum" : "Shared background"}, ${role}`,
    company_news: `${context.target.company} news and the ${role} role`,
    team_curiosity: `Question about the ${context.target.team ?? context.target.company} team`,
  };
  return limitWords(options[angle], MAX_SUBJECT_WORDS);
}

function askFor(context: WriterContext): string {
  switch (context.type) {
    case "referral_request":
      return "If you think I'd be a good fit, would you be comfortable referring me?";
    case "follow_up":
      return "Would a 15-minute chat sometime next week work?";
    default:
      if (context.recipient.roleType === "recruiter") {
        return "Would you be open to a quick chat, or pointing me to the right person?";
      }
      if (context.recipient.roleType === "hiring_manager") {
        return "Would you be open to a 15-minute chat about the team?";
      }
      return "Would you be open to a quick chat about what the work is like?";
  }
}

function angleLine(context: WriterContext, angle: Angle): string | null {
  switch (angle) {
    case "shared_background": {
      const detail =
        context.angles.find(
          (item) =>
            item.type === "shared_school" || item.type === "past_company",
        ) ?? context.angles[0];
      return detail
        ? `${detail.detail.replace(/\.$/, "")}, so I wanted to write to you directly.`
        : null;
    }
    case "skills_match": {
      const wanted = new Set(
        context.target.skills.map((skill) => skill.toLowerCase()),
      );
      const overlap = context.sender.skills
        .filter((skill) => wanted.has(skill.toLowerCase()))
        .slice(0, 2);
      const skills = overlap.length
        ? overlap
        : context.sender.skills.slice(0, 2);
      return skills.length
        ? `My work with ${skills.join(" and ")} lines up closely with what the role needs.`
        : null;
    }
    case "company_news": {
      // Sample-mode research is placeholder text, never something to quote to a real person.
      const news = context.brief?.news.find((item) => !/^\[Mock\]/.test(item));
      return news
        ? `I saw "${news}", and it is a big part of why your team caught my eye.`
        : null;
    }
    case "team_curiosity":
      return context.brief?.teamFocus &&
        !/^sample/i.test(context.brief.teamFocus)
        ? `I'd love to hear how the team is approaching ${lowerFirst(context.brief.teamFocus.replace(/\.$/, ""))}.`
        : `I'd love to hear how the ${context.target.team ?? context.target.company} team works.`;
  }
}

/** Real shared background first: it is the strongest reason for a stranger to reply. */
const ANGLE_PREFERENCE: Angle[] = [
  "shared_background",
  "skills_match",
  "company_news",
  "team_curiosity",
];

/**
 * Up to three angles the data actually supports. With little to go on this
 * can be fewer than three: an honest second draft beats a padded third one.
 */
function availableAngles(context: WriterContext): Angle[] {
  return ANGLE_PREFERENCE.filter((angle) => ANGLES.includes(angle))
    .filter((angle) => angleLine(context, angle) !== null)
    .slice(0, 3);
}

/** Drop optional paragraphs (in the given order) until the message fits its limits. */
function fit(
  paragraphs: string[],
  max: { words: number | null; chars: number | null },
  dropOrder: number[],
): string {
  let kept = paragraphs.map((text, index) => ({ text, index }));
  const join = () => kept.map((entry) => entry.text).join("\n\n");
  const tooLong = () =>
    (max.words !== null && wordCount(join()) > max.words) ||
    (max.chars !== null && join().length > max.chars);
  for (const index of dropOrder) {
    if (!tooLong()) break;
    kept = kept.filter((entry) => entry.index !== index);
  }
  return join();
}

export function templateDraft(context: WriterContext, angle: Angle): Draft {
  const rules = RULES[context.type];
  const greeting = `Hi ${context.recipient.firstName},`;
  const signOff = `Best,\n${context.sender.firstName}`;
  const ask = askFor(context);
  const line = angleLine(context, angle);
  const intro =
    firstSentence(context.sender.positioning) ??
    (context.sender.headline
      ? `I'm a ${lowerFirst(context.sender.headline)}.`
      : null);

  if (context.type === "linkedin_note") {
    const short = [
      `Hi ${context.recipient.firstName},`,
      line ? lowerFirst(line) : null,
      `I'm exploring the ${roleText(context)} at ${context.target.company} and would love to connect.`,
    ]
      .filter(Boolean)
      .join(" ");
    const text =
      short.length <= 300
        ? short
        : `Hi ${context.recipient.firstName}, I'm exploring the ${roleText(context)} at ${context.target.company} and would love to connect.`;
    return { angle, subject: null, body: text.slice(0, 300) };
  }

  if (context.type === "follow_up") {
    const body = [
      greeting,
      `Just following up on my note about the ${roleText(context)} at ${context.target.company}. ${ask}`,
      "If now isn't a good time, no worries at all.",
      signOff,
    ].join("\n\n");
    return {
      angle,
      subject: context.previous?.subject
        ? `Re: ${context.previous.subject}`
        : subjectFor(context, angle),
      body,
    };
  }

  const paragraphs = [
    greeting,
    [
      intro,
      `I'm interested in the ${roleText(context)} at ${context.target.company}.`,
    ]
      .filter(Boolean)
      .join(" "),
    line ?? "",
    ask,
    rules.needsOptOut ? "If this isn't a good time, no worries at all." : "",
    signOff,
  ].filter(Boolean);

  // If it runs long, drop the intro first and the angle line only as a last resort.
  const body = fit(
    paragraphs,
    { words: rules.maxWords, chars: rules.maxChars },
    [1, 2],
  );
  return {
    angle,
    subject: rules.hasSubject ? subjectFor(context, angle) : null,
    body,
  };
}

export function templateDrafts(context: WriterContext): Draft[] {
  return availableAngles(context).map((angle) => templateDraft(context, angle));
}

export type RewriteAction =
  "shorten" | "warmer" | "more_specific" | "regenerate_paragraph";

function paragraphsOf(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

/** Sample-mode inline edits: simple, predictable changes that keep the facts. */
export function templateRewrite(
  context: WriterContext,
  draft: { subject: string | null; body: string },
  action: RewriteAction,
  paragraphIndex: number | null,
): { subject: string | null; body: string } {
  const paragraphs = paragraphsOf(draft.body);
  const isFrame = (index: number) =>
    index === 0 || index === paragraphs.length - 1;

  switch (action) {
    case "shorten": {
      // Drop the longest middle paragraph that is not the ask or the opt-out.
      const candidates = paragraphs
        .map((paragraph, index) => ({ paragraph, index }))
        .filter(
          ({ paragraph, index }) =>
            !isFrame(index) && !/\?|no worries|good time/i.test(paragraph),
        );
      const longest = candidates.sort(
        (a, b) => wordCount(b.paragraph) - wordCount(a.paragraph),
      )[0];
      if (!longest) return draft;
      return {
        ...draft,
        body: paragraphs
          .filter((_, index) => index !== longest.index)
          .join("\n\n"),
      };
    }
    case "warmer": {
      if (paragraphs.some((paragraph) => /hope (your|you)/i.test(paragraph)))
        return draft;
      const opener = "Hope your week is going well.";
      const next = [...paragraphs];
      next.splice(1, 0, opener);
      return { ...draft, body: next.join("\n\n") };
    }
    case "more_specific": {
      const detail =
        context.brief?.talkingPoints.find(
          (point) => !draft.body.includes(point),
        ) ??
        context.angles
          .map((angle) => angle.detail)
          .find((point) => !draft.body.includes(point));
      if (!detail) return draft;
      const next = [...paragraphs];
      next.splice(
        Math.min(2, next.length - 1),
        0,
        `${detail.replace(/\.$/, "")}.`,
      );
      return { ...draft, body: next.join("\n\n") };
    }
    case "regenerate_paragraph": {
      if (
        paragraphIndex === null ||
        isFrame(paragraphIndex) ||
        !paragraphs[paragraphIndex]
      )
        return draft;
      const alternatives = ANGLES.map((angle) =>
        angleLine(context, angle),
      ).filter(
        (line): line is string => Boolean(line) && !draft.body.includes(line!),
      );
      const replacement = alternatives[0];
      if (!replacement) return draft;
      const next = [...paragraphs];
      next[paragraphIndex] = replacement;
      return { ...draft, body: next.join("\n\n") };
    }
  }
}
