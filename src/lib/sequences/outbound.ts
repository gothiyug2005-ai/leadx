import "server-only";

import { createServiceClient } from "@/lib/supabase/server";

type Service = ReturnType<typeof createServiceClient>;

/** Record a sent email on its conversation thread, creating the thread on first send. */
export async function recordOutbound(
  service: Service,
  input: {
    userId: string;
    personId: string;
    messageId: string;
    sequenceId: string | null;
    gmailThreadId: string | null;
    gmailMessageId: string;
    subject: string | null;
    body: string;
    to: string;
    from: string;
    isSample: boolean;
  },
): Promise<string | null> {
  if (!input.gmailThreadId) return null;
  const now = new Date().toISOString();
  const snippet = input.body.replace(/\s+/g, " ").slice(0, 160);

  const { data: existing } = await service
    .from("threads")
    .select("id")
    .eq("user_id", input.userId)
    .eq("gmail_thread_id", input.gmailThreadId)
    .maybeSingle();

  let threadId = existing?.id ?? null;
  if (threadId) {
    await service
      .from("threads")
      .update({
        last_message_at: now,
        snippet,
        ...(input.sequenceId ? { sequence_id: input.sequenceId } : {}),
      })
      .eq("id", threadId);
  } else {
    const { data: created } = await service
      .from("threads")
      .insert({
        user_id: input.userId,
        person_id: input.personId,
        sequence_id: input.sequenceId,
        gmail_thread_id: input.gmailThreadId,
        subject: input.subject,
        snippet,
        last_message_at: now,
        is_sample: input.isSample,
      })
      .select("id")
      .single();
    threadId = created?.id ?? null;
  }
  if (!threadId) return null;

  await service.from("thread_messages").upsert(
    {
      user_id: input.userId,
      thread_id: threadId,
      message_id: input.messageId,
      gmail_message_id: input.gmailMessageId,
      direction: "outbound",
      kind: "human",
      from_email: input.from,
      to_email: input.to,
      subject: input.subject,
      body_text: input.body,
      snippet,
      sent_at: now,
    },
    { onConflict: "user_id,gmail_message_id", ignoreDuplicates: true },
  );
  return threadId;
}
