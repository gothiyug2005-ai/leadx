import type { ConnectionAngle } from "@/lib/discovery/angles";

import type { MessageType } from "./rules";

/** Everything the writer may use. Anything not in here must not appear in a message. */
export interface WriterContext {
  type: MessageType;
  sender: {
    fullName: string;
    firstName: string;
    headline: string | null;
    positioning: string | null;
    tone: "formal" | "warm" | "concise";
    writingSample: string | null;
    skills: string[];
    highlights: string[];
    storyAnswers: string[];
  };
  recipient: {
    firstName: string;
    fullName: string;
    title: string | null;
    roleType: string | null;
  };
  target: {
    company: string;
    role: string | null;
    team: string | null;
    skills: string[];
    summary: string | null;
  };
  angles: ConnectionAngle[];
  brief: {
    bestHook: string | null;
    talkingPoints: string[];
    avoid: string[];
    news: string[];
    teamFocus: string | null;
  } | null;
  /** For follow-ups: the earlier email. */
  previous: { subject: string | null; body: string } | null;
}

/** All facts a message may draw on, flattened for the claim checker. */
export function contextSourceText(context: WriterContext): string {
  return [
    context.sender.headline,
    context.sender.positioning,
    ...context.sender.skills,
    ...context.sender.highlights,
    ...context.sender.storyAnswers,
    context.target.company,
    context.target.role,
    context.target.team,
    ...context.target.skills,
    context.target.summary,
    ...context.angles.map((angle) => angle.detail),
    context.brief?.bestHook,
    ...(context.brief?.talkingPoints ?? []),
    ...(context.brief?.news ?? []),
    context.brief?.teamFocus,
    context.previous?.body,
  ]
    .filter(Boolean)
    .join("\n");
}
