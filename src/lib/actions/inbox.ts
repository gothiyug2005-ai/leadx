"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { getMailProvider } from "@/lib/providers/mail";
import { handleInbound } from "@/lib/replies/handle";
import { syncReplies } from "@/lib/replies/sync";
import { SendError, deliverMessage } from "@/lib/sending/send";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/target";
import { checkMessage } from "@/lib/writer/quality";
import type { Json } from "@/types/database";

import { fail, failFrom, ok, type ActionResult } from "./result";

const replySchema = z.object({
  body: z.string().trim().min(1, "Write a reply first.").max(5000),
});

/**
 * Reply to someone who wrote back. Replies are approved by this click, go to
 * the address they wrote from, stay in the same thread, and do not count
 * towards the daily outreach cap. Opt-outs and do-not-contact still apply.
 */
export async function sendReply(
  threadId: unknown,
  values: unknown,
): Promise<ActionResult<{ simulated: boolean }>> {
  try {
    const user = await requireUser();
    const id = uuidSchema.parse(threadId);
    const { body } = replySchema.parse(values);
    const supabase = await createClient();

    const { data: thread } = await supabase
      .from("threads")
      .select(
        "id, person_id, gmail_thread_id, subject, is_sample, person:people(target_id, is_sample)",
      )
      .eq("id", id)
      .maybeSingle();
    if (!thread?.person) return fail("That conversation no longer exists.");
    const { data: lastInbound } = await supabase
      .from("thread_messages")
      .select("from_email")
      .eq("thread_id", id)
      .eq("direction", "inbound")
      .eq("kind", "human")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const provider = await getMailProvider(user.id);
    if (provider.name === "mock" && !thread.person.is_sample)
      return fail("Connect Gmail in Settings to reply.");

    const subject = thread.subject
      ? `Re: ${thread.subject.replace(/^re:\s*/i, "")}`
      : "Re:";
    const now = new Date().toISOString();
    const { data: message, error } = await supabase
      .from("messages")
      .insert({
        person_id: thread.person_id,
        target_id: thread.person.target_id,
        channel: "email",
        type: "reply",
        subject,
        body,
        status: "scheduled",
        approved_at: now,
        scheduled_at: now,
        gmail_thread_id: thread.gmail_thread_id,
        quality: checkMessage({
          type: "cold_email",
          subject,
          body,
          sourceText: "",
        }) as unknown as NonNullable<Json>,
      })
      .select("id")
      .single();
    if (error || !message) return fail("Could not queue your reply.");

    try {
      const result = await deliverMessage(user.id, message.id, {
        provider,
        replyTo: lastInbound?.from_email ?? null,
      });
      await supabase
        .from("threads")
        .update({ needs_attention: false, handled_at: now })
        .eq("id", id);
      refresh();
      return ok({ simulated: result.simulated });
    } catch (sendError) {
      await supabase
        .from("messages")
        .update({ status: "cancelled" })
        .eq("id", message.id)
        .eq("status", "scheduled");
      refresh();
      return fail(
        sendError instanceof SendError
          ? sendError.message
          : "Your reply could not be sent.",
      );
    }
  } catch (error) {
    return failFrom(error);
  }
}

export async function markHandled(
  threadId: unknown,
  handled: unknown = true,
): Promise<ActionResult> {
  try {
    await requireUser();
    const supabase = await createClient();
    await supabase
      .from("threads")
      .update({
        needs_attention: handled !== true,
        handled_at: handled === true ? new Date().toISOString() : null,
      })
      .eq("id", uuidSchema.parse(threadId));
    refresh();
    return ok(undefined);
  } catch (error) {
    return failFrom(error);
  }
}

const stageSchema = z.enum([
  "to_contact",
  "contacted",
  "followed_up",
  "replied",
  "interview",
  "offer",
  "closed",
]);

export async function setStage(
  personId: unknown,
  stage: unknown,
): Promise<ActionResult> {
  try {
    await requireUser();
    const supabase = await createClient();
    const { error } = await supabase
      .from("people")
      .update({ stage: stageSchema.parse(stage) })
      .eq("id", uuidSchema.parse(personId));
    if (error) return fail("Could not update the stage.");
    refresh();
    return ok(undefined);
  } catch (error) {
    return failFrom(error);
  }
}

/** Check Gmail for replies right now instead of waiting for the scheduler. */
export async function checkForReplies(): Promise<
  ActionResult<{ newReplies: number }>
> {
  try {
    const user = await requireUser();
    const result = await syncReplies(user.id);
    refresh();
    return ok({ newReplies: result.newReplies });
  } catch (error) {
    return failFrom(error);
  }
}

/** Sample people only: pretend they replied, to try the inbox without real email. */
export async function simulateReply(
  threadId: unknown,
  text: unknown,
): Promise<ActionResult<{ classification?: string }>> {
  try {
    const user = await requireUser();
    const id = uuidSchema.parse(threadId);
    const reply = z.string().trim().min(1).max(3000).parse(text);
    const supabase = await createClient();
    const { data: thread } = await supabase
      .from("threads")
      .select("id, is_sample, person:people(email, full_name)")
      .eq("id", id)
      .maybeSingle();
    if (!thread) return fail("That conversation no longer exists.");
    if (!thread.is_sample)
      return fail("Replies can only be simulated for sample people.");

    const result = await handleInbound({
      userId: user.id,
      threadId: id,
      gmailMessageId: `mock-reply-${crypto.randomUUID()}`,
      fromEmail: thread.person?.email ?? null,
      fromName: thread.person?.full_name ?? null,
      subject: null,
      text: reply,
      sentAt: new Date(),
      kind: "human",
    });
    refresh();
    return ok({ classification: result.classification });
  } catch (error) {
    return failFrom(error);
  }
}
