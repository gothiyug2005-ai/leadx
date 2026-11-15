import "server-only";

import { runPrompt } from "@/lib/ai/run";
import { peopleRankPrompt } from "@/lib/ai/prompts";
import type { PeopleRanking } from "@/lib/ai/schemas/ranking";
import { parsedResumeSchema } from "@/lib/ai/schemas/resume";
import { DAY, withProviderCache } from "@/lib/providers/cache";
import {
  ProviderError,
  candidateFullName,
  getPeopleProvider,
  type PersonCandidate,
} from "@/lib/providers/people";
import { createClient } from "@/lib/supabase/server";
import { recordUsage } from "@/lib/usage/record";
import type { Json } from "@/types/database";

import {
  detectAngles,
  mergeAngles,
  type ConnectionAngle,
  type UserFacts,
} from "./angles";
import { searchTitlesFor } from "./titles";

const SEARCH_LIMIT = 25;
const MAX_RECOMMENDED = 5;
const MIN_RECOMMENDED = 3;

export interface DiscoveryResult {
  added: number;
  total: number;
  isSample: boolean;
}

export class DiscoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscoveryError";
  }
}

/** Pick 3-5 people to recommend: the best scorers, but never someone clearly irrelevant. */
export function pickRecommended(
  scored: { id: string; score: number }[],
): Set<string> {
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const picked = sorted
    .filter((entry) => entry.score >= 60)
    .slice(0, MAX_RECOMMENDED);
  for (const entry of sorted) {
    if (picked.length >= MIN_RECOMMENDED) break;
    if (!picked.includes(entry) && entry.score >= 40) picked.push(entry);
  }
  return new Set(picked.map((entry) => entry.id));
}

/**
 * Find people at a target's company, rank them for this role, and save them.
 * Runs as the signed-in user, so Row Level Security applies to every write.
 */
export async function discoverPeople(
  userId: string,
  targetId: string,
): Promise<DiscoveryResult> {
  const supabase = await createClient();

  const { data: target } = await supabase
    .from("targets")
    .select(
      "id, company_id, role_title, team, seniority, must_have_skills, job_summary, company:companies(name, domain)",
    )
    .eq("id", targetId)
    .maybeSingle();
  if (!target?.company)
    throw new DiscoveryError("That target no longer exists.");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "headline, positioning_statement, target_roles, location, resume_parsed",
    )
    .eq("id", userId)
    .maybeSingle();
  const resume = parsedResumeSchema.safeParse(profile?.resume_parsed);
  const user: UserFacts = {
    schools: resume.success
      ? resume.data.education.map((entry) => entry.school)
      : [],
    companies: resume.success
      ? resume.data.experience.map((entry) => entry.company)
      : [],
    location: profile?.location ?? null,
    skills: resume.success ? resume.data.skills : [],
  };

  await supabase
    .from("targets")
    .update({ discovery_status: "running", discovery_error: null })
    .eq("id", targetId);

  try {
    const provider = getPeopleProvider();
    const searchInput = {
      companyName: target.company.name,
      companyDomain: target.company.domain,
      titles: searchTitlesFor(target),
      limit: SEARCH_LIMIT,
    };
    const { value: candidates, hit } = await withProviderCache(
      {
        provider: provider.name,
        operation: "people_search",
        input: searchInput,
        ttlMs: 7 * DAY,
      },
      () =>
        provider.searchPeople({
          ...searchInput,
          hints: {
            schools: user.schools,
            companies: user.companies,
            location: user.location,
          },
        }),
    );
    await recordUsage({
      userId,
      provider: provider.name,
      operation: "people_search",
      units: candidates.length,
      isMock: provider.name === "mock",
      cacheHit: hit,
      metadata: { target_id: targetId },
    });

    const { data: existing } = await supabase
      .from("people")
      .select("provider_person_id, is_recommended")
      .eq("target_id", targetId);
    const known = new Set(
      (existing ?? []).map((row) => row.provider_person_id).filter(Boolean),
    );
    const fresh = candidates.filter(
      (candidate) => !known.has(candidate.providerId),
    );
    if (fresh.length === 0) {
      await markDone(supabase, targetId);
      return {
        added: 0,
        total: existing?.length ?? 0,
        isSample: provider.name === "mock",
      };
    }

    const detected = new Map<string, ConnectionAngle[]>(
      fresh.map((candidate) => [
        candidate.providerId,
        detectAngles(user, {
          schools: candidate.schools,
          pastCompanies: candidate.pastCompanies,
          location: candidate.location,
          title: candidate.title,
        }),
      ]),
    );

    const ranking = await runPrompt(
      peopleRankPrompt,
      {
        target: {
          company: target.company.name,
          role: target.role_title,
          team: target.team,
          seniority: target.seniority,
          skills: target.must_have_skills,
          summary: target.job_summary,
        },
        user: {
          headline: profile?.headline ?? null,
          positioning: profile?.positioning_statement ?? null,
          targetRoles: profile?.target_roles ?? [],
        },
        candidates: fresh.map((candidate) => ({
          id: candidate.providerId,
          title: candidate.title,
          location: candidate.location,
          schools: candidate.schools,
          pastCompanies: candidate.pastCompanies,
          angles: detected.get(candidate.providerId) ?? [],
        })),
      },
      { userId },
    );

    const rows = buildRows(fresh, ranking.output, detected, {
      targetId,
      companyId: target.company_id,
      alreadyHasRecommended: (existing ?? []).some((row) => row.is_recommended),
    });
    // Known people were filtered out above; a unique index still guards against a double click.
    const { error } = await supabase.from("people").insert(rows);
    if (error && error.code !== "23505")
      throw new Error(`Saving people failed: ${error.message}`);

    await markDone(supabase, targetId);
    return {
      added: rows.length,
      total: (existing?.length ?? 0) + rows.length,
      isSample: provider.name === "mock",
    };
  } catch (error) {
    const message =
      error instanceof ProviderError || error instanceof DiscoveryError
        ? error.message
        : error instanceof Error && error.name === "AiError"
          ? error.message
          : "Something went wrong while finding people.";
    await supabase
      .from("targets")
      .update({
        discovery_status: "failed",
        discovery_error: message.slice(0, 300),
      })
      .eq("id", targetId);
    throw new DiscoveryError(message);
  }
}

async function markDone(
  supabase: Awaited<ReturnType<typeof createClient>>,
  targetId: string,
) {
  await supabase
    .from("targets")
    .update({
      discovery_status: "done",
      discovered_at: new Date().toISOString(),
      discovery_error: null,
    })
    .eq("id", targetId);
}

export function buildRows(
  candidates: PersonCandidate[],
  ranking: PeopleRanking,
  detected: Map<string, ConnectionAngle[]>,
  context: {
    targetId: string;
    companyId: string;
    alreadyHasRecommended: boolean;
  },
) {
  const byId = new Map(
    ranking.ranked.map((entry) => [entry.candidate_id, entry]),
  );
  const scored = candidates.map((candidate) => ({
    id: candidate.providerId,
    score: byId.get(candidate.providerId)?.relevance_score ?? 0,
  }));
  const recommended = context.alreadyHasRecommended
    ? new Set<string>()
    : pickRecommended(scored);

  return candidates.map((candidate) => {
    const rank = byId.get(candidate.providerId);
    const angles = mergeAngles(
      detected.get(candidate.providerId) ?? [],
      rank?.extra_angles ?? [],
    );
    const hasSharedBackground = angles.some(
      (angle) =>
        angle.type === "shared_school" || angle.type === "past_company",
    );
    // Someone the AI saw only as a peer becomes "alumni" when they share real background.
    const roleType =
      rank?.role_type === "team_member" && hasSharedBackground
        ? "alumni"
        : (rank?.role_type ?? null);
    return {
      target_id: context.targetId,
      company_id: context.companyId,
      full_name: candidateFullName(candidate),
      first_name: candidate.firstName,
      last_name: candidate.lastName,
      title: candidate.title,
      location: candidate.location,
      linkedin_url: candidate.linkedinUrl,
      source: candidate.provider,
      provider_person_id: candidate.providerId,
      is_sample: candidate.isSample,
      role_type: roleType,
      relevance_score: rank?.relevance_score ?? null,
      relevance_reason: rank?.reason ?? null,
      connection_angles: angles as unknown as NonNullable<Json>,
      is_recommended: recommended.has(candidate.providerId),
    };
  });
}
