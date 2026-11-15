"use server";

import { refresh } from "next/cache";

import { requireUser } from "@/lib/auth";
import {
  EnrichmentError,
  buildPersonBrief,
  enrichEmail,
  enrichPerson,
} from "@/lib/enrichment/run";
import { createClient } from "@/lib/supabase/server";
import { manualPersonSchema } from "@/lib/validation/person";
import { uuidSchema } from "@/lib/validation/target";

import { fail, failFrom, ok, type ActionResult } from "./result";

function enrichmentFailure(error: unknown) {
  if (error instanceof EnrichmentError) return fail(error.message);
  return failFrom(error);
}

/** Find and verify the email, then build the research brief. */
export async function enrichPersonAction(
  personId: unknown,
): Promise<ActionResult<{ email: string | null; status: string }>> {
  try {
    const user = await requireUser();
    const result = await enrichPerson(user.id, uuidSchema.parse(personId));
    refresh();
    return ok({ email: result.email.email, status: result.email.status });
  } catch (error) {
    refresh();
    return enrichmentFailure(error);
  }
}

export async function findEmailAction(
  personId: unknown,
): Promise<ActionResult<{ email: string | null; status: string }>> {
  try {
    const user = await requireUser();
    const result = await enrichEmail(user.id, uuidSchema.parse(personId));
    refresh();
    return ok({ email: result.email, status: result.status });
  } catch (error) {
    return enrichmentFailure(error);
  }
}

export async function refreshResearch(
  personId: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await buildPersonBrief(user.id, uuidSchema.parse(personId), {
      force: true,
    });
    refresh();
    return ok(undefined);
  } catch (error) {
    return enrichmentFailure(error);
  }
}

/** Find emails and research for every top pick on a target that still needs it. */
export async function enrichTopPicks(
  targetId: unknown,
): Promise<ActionResult<{ processed: number; found: number; failed: number }>> {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { data: people } = await supabase
      .from("people")
      .select("id, email_status")
      .eq("target_id", uuidSchema.parse(targetId))
      .eq("is_recommended", true)
      .eq("do_not_contact", false)
      .neq("email_status", "valid")
      .limit(5);

    let found = 0;
    let failed = 0;
    for (const person of people ?? []) {
      try {
        const result = await enrichPerson(user.id, person.id);
        if (result.email.email) found += 1;
      } catch {
        failed += 1;
      }
    }
    refresh();
    return ok({ processed: people?.length ?? 0, found, failed });
  } catch (error) {
    return failFrom(error);
  }
}

/** The user confirms they want to email an address that could not be fully verified. */
export async function acceptRiskyEmail(
  personId: unknown,
): Promise<ActionResult> {
  try {
    await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("people")
      .update({ email_risk_accepted_at: new Date().toISOString() })
      .eq("id", uuidSchema.parse(personId))
      .in("email_status", ["risky", "unknown"])
      .select("id");
    if (error || !data?.length)
      return fail("Only risky or unchecked addresses need confirming.");
    refresh();
    return ok(undefined);
  } catch (error) {
    return failFrom(error);
  }
}

/** Replace the address by hand. It is verified again before it can be used. */
export async function setEmail(
  personId: unknown,
  email: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const id = uuidSchema.parse(personId);
    const parsed = manualPersonSchema.shape.email.parse(email);
    const supabase = await createClient();
    const { error } = await supabase
      .from("people")
      .update({
        email: parsed,
        email_source: parsed ? "manual" : null,
        email_status: "unknown",
        email_confidence: null,
        email_risk_accepted_at: null,
        email_checked_at: null,
      })
      .eq("id", id);
    if (error) return fail("Could not save this address.");
    if (parsed) await enrichEmail(user.id, id).catch(() => undefined);
    refresh();
    return ok(undefined);
  } catch (error) {
    return enrichmentFailure(error);
  }
}
