"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { removeConnection } from "@/lib/gmail/connection";
import { revokeToken } from "@/lib/gmail/oauth";
import { getMailProvider } from "@/lib/providers/mail";
import { SendError, deliverMessage, returnToDraft } from "@/lib/sending/send";
import { startSequence } from "@/lib/sequences/start";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/target";
import { contextSourceText } from "@/lib/writer/context";
import { WriterError, loadWriterContext } from "@/lib/writer/load";
import { checkMessage } from "@/lib/writer/quality";
import { MESSAGE_TYPES, RULES } from "@/lib/writer/rules";
import type { Json } from "@/types/database";

import { fail, failFrom, ok, type ActionResult } from "./result";

const finalSchema = z.object({
  subject: z.string().trim().min(1, "Add a subject line.").max(200),
  body: z.string().trim().min(1, "The message is empty.").max(5000),
  /** First emails only: schedule two follow-ups that stop on any reply. */
  followUps: z.boolean().optional().default(false),
});

const FIRST_EMAIL_TYPES = new Set(["cold_email", "referral_request"]);

/**
 * The user has reviewed this email and clicked Send. Nothing is ever sent
 * without this explicit approval, and the database's send gate checks the
 * daily cap, opt-outs and the address before anything leaves.
 */
export async function approveAndSend(
  messageId: unknown,
  values: unknown,
): Promise<
  ActionResult<{ simulated: boolean; to: string; followUpsScheduled: number }>
> {
  let id: string | null = null;
  try {
    const user = await requireUser();
    id = uuidSchema.parse(messageId);
    const final = finalSchema.parse(values);
    const supabase = await createClient();

    const { data: message } = await supabase
      .from("messages")
      .select(
        "id, type, channel, status, person_id, variant_group, person:people(is_sample)",
      )
      .eq("id", id)
      .maybeSingle();
    if (!message) return fail("That draft no longer exists.");
    if (message.channel !== "email")
      return fail(
        "LinkedIn messages are never sent by LeadX. Copy it instead.",
      );
    if (!["draft", "copied", "failed"].includes(message.status))
      return fail("This message has already been sent.");

    const type = z.enum(MESSAGE_TYPES).parse(message.type);
    const { context } = await loadWriterContext(
      user.id,
      message.person_id,
      type,
    );
    const quality = checkMessage({
      type,
      subject: final.subject,
      body: final.body,
      sourceText: contextSourceText(context),
    });
    const blocking = quality.issues.filter(
      (issue) => issue.severity === "error",
    );
    if (blocking.length)
      return fail(`Fix this before sending: ${blocking[0]!.message}`);
    if (!RULES[type].hasSubject)
      return fail("This message type cannot be emailed.");

    const provider = await getMailProvider(user.id);
    if (provider.name === "mock" && !message.person?.is_sample) {
      return fail("Connect Gmail in Settings to send real email.");
    }

    // Record the approval and queue it; the gate refuses anything not approved and queued.
    const now = new Date().toISOString();
    if (message.variant_group) {
      await supabase
        .from("messages")
        .update({ is_selected: false })
        .eq("variant_group", message.variant_group);
    }
    const { error } = await supabase
      .from("messages")
      .update({
        subject: final.subject,
        body: final.body,
        quality: quality as unknown as NonNullable<Json>,
        is_selected: true,
        approved_at: now,
        scheduled_at: now,
        status: "scheduled",
        error: null,
      })
      .eq("id", id);
    if (error) return fail("Could not queue this message. Please try again.");

    const result = await deliverMessage(user.id, id, { provider });

    let followUpsScheduled = 0;
    if (FIRST_EMAIL_TYPES.has(type)) {
      try {
        followUpsScheduled = (
          await startSequence(user.id, id, { followUps: final.followUps })
        ).scheduled;
      } catch (error) {
        // The email went out; a follow-up problem must not look like a failed send.
        console.error("Starting the sequence failed", error);
      }
    }
    refresh();
    return ok({
      simulated: result.simulated,
      to: result.to,
      followUpsScheduled,
    });
  } catch (error) {
    if (error instanceof SendError) {
      // Refused by the gate: hand it back as a draft. A failed delivery stays "failed" so it can be retried.
      if (
        id &&
        ![
          "auth",
          "rate_limited",
          "rejected",
          "unavailable",
          "send_failed",
        ].includes(error.reason)
      ) {
        await returnToDraft(id);
      }
      refresh();
      return fail(error.message);
    }
    if (error instanceof WriterError) return fail(error.message);
    return failFrom(error);
  }
}

export async function disconnectGmail(): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const refreshToken = await removeConnection(user.id);
    if (refreshToken) await revokeToken(refreshToken);
    refresh();
    return ok(undefined);
  } catch (error) {
    return failFrom(error);
  }
}
