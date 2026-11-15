import { MAX_SUBJECT_WORDS, RULES, wordCount, type MessageType } from "./rules";

export type IssueSeverity = "error" | "warning";

export interface QualityIssue {
  code:
    | "too_long"
    | "subject_too_long"
    | "missing_subject"
    | "generic_phrase"
    | "no_ask"
    | "too_many_asks"
    | "missing_opt_out"
    | "placeholder"
    | "unverified_claim"
    | "empty";
  severity: IssueSeverity;
  message: string;
}

export interface QualityReport {
  score: number;
  issues: QualityIssue[];
  words: number;
  chars: number;
}

const GENERIC_PHRASES = [
  "i hope this email finds you well",
  "i hope this message finds you well",
  "i am writing to",
  "i'm writing to",
  "to whom it may concern",
  "dear sir",
  "dear madam",
  "i came across your profile",
  "i am reaching out",
  "i'm reaching out",
  "passionate about",
  "results-driven",
  "results driven",
  "go-getter",
  "team player",
  "synergy",
  "leverage my",
  "think outside the box",
  "rockstar",
  "ninja",
  "pick your brain",
  "touch base",
  "circle back",
  "esteemed",
  "kindly",
  "do the needful",
];

const ASK_PATTERNS = [
  /\?/,
  /\bwould you be (open|up|willing)\b/i,
  /\b(could|can) we\b/i,
  /\bwould you mind\b/i,
  /\b(15|10|20)[- ]minute/i,
  /\bquick (call|chat)\b/i,
  /\b(refer|referral)\b/i,
  /\bpoint me\b/i,
];

const OPT_OUT_PATTERNS = [
  /no worries/i,
  /no pressure/i,
  /not a good time/i,
  /feel free to ignore/i,
  /if (you'?re|you are) (busy|not the right person)/i,
  /totally understand/i,
  /(won'?t|will not) follow up/i,
  /let me know if you'?d (rather|prefer)/i,
  /if (this|now) isn'?t/i,
];

const PLACEHOLDER =
  /\[[^\]\n]{1,40}\]|\{\{[^}]*\}\}|<(name|company|role)>|\bXX+\b|\bTODO\b/i;

/** Numbers and percentages are the claims most often invented; each must appear in the user's own material. */
function claimTokens(text: string): string[] {
  return Array.from(
    new Set(text.match(/\b\d+(?:[.,]\d+)?\s?(?:%|x|k|m|\+)?/gi) ?? []),
  )
    .map((token) => token.trim())
    .filter(
      (token) =>
        !/^(19|20)\d{2}$/.test(token) &&
        !/^\d$/.test(token) &&
        !/^(10|15|20|30)$/.test(token),
    );
}

export function checkMessage(input: {
  type: MessageType;
  subject: string | null;
  body: string;
  /** The user's own material (resume, story, positioning, research): claims must come from here. */
  sourceText: string;
}): QualityReport {
  const rules = RULES[input.type];
  const body = input.body.trim();
  const lower = body.toLowerCase();
  const words = wordCount(body);
  const chars = body.length;
  const issues: QualityIssue[] = [];

  if (!body) {
    return {
      score: 0,
      words,
      chars,
      issues: [
        { code: "empty", severity: "error", message: "The message is empty." },
      ],
    };
  }

  if (rules.maxWords && words > rules.maxWords) {
    issues.push({
      code: "too_long",
      severity: "error",
      message: `${words} words; keep it under ${rules.maxWords}.`,
    });
  }
  if (rules.maxChars && chars > rules.maxChars) {
    issues.push({
      code: "too_long",
      severity: "error",
      message: `${chars} characters; LinkedIn allows ${rules.maxChars}.`,
    });
  }

  if (rules.hasSubject) {
    const subjectWords = wordCount(input.subject ?? "");
    if (subjectWords === 0) {
      issues.push({
        code: "missing_subject",
        severity: "error",
        message: "Add a subject line.",
      });
    } else if (subjectWords > MAX_SUBJECT_WORDS) {
      issues.push({
        code: "subject_too_long",
        severity: "warning",
        message: `Subject is ${subjectWords} words; ${MAX_SUBJECT_WORDS} or fewer reads better.`,
      });
    }
  }

  for (const phrase of GENERIC_PHRASES) {
    if (lower.includes(phrase)) {
      issues.push({
        code: "generic_phrase",
        severity: "warning",
        message: `"${phrase}" sounds generic. Say something specific instead.`,
      });
    }
  }

  const asks = ASK_PATTERNS.some((pattern) => pattern.test(body));
  if (!asks) {
    issues.push({
      code: "no_ask",
      severity: "warning",
      message: "There is no clear ask. End with one small, specific request.",
    });
  } else if ((body.match(/\?/g) ?? []).length > 2) {
    issues.push({
      code: "too_many_asks",
      severity: "warning",
      message: "Several questions dilute the ask. Keep one.",
    });
  }

  if (
    rules.needsOptOut &&
    !OPT_OUT_PATTERNS.some((pattern) => pattern.test(body))
  ) {
    issues.push({
      code: "missing_opt_out",
      severity: "warning",
      message:
        'Add a polite opt-out, e.g. "If this isn\'t a good time, no worries."',
    });
  }

  const placeholder = PLACEHOLDER.exec(`${input.subject ?? ""}\n${body}`);
  if (placeholder) {
    issues.push({
      code: "placeholder",
      severity: "error",
      message: `Replace the placeholder "${placeholder[0]}".`,
    });
  }

  const source = input.sourceText.toLowerCase();
  for (const token of claimTokens(body)) {
    const bare = token.toLowerCase().replace(/\s/g, "");
    if (!source.replace(/\s/g, "").includes(bare)) {
      issues.push({
        code: "unverified_claim",
        severity: "warning",
        message: `"${token}" is not in your profile. Make sure it is true.`,
      });
    }
  }

  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.length - errors;
  return {
    score: Math.max(0, 100 - errors * 25 - warnings * 10),
    issues,
    words,
    chars,
  };
}
