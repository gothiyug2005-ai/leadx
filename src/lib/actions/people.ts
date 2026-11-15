"use server";

import { refresh } from "next/cache";

import { requireUser } from "@/lib/auth";
import {
  DiscoveryError,
  discoverPeople,
  type DiscoveryResult,
} from "@/lib/discovery/run";
import { createClient } from "@/lib/supabase/server";
import { manualPersonSchema } from "@/lib/validation/person";
import { uuidSchema } from "@/lib/validation/target";

import { fail, failFrom, ok, type ActionResult } from "./result";

export async function findPeople(
  targetId: unknown,
): Promise<ActionResult<DiscoveryResult>> {
  try {
    const user = await requireUser();
    const id = uuidSchema.parse(targetId);
    const result = await discoverPeople(user.id, id);
    refresh();
    return ok(result);
  } catch (error) {
    if (error instanceof DiscoveryError) {
      refresh();
      return fail(error.message);
    }
    return failFrom(error);
  }
}

export async function addPerson(
  targetId: unknown,
  values: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireUser();
    const id = uuidSchema.parse(targetId);
    const parsed = manualPersonSchema.parse(values);
    const supabase = await createClient();

    const { data: target } = await supabase
      .from("targets")
      .select("company_id")
      .eq("id", id)
      .maybeSingle();
    if (!target) return fail("That target no longer exists.");

    const [first, ...rest] = parsed.full_name.split(/\s+/);
    const { data, error } = await supabase
      .from("people")
      .insert({
        target_id: id,
        company_id: target.company_id,
        full_name: parsed.full_name,
        first_name: first ?? null,
        last_name: rest.join(" ") || null,
        title: parsed.title,
        email: parsed.email,
        // An address typed in by hand still has to be verified before sending.
        email_status: "unknown",
        email_source: parsed.email ? "manual" : null,
        linkedin_url: parsed.linkedin_url,
        role_type: parsed.role_type,
        notes: parsed.notes,
        source: "manual",
        relevance_reason: "You added this person yourself.",
      })
      .select("id")
      .single();
    if (error || !data)
      return fail("Could not add this person. Please try again.");

    refresh();
    return ok({ id: data.id });
  } catch (error) {
    return failFrom(error);
  }
}

export async function setRecommended(
  personId: unknown,
  value: unknown,
): Promise<ActionResult> {
  try {
    await requireUser();
    const supabase = await createClient();
    const { error } = await supabase
      .from("people")
      .update({ is_recommended: value === true })
      .eq("id", uuidSchema.parse(personId));
    if (error) return fail("Could not update this person.");
    refresh();
    return ok(undefined);
  } catch (error) {
    return failFrom(error);
  }
}

/**
 * "Never email again": marks the person do-not-contact and, if we know their
 * address, adds it to the suppression list so no target can email it again.
 */
export async function neverContact(personId: unknown): Promise<ActionResult> {
  try {
    await requireUser();
    const id = uuidSchema.parse(personId);
    const supabase = await createClient();
    const { data: person, error } = await supabase
      .from("people")
      .update({ do_not_contact: true, is_recommended: false })
      .eq("id", id)
      .select("email")
      .single();
    if (error || !person) return fail("Could not update this person.");

    if (person.email) {
      await supabase
        .from("suppressions")
        .upsert(
          { email: person.email, reason: "manual" },
          { onConflict: "user_id,email", ignoreDuplicates: true },
        );
    }
    // Cancel anything that was waiting to go out to them.
    await supabase
      .from("messages")
      .update({ status: "cancelled" })
      .eq("person_id", id)
      .in("status", ["draft", "scheduled"]);
    refresh();
    return ok(undefined);
  } catch (error) {
    return failFrom(error);
  }
}

export async function removePerson(personId: unknown): Promise<ActionResult> {
  try {
    await requireUser();
    const supabase = await createClient();
    const { error } = await supabase
      .from("people")
      .delete()
      .eq("id", uuidSchema.parse(personId));
    if (error) return fail("Could not remove this person.");
    refresh();
    return ok(undefined);
  } catch (error) {
    return failFrom(error);
  }
}
