import "server-only";

import { getProfile, requireUser } from "@/lib/auth";
import { safeTimeZone } from "@/lib/dates";
import { computeInsights } from "@/lib/insights/compute";
import { createClient } from "@/lib/supabase/server";

export async function getInsights() {
  await requireUser();
  const profile = await getProfile();
  const timeZone = safeTimeZone(profile?.timezone);
  const supabase = await createClient();

  const [people, messages, replies] = await Promise.all([
    supabase.from("people").select("id, stage, role_type").limit(5000),
    supabase
      .from("messages")
      .select("person_id, type, angle, sent_at")
      .eq("status", "sent")
      .eq("channel", "email")
      .limit(10000),
    supabase
      .from("thread_messages")
      .select("sent_at, thread:threads(person_id)")
      .eq("direction", "inbound")
      .eq("kind", "human")
      .limit(10000),
  ]);

  const insights = computeInsights(
    {
      people: people.data ?? [],
      messages: (messages.data ?? []).filter(
        (row): row is typeof row & { sent_at: string } => Boolean(row.sent_at),
      ),
      replies: (replies.data ?? []).flatMap((row) =>
        row.thread?.person_id
          ? [{ person_id: row.thread.person_id, sent_at: row.sent_at }]
          : [],
      ),
    },
    { now: new Date(), timeZone },
  );
  return {
    insights,
    timeZone,
    error: Boolean(people.error || messages.error || replies.error),
  };
}
