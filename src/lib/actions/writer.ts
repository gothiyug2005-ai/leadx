"use server";

import { randomUUID } from "node:crypto";

import { refresh } from "next/cache";
import { z } from "zod";

import { runPrompt } from "@/lib/ai/run";
import { rewritePrompt, writeVariantsPrompt } from "@/lib/ai/prompts";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/target";
import { contextSourceText } from "@/lib/writer/context";
import { WriterError, loadWriterContext } from "@/lib/writer/load";
import { checkMessage } from "@/lib/writer/quality";
import { MESSAGE_TYPES, RULES } from "@/lib/writer/rules";
import type { Json } from "@/types/database";

import { fail, failFrom, ok, type ActionResult } from "./result";

const typeSchema = z.enum(MESSAGE_TYPES);
const draftSchema = z.object({
  subject: z.string().max(200).nullable(),
  body: z.string().max(5000),
});
const rewriteActionSchema = z.enum([
  "shorten",
  "warmer",
  "more_specific",
  "regenerate_paragraph",
]);

function writerFailure(error: unknown) {
  if (error instanceof WriterError) return fail(error.message);
  return failFrom(error);
}

/** Write 3 drafts with different angles for one person, replacing older unused drafts. */
export async function generateDrafts(
  personId: unknown,
  type: unknown,
): Promise<ActionResult<{ group: string }>> {
  try {
    const user = await requireUser();
    const id = uuidSchema.parse(personId);
    const messageType = typeSchema.parse(type);
    const { context, person } = await loadWriterContext(
      user.id,
      id,
      messageType,
    );

    const result = await runPrompt(writeVariantsPrompt, context, {
      userId: user.id,
    });
    const variants = result.output.variants.slice(0, 3);
    if (variants.length === 0)
      return fail("The writer returned no drafts. Please try again.");

    const supabase = await createClient();
    // Older drafts that were never sent or copied are retired, not deleted.
    await supabase
      .from("messages")
      .update({ status: "cancelled" })
      .eq("person_id", id)
      .eq("type", messageType)
      .eq("status", "draft");

    const rules = RULES[messageType];
    const source = contextSourceText(context);
    const group = randomUUID();
    // Stagger timestamps so the drafts always come back in the order they were written.
    const now = Date.now();
    const { error } = await supabase.from("messages").insert(
      variants.map((variant, index) => {
        const subject = rules.hasSubject
          ? (variant.subject?.trim() ?? null)
          : null;
        const body = variant.body.trim();
        return {
          person_id: person.id,
          target_id: person.targetId,
          channel: rules.channel,
          type: messageType,
          angle: variant.angle,
          variant_group: group,
          is_selected: index === 0,
          created_at: new Date(now + index).toISOString(),
          subject,
          body,
          status: "draft",
          quality: checkMessage({
            type: messageType,
            subject,
            body,
            sourceText: source,
          }) as unknown as NonNullable<Json>,
          model: result.model,
          prompt_id: result.promptId,
          prompt_version: result.promptVersion,
          is_sample: result.isSample,
        };
      }),
    );
    if (error) return fail("Could not save the drafts. Please try again.");

    refresh();
    return ok({ group });
  } catch (error) {
    return writerFailure(error);
  }
}

async function loadDraft(messageId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("id, person_id, type, subject, body, status, variant_group")
    .eq("id", messageId)
    .maybeSingle();
  if (!data) throw new WriterError("That draft no longer exists.");
  if (data.status !== "draft" && data.status !== "copied")
    throw new WriterError("This message has already been sent.");
  return { supabase, draft: data };
}

export async function selectDraft(messageId: unknown): Promise<ActionResult> {
  try {
    await requireUser();
    const { supabase, draft } = await loadDraft(uuidSchema.parse(messageId));
    await supabase
      .from("messages")
      .update({ is_selected: false })
      .eq("variant_group", draft.variant_group!);
    await supabase
      .from("messages")
      .update({ is_selected: true })
      .eq("id", draft.id);
    refresh();
    return ok(undefined);
  } catch (error) {
    return writerFailure(error);
  }
}

/** Save the user's edits and re-run the quality checks. */
export async function saveDraft(
  messageId: unknown,
  values: unknown,
): Promise<ActionResult<{ quality: unknown }>> {
  try {
    const user = await requireUser();
    const id = uuidSchema.parse(messageId);
    const parsed = draftSchema.parse(values);
    const { supabase, draft } = await loadDraft(id);
    const type = typeSchema.parse(draft.type);
    const { context } = await loadWriterContext(user.id, draft.person_id, type);

    const subject = RULES[type].hasSubject
      ? (parsed.subject?.trim() ?? null)
      : null;
    const body = parsed.body.trim();
    const quality = checkMessage({
      type,
      subject,
      body,
      sourceText: contextSourceText(context),
    });
    const { error } = await supabase
      .from("messages")
      .update({
        subject,
        body,
        quality: quality as unknown as NonNullable<Json>,
      })
      .eq("id", id);
    if (error) return fail("Could not save your edits.");
    refresh();
    return ok({ quality });
  } catch (error) {
    return writerFailure(error);
  }
}

/** Shorten, warm up, make more specific, or rewrite one paragraph. Saves the result. */
export async function rewriteDraft(
  messageId: unknown,
  action: unknown,
  values: unknown,
  paragraphIndex?: unknown,
): Promise<ActionResult<{ subject: string | null; body: string }>> {
  try {
    const user = await requireUser();
    const id = uuidSchema.parse(messageId);
    const parsedAction = rewriteActionSchema.parse(action);
    const current = draftSchema.parse(values);
    const index =
      typeof paragraphIndex === "number" && Number.isInteger(paragraphIndex)
        ? paragraphIndex
        : null;
    const { supabase, draft } = await loadDraft(id);
    const type = typeSchema.parse(draft.type);
    const { context } = await loadWriterContext(user.id, draft.person_id, type);

    const result = await runPrompt(
      rewritePrompt,
      { context, draft: current, action: parsedAction, paragraphIndex: index },
      { userId: user.id },
    );
    const subject = RULES[type].hasSubject
      ? result.output.subject?.trim() || current.subject
      : null;
    const body = result.output.body.trim();
    const quality = checkMessage({
      type,
      subject,
      body,
      sourceText: contextSourceText(context),
    });
    await supabase
      .from("messages")
      .update({
        subject,
        body,
        quality: quality as unknown as NonNullable<Json>,
        is_sample: result.isSample,
      })
      .eq("id", id);
    refresh();
    return ok({ subject, body });
  } catch (error) {
    return writerFailure(error);
  }
}

/** LinkedIn messages are never sent by LeadX: the user copies them and sends them themselves. */
export async function markCopied(
  messageId: unknown,
  values: unknown,
): Promise<ActionResult> {
  try {
    await requireUser();
    const id = uuidSchema.parse(messageId);
    const parsed = draftSchema.parse(values);
    const { supabase, draft } = await loadDraft(id);
    if (RULES[typeSchema.parse(draft.type)].channel !== "linkedin")
      return fail("Only LinkedIn messages are copied.");
    await supabase
      .from("messages")
      .update({ status: "copied", body: parsed.body.trim(), is_selected: true })
      .eq("id", id);
    refresh();
    return ok(undefined);
  } catch (error) {
    return writerFailure(error);
  }
}
