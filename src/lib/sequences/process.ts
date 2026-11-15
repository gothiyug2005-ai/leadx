import "server-only";

import { getMailProvider } from "@/lib/providers/mail";
import { SendError, deliverMessage } from "@/lib/sending/send";
import { createServiceClient } from "@/lib/supabase/server";

import { stopSequence } from "./start";
import { inferTimeZone, scheduleSendTime, spacingMinutes } from "./timing";

export interface ProcessSummary {
  sent: number;
  deferred: number;
  cancelled: number;
  failed: number;
}

const PERMANENT_REFUSALS = new Set([
  "suppressed",
  "do_not_contact",
  "invalid_email",
  "missing_email",
  "sample_data",
  "unverified_email",
]);

/**
 * Send whatever is due. Runs every few minutes from the scheduler. At most one
 * message per user per run, and the user's other due messages are pushed back a
 * few random minutes, so sends are spaced out naturally.
 */
export async function processDueMessages(
  now: Date = new Date(),
  maxUsers = 50,
): Promise<ProcessSummary> {
  const service = createServiceClient();
  const summary: ProcessSummary = {
    sent: 0,
    deferred: 0,
    cancelled: 0,
    failed: 0,
  };

  const { data: due } = await service
    .from("messages")
    .select(
      "id, user_id, person_id, sequence_id, scheduled_at, sequence:sequences(status), person:people(is_sample, location, timezone)",
    )
    .eq("status", "scheduled")
    .eq("channel", "email")
    .lte("scheduled_at", now.toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(500);

  const byUser = new Map<string, NonNullable<typeof due>>();
  for (const message of due ?? []) {
    const list = byUser.get(message.user_id) ?? [];
    list.push(message);
    byUser.set(message.user_id, list);
  }

  for (const [userId, messages] of [...byUser.entries()].slice(0, maxUsers)) {
    const [next, ...rest] = messages;
    if (!next) continue;

    // A stopped sequence (reply, opt-out, bounce) means its follow-ups must never go out.
    if (next.sequence_id && next.sequence?.status !== "active") {
      await service
        .from("messages")
        .update({ status: "cancelled" })
        .eq("id", next.id);
      summary.cancelled += 1;
      continue;
    }

    const provider = await getMailProvider(userId);
    if (provider.name === "mock" && !next.person?.is_sample) {
      // Gmail was disconnected: wait for the user to reconnect rather than pretend to send.
      await service
        .from("messages")
        .update({ error: "Waiting for Gmail to be reconnected." })
        .eq("id", next.id);
      summary.deferred += 1;
      continue;
    }

    try {
      await deliverMessage(userId, next.id, { provider });
      summary.sent += 1;
      if (next.sequence_id) await completeIfFinished(next.sequence_id);
    } catch (error) {
      if (error instanceof SendError && error.reason === "daily_cap_reached") {
        const { data: profile } = await service
          .from("profiles")
          .select("timezone")
          .eq("id", userId)
          .single();
        const timeZone =
          next.person?.timezone ??
          inferTimeZone(next.person?.location, profile?.timezone ?? "UTC");
        await service
          .from("messages")
          .update({
            scheduled_at: scheduleSendTime({
              from: now,
              days: 1,
              timeZone,
            }).toISOString(),
          })
          .eq("id", next.id);
        summary.deferred += 1;
      } else if (
        error instanceof SendError &&
        PERMANENT_REFUSALS.has(error.reason)
      ) {
        await service
          .from("messages")
          .update({ status: "cancelled", error: error.message })
          .eq("id", next.id);
        if (next.sequence_id)
          await stopSequence(next.sequence_id, "suppressed");
        summary.cancelled += 1;
      } else {
        summary.failed += 1;
      }
    }

    // Space out this user's remaining due messages.
    for (const [index, message] of rest.entries()) {
      const later = new Date(
        now.getTime() + (index + 1) * spacingMinutes() * 60_000,
      );
      await service
        .from("messages")
        .update({ scheduled_at: later.toISOString() })
        .eq("id", message.id);
    }
  }
  return summary;
}

async function completeIfFinished(sequenceId: string) {
  const service = createServiceClient();
  const { count } = await service
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("sequence_id", sequenceId)
    .eq("status", "scheduled");
  if (!count) {
    await service
      .from("sequences")
      .update({ status: "completed" })
      .eq("id", sequenceId)
      .eq("status", "active");
  }
}
