import {
  peopleRankingSchema,
  type PeopleRanking,
} from "@/lib/ai/schemas/ranking";
import type { ConnectionAngle } from "@/lib/discovery/angles";

import { HONESTY_RULES, asData } from "./shared";
import { definePrompt } from "./types";

export interface RankCandidate {
  id: string;
  title: string | null;
  location: string | null;
  schools: string[];
  pastCompanies: string[];
  angles: ConnectionAngle[];
}

export interface PeopleRankInput {
  target: {
    company: string;
    role: string | null;
    team: string | null;
    seniority: string | null;
    skills: string[];
    summary: string | null;
  };
  user: {
    headline: string | null;
    positioning: string | null;
    targetRoles: string[];
  };
  candidates: RankCandidate[];
}

type RoleType = PeopleRanking["ranked"][number]["role_type"];

/** Rule-based role guess from a job title; also used by the sample ranker. */
export function roleTypeFromTitle(
  title: string | null,
  targetRole: string | null,
): RoleType {
  const value = (title ?? "").toLowerCase();
  if (
    /recruit|talent|sourcer|people partner|\bhr\b|human resources/.test(value)
  )
    return "recruiter";
  if (
    /\b(ceo|cto|cfo|coo|cpo|cmo|chief|vp|vice president|founder|president)\b/.test(
      value,
    )
  )
    return "leadership";
  if (/manager|head of|lead\b|director|supervisor/.test(value))
    return "hiring_manager";
  if (
    targetRole &&
    value.includes(
      targetRole
        .toLowerCase()
        .replace(/^(senior|sr\.?|junior|jr\.?|lead|staff)\s+/, ""),
    )
  ) {
    return "team_member";
  }
  return "team_member";
}

const BASE_SCORE: Record<RoleType, number> = {
  hiring_manager: 78,
  recruiter: 66,
  team_member: 55,
  alumni: 60,
  leadership: 45,
};

const REASONS: Record<RoleType, string> = {
  hiring_manager: "Likely manages or hires for the team this role sits in.",
  recruiter: "Recruits for roles like this and can route your application.",
  team_member:
    "Works in a similar role and can tell you about the team or refer you.",
  alumni: "Shares your background, which makes a warm reply more likely.",
  leadership:
    "Senior leader; worth a short note if the team contact is unclear.",
};

function words(value: string | null): string[] {
  return (value ?? "")
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter(
      (word) =>
        word.length > 2 &&
        !["senior", "junior", "lead", "staff", "the", "and"].includes(word),
    );
}

/** Sample-mode ranking: role type from title, nudged by team words and shared background. */
export function heuristicRanking(input: PeopleRankInput): PeopleRanking {
  const focus = new Set([
    ...words(input.target.role),
    ...words(input.target.team),
  ]);
  return {
    ranked: input.candidates
      .map((candidate) => {
        const roleType = roleTypeFromTitle(candidate.title, input.target.role);
        const overlap = words(candidate.title).filter((word) =>
          focus.has(word),
        ).length;
        const angleBonus = candidate.angles.length * 6;
        const score = Math.min(
          98,
          BASE_SCORE[roleType] + overlap * 7 + angleBonus,
        );
        const strongestAngle = candidate.angles[0];
        return {
          candidate_id: candidate.id,
          role_type: roleType,
          relevance_score: score,
          reason: strongestAngle
            ? `${REASONS[roleType].replace(/\.$/, "")}; ${strongestAngle.detail.charAt(0).toLowerCase() + strongestAngle.detail.slice(1)}.`
            : REASONS[roleType],
          extra_angles: [],
        };
      })
      .sort((a, b) => b.relevance_score - a.relevance_score),
  };
}

export const peopleRankPrompt = definePrompt<PeopleRankInput, PeopleRanking>({
  id: "people-rank",
  version: 1,
  effort: "medium",
  maxTokens: 8000,
  system: `You help a job seeker decide who to contact at a company about a specific role.
Score each candidate 0-100 by how likely they are to help with THIS role, and classify them.
- hiring_manager: likely manages or hires for the team this role is on. Usually the best contact (70-95) when the team matches.
- recruiter: recruits for this kind of role (60-80). Generic HR or recruiters for unrelated functions score lower.
- team_member: would be a peer on the team; good for referrals and insight (45-75).
- alumni: shares the user's school or past company; boost anyone with a real shared background.
- leadership: executives; useful only for small companies or when no team contact exists (30-60).
A manager of the matching team beats generic HR. Someone in an unrelated department scores low.
The reason is one plain sentence under 20 words, specific to this role and person, no flattery.
${HONESTY_RULES} Only add extra_angles that the given data supports; detected angles are already known.
Return every candidate exactly once, using the given candidate_id.`,
  outputSchema: peopleRankingSchema,
  buildContent: (input) =>
    [
      asData("target", JSON.stringify(input.target)),
      asData("job_seeker", JSON.stringify(input.user)),
      asData("candidates", JSON.stringify(input.candidates)),
    ].join("\n\n"),
  mock: heuristicRanking,
});
