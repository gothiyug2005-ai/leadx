import "server-only";

import { cache } from "react";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const listThreads = cache(async () => {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("threads")
    .select(
      "id, subject, snippet, classification, needs_attention, last_message_at, last_inbound_at, is_sample, person:people(id, full_name, title, stage, company:companies(name))",
    )
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(200);
  const threads = data ?? [];
  return {
    error: Boolean(error),
    needsReply: threads.filter((thread) => thread.needs_attention),
    waiting: threads.filter(
      (thread) => !thread.needs_attention && !thread.last_inbound_at,
    ),
    done: threads.filter(
      (thread) => !thread.needs_attention && thread.last_inbound_at,
    ),
  };
});

export type InboxThread = Awaited<
  ReturnType<typeof listThreads>
>["needsReply"][number];

export const getThread = cache(async (id: string) => {
  await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("threads")
    .select(
      "id, subject, classification, classification_reason, suggested_reply, needs_attention, handled_at, is_sample, sequence_id, person:people(id, full_name, first_name, title, stage, email, do_not_contact, company:companies(name)), thread_messages(id, direction, kind, from_email, from_name, body_text, sent_at)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return {
    ...data,
    thread_messages: [...(data.thread_messages ?? [])].sort((a, b) =>
      a.sent_at.localeCompare(b.sent_at),
    ),
  };
});

export type ThreadDetail = NonNullable<Awaited<ReturnType<typeof getThread>>>;
