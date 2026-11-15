import "server-only";

import { cache } from "react";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const CONTACTED = new Set([
  "contacted",
  "followed_up",
  "replied",
  "interview",
  "offer",
  "closed",
]);
const REPLIED = new Set(["replied", "interview", "offer"]);

export interface TargetProgress {
  found: number;
  contacted: number;
  replied: number;
}

export function progressFor(people: { stage: string }[]): TargetProgress {
  return {
    found: people.length,
    contacted: people.filter((person) => CONTACTED.has(person.stage)).length,
    replied: people.filter((person) => REPLIED.has(person.stage)).length,
  };
}

const TARGET_FIELDS =
  "id, kind, role_title, team, seniority, location, status, must_have_skills, nice_to_have_skills, job_url, job_summary, discovery_status, created_at, updated_at, company:companies(id, name, domain)" as const;

export const listTargets = cache(async () => {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("targets")
    .select(`${TARGET_FIELDS}, people(stage, full_name)`)
    .order("created_at", { ascending: false });

  return {
    error: Boolean(error),
    targets: (data ?? []).map(({ people, ...target }) => ({
      ...target,
      personName:
        target.kind === "person" ? (people?.[0]?.full_name ?? null) : null,
      progress: progressFor(people ?? []),
    })),
  };
});

export type TargetListItem = Awaited<
  ReturnType<typeof listTargets>
>["targets"][number];

export const getTarget = cache(async (id: string) => {
  await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("targets")
    .select(
      `${TARGET_FIELDS}, discovery_error, people(id, full_name, title, location, role_type, relevance_score, relevance_reason, connection_angles, is_recommended, do_not_contact, stage, email, email_status, linkedin_url, source, is_sample, created_at)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const { people, ...target } = data;
  return {
    ...target,
    people: people ?? [],
    personName:
      target.kind === "person" ? (people?.[0]?.full_name ?? null) : null,
    progress: progressFor(people ?? []),
  };
});

export type TargetDetail = NonNullable<Awaited<ReturnType<typeof getTarget>>>;
