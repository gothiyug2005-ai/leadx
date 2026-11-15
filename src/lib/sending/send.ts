import "server-only";

import { markConnectionError } from "@/lib/gmail/connection";
import {
  MailError,
  getMailProvider,
  type MailProvider,
} from "@/lib/providers/mail";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export class SendError extends Error {
  constructor(
    readonly reason: string,
    message: string,
  ) {
    super(message);
    this.name = "SendError";
  }
}

/** Why the send gate refused, in words the user can act on. */
export function refusalMessage(
  reason: string,
  details: { cap?: number } = {},
): string {
  switch (reason) {
    case "daily_cap_reached":
      return `You have reached today's limit of ${details.cap ?? "your"} outreach emails. It resets at midnight your time.`;
    case "suppressed":
      return "This address is on your do-not-email list, so LeadX will not send to it.";
    case "do_not_contact":
      return "You asked LeadX never to email this person.";
    case "sample_data":
      return "This is a sample person, so only a simulated send is possible.";
    case "invalid_email":
      return "This address is invalid and would bounce.";
    case "unverified_email":
      return 'This address is not verified. Confirm it with "Use anyway" first.';
    case "missing_email":
      return "There is no email address for this person yet.";
    case "already_sent":
      return "This message has already been sent.";
    case "not_approved":
    case "not_queued":
      return "This message has not been approved for sending.";
    case "empty_body":
      return "The message is empty.";
    case "not_email":
      return "LinkedIn messages are never sent by LeadX.";
    default:
      return "LeadX could not send this message.";
  }
}

interface ClaimResult {
  allowed: boolean;
  reason?: string;
  event_id?: string;
  to_email?: string;
  cap?: number;
}

export interface DeliveryResult {
  simulated: boolean;
  to: string;
  threadId: string | null;
}

/**
 * Send one approved, queued message. Every rule (approval, daily cap, opt-outs,
 * risky addresses, sample data) is checked by the database's send gate first;
 * this function only talks to the mail provider after the gate says yes.
 */
export async function deliverMessage(
  userId: string,
  messageId: string,
  options: { provider?: MailProvider; replyTo?: string | null } = {},
): Promise<DeliveryResult> {
  const service = createServiceClient();
  const provider = options.provider ?? (await getMailProvider(userId));

  const { data: message } = await service
    .from("messages")
    .select("id, person_id, subject, body, type, gmail_thread_id, sequence_id")
    .eq("id", messageId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!message)
    throw new SendError("message_not_found", "That message no longer exists.");

  const { data: claimData, error: claimError } = await service.rpc(
    "claim_send_slot",
    {
      p_user_id: userId,
      p_message_id: messageId,
      p_provider: provider.name,
      p_reply_to_email: options.replyTo ?? undefined,
    },
  );
  if (claimError)
    throw new SendError(
      "gate_error",
      "LeadX could not check this send. Please try again.",
    );
  const claim = claimData as unknown as ClaimResult;
  if (!claim.allowed || !claim.event_id || !claim.to_email) {
    throw new SendError(
      claim.reason ?? "refused",
      refusalMessage(claim.reason ?? "refused", { cap: claim.cap }),
    );
  }

  const { data: profile } = await service
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();

  // A follow-up continues the thread of the first email.
  let inReplyTo: string | null = null;
  let threadId: string | null = message.gmail_thread_id;
  if (message.sequence_id && !threadId) {
    const { data: first } = await service
      .from("messages")
      .select("gmail_thread_id, rfc_message_id")
      .eq("sequence_id", message.sequence_id)
      .eq("status", "sent")
      .order("sent_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    threadId = first?.gmail_thread_id ?? null;
    inReplyTo = first?.rfc_message_id ?? null;
  }

  try {
    const sent = await provider.send({
      to: claim.to_email,
      subject: message.subject ?? "",
      body: message.body,
      fromName: profile?.full_name ?? null,
      threadId,
      inReplyTo,
    });

    const now = new Date().toISOString();
    await service
      .from("send_events")
      .update({ status: "sent" })
      .eq("id", claim.event_id);
    await service
      .from("messages")
      .update({
        status: "sent",
        sent_at: now,
        error: null,
        gmail_message_id: sent.messageId,
        gmail_thread_id: sent.threadId,
        rfc_message_id: sent.rfcMessageId,
      })
      .eq("id", messageId);

    const { data: person } = await service
      .from("people")
      .select("stage")
      .eq("id", message.person_id)
      .maybeSingle();
    if (person?.stage === "to_contact") {
      await service
        .from("people")
        .update({ stage: "contacted" })
        .eq("id", message.person_id);
    } else if (person?.stage === "contacted" && message.type === "follow_up") {
      await service
        .from("people")
        .update({ stage: "followed_up" })
        .eq("id", message.person_id);
    }

    return {
      simulated: provider.name === "mock",
      to: claim.to_email,
      threadId: sent.threadId,
    };
  } catch (error) {
    const text =
      error instanceof MailError
        ? error.message
        : "Sending failed. Please try again.";
    await service
      .from("send_events")
      .update({ status: "failed", error: text.slice(0, 300) })
      .eq("id", claim.event_id);
    await service
      .from("messages")
      .update({ status: "failed", error: text.slice(0, 300) })
      .eq("id", messageId);
    if (error instanceof MailError && error.code === "auth")
      await markConnectionError(userId, text);
    throw new SendError(
      error instanceof MailError ? error.code : "send_failed",
      text,
    );
  }
}

/** Put a refused message back into the user's hands as a draft. */
export async function returnToDraft(messageId: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("messages")
    .update({ status: "draft", approved_at: null, scheduled_at: null })
    .eq("id", messageId);
}
