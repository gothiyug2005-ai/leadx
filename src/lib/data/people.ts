import "server-only";

import { cache } from "react";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const getPerson = cache(async (id: string) => {
  await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("people")
    .select(
      "id, full_name, first_name, last_name, title, location, linkedin_url, role_type, relevance_score, relevance_reason, connection_angles, is_recommended, do_not_contact, stage, email, email_status, email_source, email_confidence, email_risk_accepted_at, enrichment_status, enrichment_error, notes, company_id, source, is_sample, target:targets(id, role_title, team, kind), company:companies(id, name, domain)",
    )
    .eq("id", id)
    .maybeSingle();
  return data;
});

export type PersonDetail = NonNullable<Awaited<ReturnType<typeof getPerson>>>;

export const getPersonResearch = cache(
  async (personId: string, companyId: string) => {
    await requireUser();
    const supabase = await createClient();
    const { data } = await supabase
      .from("research_briefs")
      .select("scope, content, sources, is_sample, created_at, expires_at")
      .or(
        `person_id.eq.${personId},and(company_id.eq.${companyId},scope.eq.company)`,
      );
    return {
      company: data?.find((row) => row.scope === "company") ?? null,
      person: data?.find((row) => row.scope === "person") ?? null,
    };
  },
);

/** The person's current set of drafts (the newest group), for the composer. */
export const getComposerDrafts = cache(async (personId: string) => {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select(
      "id, type, channel, angle, subject, body, status, is_selected, quality, is_sample, variant_group, created_at",
    )
    .eq("person_id", personId)
    .in("status", ["draft", "copied"])
    .not("variant_group", "is", null)
    .order("created_at", { ascending: false })
    .limit(40);
  // Keep the newest set of drafts for each message type.
  const newestGroup = new Map<string, string | null>();
  for (const message of data ?? []) {
    if (!newestGroup.has(message.type))
      newestGroup.set(message.type, message.variant_group);
  }
  return (data ?? [])
    .filter(
      (message) => newestGroup.get(message.type) === message.variant_group,
    )
    .reverse();
});

/** Messages already sent to this person, newest first, for the history card. */
export const getSentMessages = cache(async (personId: string) => {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("id, type, subject, body, sent_at, gmail_message_id, status, error")
    .eq("person_id", personId)
    .in("status", ["sent", "failed"])
    .order("created_at", { ascending: false })
    .limit(10);
  return data ?? [];
});
