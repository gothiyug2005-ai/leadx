import "server-only";

import { getCurrentUser, getProfile } from "@/lib/auth";
import { localDay, safeTimeZone, type LocalDay } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

const PERSON_FIELDS =
  "id, full_name, title, target_id, company:companies(name)" as const;

export async function getTodayData() {
  const user = await getCurrentUser();
  const profile = await getProfile();
  if (!user || !profile) return null;

  const timeZone = safeTimeZone(profile.timezone);
  const now = new Date();
  const day: LocalDay = localDay(now, timeZone);
  const supabase = await createClient();

  const [targets, replies, followUps, toContact] = await Promise.all([
    supabase
      .from("targets")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("threads")
      .select(
        `id, subject, snippet, classification, last_inbound_at, is_sample, person:people(${PERSON_FIELDS})`,
      )
      .eq("needs_attention", true)
      .order("last_inbound_at", { ascending: false, nullsFirst: false })
      .limit(10),
    supabase
      .from("messages")
      .select(
        `id, subject, scheduled_at, sequence_step, person:people(${PERSON_FIELDS})`,
      )
      .eq("status", "scheduled")
      .gt("sequence_step", 0)
      .lt("scheduled_at", day.end.toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(10),
    supabase
      .from("people")
      .select(
        "id, full_name, title, role_type, relevance_reason, is_recommended, email_status, is_sample, target_id, company:companies(name)",
      )
      .eq("stage", "to_contact")
      .eq("do_not_contact", false)
      .order("is_recommended", { ascending: false })
      .order("relevance_score", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: true })
      .limit(5),
  ]);

  return {
    profile,
    timeZone,
    now,
    day,
    activeTargets: targets.count ?? 0,
    replies: replies.data ?? [],
    followUps: followUps.data ?? [],
    toContact: toContact.data ?? [],
    hasError: Boolean(
      targets.error || replies.error || followUps.error || toContact.error,
    ),
  };
}

export type TodayData = NonNullable<Awaited<ReturnType<typeof getTodayData>>>;
