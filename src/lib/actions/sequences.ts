"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { stopSequence } from "@/lib/sequences/start";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/target";
import { checkMessage } from "@/lib/writer/quality";
import type { Json } from "@/types/database";

import { fail, failFrom, ok, type ActionResult } from "./result";

const followUpSchema = z.object({
  subject: z.string().trim().min(1, "Add a subject line.").max(200),
  body: z.string().trim().min(1, "The message is empty.").max(5000),
});

/** Edit a scheduled follow-up before it goes out. */
export async function editFollowUp(
  messageId: unknown,
  values: unknown,
): Promise<ActionResult> {
  try {
    await requireUser();
    const id = uuidSchema.parse(messageId);
    const parsed = followUpSchema.parse(values);
    const quality = checkMessage({
      type: "follow_up",
      subject: parsed.subject,
      body: parsed.body,
      sourceText: "",
    });
    if (quality.issues.some((issue) => issue.severity === "error")) {
      return fail(
        quality.issues.find((issue) => issue.severity === "error")!.message,
      );
    }
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("messages")
      .update({
        subject: parsed.subject,
        body: parsed.body,
        quality: quality as unknown as NonNullable<Json>,
      })
      .eq("id", id)
      .eq("status", "scheduled")
      .eq("type", "follow_up")
      .select("id");
    if (error || !data?.length)
      return fail("This follow-up can no longer be edited.");
    refresh();
    return ok(undefined);
  } catch (error) {
    return failFrom(error);
  }
}

export async function cancelFollowUp(
  messageId: unknown,
): Promise<ActionResult> {
  try {
    await requireUser();
    const supabase = await createClient();
    const { data } = await supabase
      .from("messages")
      .update({ status: "cancelled" })
      .eq("id", uuidSchema.parse(messageId))
      .eq("status", "scheduled")
      .select("id");
    if (!data?.length)
      return fail("This follow-up was already sent or cancelled.");
    refresh();
    return ok(undefined);
  } catch (error) {
    return failFrom(error);
  }
}

/** Stop all remaining follow-ups for this person. */
export async function stopFollowUps(
  sequenceId: unknown,
): Promise<ActionResult> {
  try {
    await requireUser();
    const id = uuidSchema.parse(sequenceId);
    const supabase = await createClient();
    // RLS confirms the sequence belongs to this user before the server-side stop.
    const { data } = await supabase
      .from("sequences")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (!data) return fail("That sequence no longer exists.");
    await stopSequence(id, "manual");
    refresh();
    return ok(undefined);
  } catch (error) {
    return failFrom(error);
  }
}
