"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { runPrompt } from "@/lib/ai/run";
import { jobExtractPrompt } from "@/lib/ai/prompts";
import type { JobExtraction } from "@/lib/ai/schemas/job";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  personTargetSchema,
  readPostingSchema,
  targetFormSchema,
  targetStatusSchema,
  uuidSchema,
} from "@/lib/validation/target";
import { normalizeDomain } from "@/lib/web/domain";
import { FetchPageError, fetchPageText } from "@/lib/web/fetch-page";

import { fail, failFrom, ok, type ActionResult } from "./result";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Reuse the user's existing company with the same domain (or name), otherwise create it. */
async function findOrCreateCompany(
  supabase: Supabase,
  input: { name: string; domain: string | null },
): Promise<string> {
  const lookup = input.domain
    ? supabase.from("companies").select("id").eq("domain", input.domain)
    : supabase
        .from("companies")
        .select("id")
        .ilike("name", input.name.replace(/[%_\\]/g, "\\$&"))
        .is("domain", null);
  const { data: existing } = await lookup.limit(1).maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("companies")
    .insert({ name: input.name, domain: input.domain })
    .select("id")
    .single();
  if (error || !data)
    throw new Error(`Could not save company: ${error?.message}`);
  return data.id;
}

export interface PostingReadResult {
  extraction: JobExtraction;
  text: string;
  url: string | null;
  isSample: boolean;
}

/** Read a job posting from a link or pasted text, and extract its details for review. */
export async function readJobPosting(input: {
  url?: string;
  text?: string;
}): Promise<ActionResult<PostingReadResult>> {
  try {
    const user = await requireUser();
    const parsed = readPostingSchema.parse(input);

    let text = parsed.text;
    let pageTitle: string | null = null;
    let url: string | null = parsed.url || null;

    if (!text && url) {
      try {
        const page = await fetchPageText(url);
        text = page.text;
        pageTitle = page.title;
        url = page.finalUrl;
      } catch (error) {
        if (error instanceof FetchPageError) return fail(error.message);
        throw error;
      }
    }

    const result = await runPrompt(
      jobExtractPrompt,
      { text: text.slice(0, 30000), url, pageTitle },
      { userId: user.id },
    );
    if (!result.output.is_job_posting) {
      return fail(
        "That does not look like a job posting. Check the link or paste the job description.",
      );
    }

    return ok({
      extraction: {
        ...result.output,
        company_domain: normalizeDomain(result.output.company_domain),
      },
      text: text.slice(0, 30000),
      url,
      isSample: result.isSample,
    });
  } catch (error) {
    return failFrom(error);
  }
}

export async function createTarget(
  values: unknown,
): Promise<ActionResult<{ id: string; existed: boolean }>> {
  try {
    await requireUser();
    const parsed = targetFormSchema.parse(values);
    const supabase = await createClient();
    const companyId = await findOrCreateCompany(supabase, {
      name: parsed.company_name,
      domain: parsed.company_domain,
    });

    // Don't create a second active target for the same role at the same company.
    let duplicate = supabase
      .from("targets")
      .select("id")
      .eq("company_id", companyId)
      .neq("status", "archived");
    duplicate = parsed.role_title
      ? duplicate.ilike("role_title", parsed.role_title)
      : duplicate.is("role_title", null);
    const { data: existing } = await duplicate.limit(1).maybeSingle();
    if (existing) return ok({ id: existing.id, existed: true });

    const { data, error } = await supabase
      .from("targets")
      .insert({
        company_id: companyId,
        kind: parsed.kind,
        role_title: parsed.role_title,
        team: parsed.team,
        seniority: parsed.seniority,
        location: parsed.location,
        must_have_skills: parsed.must_have_skills,
        nice_to_have_skills: parsed.nice_to_have_skills,
        job_url: parsed.job_url,
        job_text: parsed.job_text,
        job_summary: parsed.job_summary,
      })
      .select("id")
      .single();
    if (error || !data)
      return fail("Could not save this target. Please try again.");

    refresh();
    return ok({ id: data.id, existed: false });
  } catch (error) {
    return failFrom(error);
  }
}

/** A specific person the user wants to reach: creates the company, a target and the person. */
export async function createPersonTarget(
  values: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireUser();
    const parsed = personTargetSchema.parse(values);
    const supabase = await createClient();
    const companyId = await findOrCreateCompany(supabase, {
      name: parsed.company_name,
      domain: parsed.company_domain,
    });

    const { data: target, error } = await supabase
      .from("targets")
      .insert({
        company_id: companyId,
        kind: "person",
        role_title: parsed.role_title,
      })
      .select("id")
      .single();
    if (error || !target)
      return fail("Could not save this target. Please try again.");

    const [first, ...rest] = parsed.full_name.split(/\s+/);
    const { error: personError } = await supabase.from("people").insert({
      target_id: target.id,
      company_id: companyId,
      full_name: parsed.full_name,
      first_name: first ?? null,
      last_name: rest.join(" ") || null,
      title: parsed.title,
      linkedin_url: parsed.linkedin_url,
      notes: parsed.notes,
      source: "manual",
      is_recommended: true,
      relevance_reason: "You added this person yourself.",
    });
    if (personError) {
      await supabase.from("targets").delete().eq("id", target.id);
      return fail("Could not save this person. Please try again.");
    }

    refresh();
    return ok({ id: target.id });
  } catch (error) {
    return failFrom(error);
  }
}

export async function updateTarget(
  id: unknown,
  values: unknown,
): Promise<ActionResult> {
  try {
    await requireUser();
    const targetId = uuidSchema.parse(id);
    const parsed = targetFormSchema.parse(values);
    const supabase = await createClient();

    const { data: target } = await supabase
      .from("targets")
      .select("company_id")
      .eq("id", targetId)
      .maybeSingle();
    if (!target) return fail("That target no longer exists.");

    const { error: companyError } = await supabase
      .from("companies")
      .update({ name: parsed.company_name, domain: parsed.company_domain })
      .eq("id", target.company_id);
    if (companyError) {
      return fail(
        companyError.code === "23505"
          ? "You already have another company with that website."
          : "Could not save the company details.",
      );
    }

    const { error } = await supabase
      .from("targets")
      .update({
        role_title: parsed.role_title,
        team: parsed.team,
        seniority: parsed.seniority,
        location: parsed.location,
        must_have_skills: parsed.must_have_skills,
        nice_to_have_skills: parsed.nice_to_have_skills,
        job_url: parsed.job_url,
        job_summary: parsed.job_summary,
      })
      .eq("id", targetId);
    if (error) return fail("Could not save this target. Please try again.");

    refresh();
    return ok(undefined);
  } catch (error) {
    return failFrom(error);
  }
}

export async function setTargetStatus(
  id: unknown,
  status: unknown,
): Promise<ActionResult> {
  try {
    await requireUser();
    const supabase = await createClient();
    const { error } = await supabase
      .from("targets")
      .update({ status: targetStatusSchema.parse(status) })
      .eq("id", uuidSchema.parse(id));
    if (error) return fail("Could not update this target.");
    refresh();
    return ok(undefined);
  } catch (error) {
    return failFrom(error);
  }
}

export async function deleteTarget(id: unknown): Promise<void> {
  await requireUser();
  const parsed = uuidSchema.safeParse(id);
  if (parsed.success) {
    const supabase = await createClient();
    await supabase.from("targets").delete().eq("id", parsed.data);
  }
  // Make sure the list does not show the deleted target from the router cache.
  revalidatePath("/targets");
  redirect("/targets");
}
