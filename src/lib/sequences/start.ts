import "server-only";

import { runPrompt } from "@/lib/ai/run";
import { followUpPrompt } from "@/lib/ai/prompts";
import { createServiceClient } from "@/lib/supabase/server";
import { contextSourceText } from "@/lib/writer/context";
import { loadWriterContext } from "@/lib/writer/load";
import { checkMessage } from "@/lib/writer/quality";
import type { Json } from "@/types/database";

import { inferTimeZone, scheduleSendTime } from "./timing";

export const FOLLOW_UP_DAYS = [3, 7] as const;

/**
 * After a first email is sent: open a sequence for this person and, if the
 * user chose it, write and schedule two follow-ups. The user approved them by
 * ticking "follow up automatically" when they sent the first email, and can
 * edit or cancel them until they go out. Any reply stops them.
 */
export async function startSequence(
  userId: string,
  messageId: string,
  options: { followUps: boolean },
): Promise<{ sequenceId: string; scheduled: number }> {
  const service = createServiceClient();
  const { data: message } = await service
    .from("messages")
    .select("id, person_id, target_id, subject, sent_at, gmail_thread_id, type")
    .eq("id", messageId)
    .eq("user_id", userId)
    .single();
  if (!message) throw new Error("Message not found");

  // One live sequence per person: a fresh first email replaces an older one.
  const { data: previous } = await service
    .from("sequences")
    .select("id")
    .eq("person_id", message.person_id)
    .eq("status", "active");
  for (const sequence of previous ?? [])
    await stopSequence(sequence.id, "manual");

  const startedAt = message.sent_at ?? new Date().toISOString();
  const { data: sequence, error } = await service
    .from("sequences")
    .insert({
      user_id: userId,
      person_id: message.person_id,
      target_id: message.target_id,
      status: options.followUps ? "active" : "completed",
      gmail_thread_id: message.gmail_thread_id,
      started_at: startedAt,
      follow_up_days: [...FOLLOW_UP_DAYS],
    })
    .select("id")
    .single();
  if (error || !sequence)
    throw new Error(`Could not start the sequence: ${error?.message}`);

  await service
    .from("messages")
    .update({ sequence_id: sequence.id })
    .eq("id", messageId);
  if (message.gmail_thread_id) {
    await service
      .from("threads")
      .update({ sequence_id: sequence.id })
      .eq("user_id", userId)
      .eq("gmail_thread_id", message.gmail_thread_id);
  }
  if (!options.followUps) return { sequenceId: sequence.id, scheduled: 0 };

  const [{ data: person }, { data: profile }] = await Promise.all([
    service
      .from("people")
      .select("location, timezone")
      .eq("id", message.person_id)
      .single(),
    service.from("profiles").select("timezone").eq("id", userId).single(),
  ]);
  const timeZone =
    person?.timezone ??
    inferTimeZone(person?.location, profile?.timezone ?? "UTC");
  if (!person?.timezone)
    await service
      .from("people")
      .update({ timezone: timeZone })
      .eq("id", message.person_id);

  const { context } = await loadWriterContext(
    userId,
    message.person_id,
    "follow_up",
  );
  const withPrevious = {
    ...context,
    previous: { subject: message.subject, body: "" },
  };
  const source = contextSourceText(withPrevious);
  const approvedAt = new Date().toISOString();

  let scheduled = 0;
  for (const [index, days] of FOLLOW_UP_DAYS.entries()) {
    const step = (index + 1) as 1 | 2;
    const result = await runPrompt(
      followUpPrompt,
      { context: withPrevious, step },
      { userId },
    );
    const subject = message.subject
      ? `Re: ${message.subject.replace(/^re:\s*/i, "")}`
      : result.output.subject;
    const body = result.output.body.trim();
    await service.from("messages").insert({
      user_id: userId,
      person_id: message.person_id,
      target_id: message.target_id,
      sequence_id: sequence.id,
      channel: "email",
      type: "follow_up",
      sequence_step: step,
      subject,
      body,
      status: "scheduled",
      approved_at: approvedAt,
      scheduled_at: scheduleSendTime({
        from: new Date(startedAt),
        days,
        timeZone,
      }).toISOString(),
      quality: checkMessage({
        type: "follow_up",
        subject,
        body,
        sourceText: source,
      }) as unknown as NonNullable<Json>,
      model: result.model,
      prompt_id: result.promptId,
      prompt_version: result.promptVersion,
      is_sample: result.isSample,
    });
    scheduled += 1;
  }
  return { sequenceId: sequence.id, scheduled };
}

/** Stop a sequence and cancel anything it still had waiting to go out. */
export async function stopSequence(
  sequenceId: string,
  reason:
    "replied" | "opted_out" | "bounced" | "manual" | "suppressed" | "failed",
): Promise<void> {
  const service = createServiceClient();
  await service
    .from("sequences")
    .update({
      status: "stopped",
      stop_reason: reason,
      stopped_at: new Date().toISOString(),
    })
    .eq("id", sequenceId)
    .eq("status", "active");
  await service
    .from("messages")
    .update({ status: "cancelled" })
    .eq("sequence_id", sequenceId)
    .in("status", ["scheduled", "draft"]);
}
