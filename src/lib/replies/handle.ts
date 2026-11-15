import "server-only";

import { runPrompt } from "@/lib/ai/run";
import { classifyReplyPrompt } from "@/lib/ai/prompts";
import type { ReplyClassification } from "@/lib/ai/schemas/reply";
import { stopSequence } from "@/lib/sequences/start";
import { createServiceClient } from "@/lib/supabase/server";

import type { InboundKind } from "./parse";

export interface InboundMessage {
  userId: string;
  threadId: string;
  gmailMessageId: string;
  fromEmail: string | null;
  fromName: string | null;
  subject: string | null;
  text: string;
  sentAt: Date;
  kind: InboundKind;
  bouncedEmail?: string | null;
}

const REPLIED_OR_LATER = new Set(["replied", "interview", "offer", "closed"]);

/**
 * Record one incoming message and react to it. Safe to call twice for the same
 * Gmail message: the second call is a no-op.
 *   - human reply: stop follow-ups, move the person to "Replied", classify it and suggest a response
 *   - opt-out: also suppress the address and mark the person do-not-contact
 *   - bounce: mark the address invalid and stop the sequence
 *   - auto-reply (out of office): recorded only; follow-ups continue
 */
export async function handleInbound(
  input: InboundMessage,
): Promise<{ recorded: boolean; classification?: string }> {
  const service = createServiceClient();
  const { data: thread } = await service
    .from("threads")
    .select(
      "id, person_id, sequence_id, person:people(id, first_name, full_name, email, stage, target:targets(role_title), company:companies(name))",
    )
    .eq("id", input.threadId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (!thread?.person) return { recorded: false };

  const snippet = input.text.replace(/\s+/g, " ").slice(0, 160);
  const { data: inserted } = await service
    .from("thread_messages")
    .upsert(
      {
        user_id: input.userId,
        thread_id: thread.id,
        gmail_message_id: input.gmailMessageId,
        direction: "inbound",
        kind: input.kind,
        from_email: input.fromEmail,
        from_name: input.fromName,
        subject: input.subject,
        body_text: input.text,
        snippet,
        sent_at: input.sentAt.toISOString(),
      },
      { onConflict: "user_id,gmail_message_id", ignoreDuplicates: true },
    )
    .select("id");
  if (!inserted?.length) return { recorded: false };

  await service
    .from("threads")
    .update({ last_message_at: input.sentAt.toISOString(), snippet })
    .eq("id", thread.id);

  if (input.kind === "auto_reply") return { recorded: true };

  if (input.kind === "bounce") {
    const address = (
      input.bouncedEmail ??
      thread.person.email ??
      ""
    ).toLowerCase();
    if (address) {
      await service
        .from("suppressions")
        .upsert(
          { user_id: input.userId, email: address, reason: "bounce" },
          { onConflict: "user_id,email", ignoreDuplicates: true },
        );
    }
    await service
      .from("people")
      .update({ email_status: "invalid" })
      .eq("id", thread.person.id);
    if (thread.sequence_id) await stopSequence(thread.sequence_id, "bounced");
    return { recorded: true };
  }

  // A real reply.
  if (thread.sequence_id) await stopSequence(thread.sequence_id, "replied");
  if (!REPLIED_OR_LATER.has(thread.person.stage)) {
    await service
      .from("people")
      .update({ stage: "replied" })
      .eq("id", thread.person.id);
  }

  const [{ data: lastOutbound }, { data: profile }] = await Promise.all([
    service
      .from("thread_messages")
      .select("body_text")
      .eq("thread_id", thread.id)
      .eq("direction", "outbound")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    service
      .from("profiles")
      .select("full_name")
      .eq("id", input.userId)
      .single(),
  ]);

  let classification: ReplyClassification | null = null;
  try {
    const result = await runPrompt(
      classifyReplyPrompt,
      {
        senderFirstName: profile?.full_name?.split(" ")[0] ?? "Me",
        recipientFirstName:
          thread.person.first_name ??
          thread.person.full_name.split(" ")[0] ??
          "there",
        role: thread.person.target?.role_title ?? null,
        company: thread.person.company?.name ?? "the company",
        ourEmail: lastOutbound?.body_text ?? "",
        theirReply: input.text.slice(0, 6000),
      },
      { userId: input.userId },
    );
    classification = result.output;
  } catch (error) {
    console.error("Reply classification failed", error);
  }

  const isOptOut = classification?.classification === "opt_out";
  await service
    .from("threads")
    .update({
      last_inbound_at: input.sentAt.toISOString(),
      needs_attention: !isOptOut,
      handled_at: isOptOut ? new Date().toISOString() : null,
      classification: classification?.classification ?? null,
      classification_reason: classification?.reason ?? null,
      suggested_reply: classification?.suggested_reply || null,
      classified_at: classification ? new Date().toISOString() : null,
    })
    .eq("id", thread.id);

  if (isOptOut) {
    const address = (
      input.fromEmail ??
      thread.person.email ??
      ""
    ).toLowerCase();
    if (address) {
      await service
        .from("suppressions")
        .upsert(
          { user_id: input.userId, email: address, reason: "opt_out" },
          { onConflict: "user_id,email", ignoreDuplicates: true },
        );
    }
    if (thread.person.email && thread.person.email.toLowerCase() !== address) {
      await service
        .from("suppressions")
        .upsert(
          {
            user_id: input.userId,
            email: thread.person.email.toLowerCase(),
            reason: "opt_out",
          },
          { onConflict: "user_id,email", ignoreDuplicates: true },
        );
    }
    await service
      .from("people")
      .update({ do_not_contact: true, is_recommended: false })
      .eq("id", thread.person.id);
    await service
      .from("messages")
      .update({ status: "cancelled" })
      .eq("person_id", thread.person.id)
      .in("status", ["draft", "scheduled"]);
  }

  return { recorded: true, classification: classification?.classification };
}
