import "server-only";

import { runPrompt } from "@/lib/ai/run";
import { companyBriefPrompt, personBriefPrompt } from "@/lib/ai/prompts";
import {
  companyBriefSchema,
  personBriefSchema,
  type BriefSource,
  type CompanyBrief,
  type PersonBrief,
} from "@/lib/ai/schemas/research";
import { readAngles } from "@/lib/discovery/view";
import { DAY, withProviderCache } from "@/lib/providers/cache";
import {
  getEmailFinders,
  getEmailVerifier,
  type EmailVerificationStatus,
} from "@/lib/providers/email";
import {
  getResearchProvider,
  type ResearchResult,
} from "@/lib/providers/research";
import { createClient } from "@/lib/supabase/server";
import { recordUsage } from "@/lib/usage/record";
import type { Json } from "@/types/database";

import { findEmailWaterfall } from "./waterfall";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const COMPANY_BRIEF_TTL = 14 * DAY;
const PERSON_BRIEF_TTL = 14 * DAY;

export class EnrichmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnrichmentError";
  }
}

async function loadPerson(supabase: Supabase, personId: string) {
  const { data } = await supabase
    .from("people")
    .select(
      "id, full_name, first_name, last_name, title, role_type, relevance_reason, connection_angles, email, email_status, source, provider_person_id, do_not_contact, is_sample, target_id, company_id, company:companies(name, domain), target:targets(role_title, team, job_summary)",
    )
    .eq("id", personId)
    .maybeSingle();
  if (!data?.company)
    throw new EnrichmentError("That person no longer exists.");
  return data;
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

export interface EmailOutcome {
  email: string | null;
  status: EmailVerificationStatus | "not_found";
  provider: string | null;
}

async function verify(
  userId: string,
  email: string,
): Promise<{ status: EmailVerificationStatus; provider: string | null }> {
  const verifier = getEmailVerifier();
  if (!verifier) return { status: "unknown", provider: null };
  const { value, hit } = await withProviderCache(
    {
      provider: verifier.name,
      operation: "email_verify",
      input: { email },
      ttlMs: 30 * DAY,
    },
    () => verifier.verifyEmail(email),
  );
  await recordUsage({
    userId,
    provider: verifier.name,
    operation: "email_verify",
    isMock: verifier.name === "mock",
    cacheHit: hit,
  });
  return { status: value.status, provider: verifier.name };
}

/** Find (if needed) and verify a person's email, and save the result. */
export async function enrichEmail(
  userId: string,
  personId: string,
): Promise<EmailOutcome> {
  const supabase = await createClient();
  const person = await loadPerson(supabase, personId);
  if (person.do_not_contact)
    throw new EnrichmentError("This person is marked do-not-contact.");

  // A valid address does not need another lookup.
  if (person.email && person.email_status === "valid") {
    return { email: person.email, status: "valid", provider: null };
  }

  // An address we already have (typed in by the user) only needs verifying.
  if (person.email) {
    const result = await verify(userId, person.email);
    await supabase
      .from("people")
      .update({
        email_status: result.status,
        email_checked_at: new Date().toISOString(),
      })
      .eq("id", personId);
    return {
      email: person.email,
      status: result.status,
      provider: result.provider,
    };
  }

  const finders = getEmailFinders();
  const input = {
    firstName:
      person.first_name ?? person.full_name.split(" ")[0] ?? person.full_name,
    lastName:
      person.last_name ??
      (person.full_name.split(" ").slice(1).join(" ") || null),
    companyDomain: person.company?.domain ?? null,
    companyName: person.company?.name ?? "",
    providerPersonId: person.provider_person_id,
    source: person.source,
  };
  const isMock = finders.every((finder) => finder.name === "mock");
  const { value: waterfall, hit } = await withProviderCache(
    {
      provider: isMock
        ? "mock"
        : `email-waterfall:${finders.map((finder) => finder.name).join("+")}`,
      operation: "email_find",
      input,
      ttlMs: 30 * DAY,
      shouldCache: (result) =>
        result.attempts.every((attempt) => attempt.outcome !== "error"),
    },
    () => findEmailWaterfall(finders, input),
  );
  for (const attempt of waterfall.attempts) {
    if (attempt.outcome === "skipped") continue;
    await recordUsage({
      userId,
      provider: attempt.provider,
      operation: "email_find",
      isMock,
      cacheHit: hit,
      metadata: {
        outcome: attempt.outcome,
        ...(attempt.error ? { error: attempt.error } : {}),
      },
    });
  }

  const found = waterfall.found;
  if (!found) {
    const errors = waterfall.attempts.filter(
      (attempt) => attempt.outcome === "error",
    );
    await supabase
      .from("people")
      .update({
        email_status: "not_found",
        email_checked_at: new Date().toISOString(),
        enrichment_error: errors.length
          ? errors
              .map((attempt) => attempt.error)
              .join(" ")
              .slice(0, 300)
          : null,
      })
      .eq("id", personId);
    if (
      errors.length &&
      errors.length ===
        waterfall.attempts.filter((a) => a.outcome !== "skipped").length
    ) {
      throw new EnrichmentError(
        errors[0]?.error ?? "Email providers are unavailable.",
      );
    }
    return { email: null, status: "not_found", provider: null };
  }

  const verification =
    found.verification ?? (await verify(userId, found.email)).status;
  const revealedLastName =
    found.lastName && !found.lastName.includes("*") ? found.lastName : null;
  await supabase
    .from("people")
    .update({
      email: found.email,
      email_source: found.provider,
      email_confidence: found.confidence,
      email_status: verification,
      email_checked_at: new Date().toISOString(),
      email_risk_accepted_at: null,
      enrichment_error: null,
      ...(revealedLastName
        ? {
            last_name: revealedLastName,
            full_name: `${input.firstName} ${revealedLastName}`,
          }
        : {}),
    })
    .eq("id", personId);

  return { email: found.email, status: verification, provider: found.provider };
}

// ---------------------------------------------------------------------------
// Research
// ---------------------------------------------------------------------------

async function search(
  userId: string,
  query: string,
  recencyDays?: number,
): Promise<ResearchResult[]> {
  const provider = getResearchProvider();
  const { value, hit } = await withProviderCache(
    {
      provider: provider.name,
      operation: "search",
      input: { query, recencyDays },
      ttlMs: 3 * DAY,
    },
    () => provider.search({ query, maxResults: 5, recencyDays }),
  );
  await recordUsage({
    userId,
    provider: provider.name,
    operation: "search",
    isMock: provider.name === "mock",
    cacheHit: hit,
  });
  return value;
}

/** The company's research brief: reused for everyone at that company until it expires. */
export async function getCompanyBrief(
  userId: string,
  person: Awaited<ReturnType<typeof loadPerson>>,
  options: { force?: boolean } = {},
): Promise<CompanyBrief> {
  const supabase = await createClient();
  if (!options.force) {
    const { data: existing } = await supabase
      .from("research_briefs")
      .select("content, expires_at")
      .eq("company_id", person.company_id)
      .eq("scope", "company")
      .maybeSingle();
    const parsed = companyBriefSchema.safeParse(existing?.content);
    if (
      parsed.success &&
      existing?.expires_at &&
      new Date(existing.expires_at).getTime() > Date.now()
    ) {
      return parsed.data;
    }
  }

  const company = person.company!;
  const focus = [person.target?.team, person.target?.role_title]
    .filter(Boolean)
    .join(" ");
  const [news, team] = await Promise.all([
    search(
      userId,
      `"${company.name}" ${company.domain ?? ""} news`.trim(),
      180,
    ),
    focus
      ? search(userId, `"${company.name}" ${focus} team`)
      : Promise.resolve([]),
  ]);
  const results = dedupeResults([...news, ...team]).slice(0, 8);

  const brief = await runPrompt(
    companyBriefPrompt,
    {
      company: company.name,
      domain: company.domain,
      role: person.target?.role_title ?? null,
      team: person.target?.team ?? null,
      jobSummary: person.target?.job_summary ?? null,
      results,
    },
    { userId },
  );

  // Keep only links the brief can point to: never a URL the AI made up.
  const allowed = new Set(results.map((result) => result.url));
  const content: CompanyBrief = {
    ...brief.output,
    recent_news: brief.output.recent_news.filter((item) =>
      allowed.has(item.url),
    ),
  };
  const sources: BriefSource[] = results.map((result) => ({
    title: result.title,
    url: result.url,
    publishedAt: result.publishedAt,
  }));

  await supabase
    .from("research_briefs")
    .delete()
    .eq("company_id", person.company_id)
    .eq("scope", "company");
  await supabase.from("research_briefs").insert({
    scope: "company",
    company_id: person.company_id,
    content: content as unknown as NonNullable<Json>,
    sources: sources as unknown as NonNullable<Json>,
    model: brief.model,
    prompt_id: brief.promptId,
    prompt_version: brief.promptVersion,
    is_sample: brief.isSample || getResearchProvider().name === "mock",
    expires_at: new Date(Date.now() + COMPANY_BRIEF_TTL).toISOString(),
  });
  return content;
}

function dedupeResults(results: ResearchResult[]): ResearchResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = result.url.replace(/[#?].*$/, "").replace(/\/$/, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Build (or rebuild) the research brief for one person. */
export async function buildPersonBrief(
  userId: string,
  personId: string,
  options: { force?: boolean } = {},
): Promise<{ company: CompanyBrief; person: PersonBrief }> {
  const supabase = await createClient();
  const person = await loadPerson(supabase, personId);

  if (!options.force) {
    const { data: existing } = await supabase
      .from("research_briefs")
      .select("content, expires_at")
      .eq("person_id", personId)
      .eq("scope", "person")
      .maybeSingle();
    const parsedPerson = personBriefSchema.safeParse(existing?.content);
    if (
      parsedPerson.success &&
      existing?.expires_at &&
      new Date(existing.expires_at).getTime() > Date.now()
    ) {
      return {
        company: await getCompanyBrief(userId, person),
        person: parsedPerson.data,
      };
    }
  }

  const company = await getCompanyBrief(userId, person, options);
  const { data: profile } = await supabase
    .from("profiles")
    .select("headline, positioning_statement")
    .eq("id", userId)
    .maybeSingle();

  const brief = await runPrompt(
    personBriefPrompt,
    {
      person: {
        name: person.full_name,
        title: person.title,
        roleType: person.role_type,
        reason: person.relevance_reason,
      },
      angles: readAngles(person.connection_angles),
      target: {
        company: person.company!.name,
        role: person.target?.role_title ?? null,
        team: person.target?.team ?? null,
      },
      company,
      user: {
        headline: profile?.headline ?? null,
        positioning: profile?.positioning_statement ?? null,
      },
    },
    { userId },
  );

  await supabase
    .from("research_briefs")
    .delete()
    .eq("person_id", personId)
    .eq("scope", "person");
  await supabase.from("research_briefs").insert({
    scope: "person",
    company_id: person.company_id,
    person_id: personId,
    content: brief.output as unknown as NonNullable<Json>,
    model: brief.model,
    prompt_id: brief.promptId,
    prompt_version: brief.promptVersion,
    is_sample: brief.isSample,
    expires_at: new Date(Date.now() + PERSON_BRIEF_TTL).toISOString(),
  });
  return { company, person: brief.output };
}

/** Email + research for one person, tracking progress on the person row. */
export async function enrichPerson(
  userId: string,
  personId: string,
  options: { research?: boolean; force?: boolean } = {},
): Promise<{ email: EmailOutcome }> {
  const supabase = await createClient();
  await supabase
    .from("people")
    .update({ enrichment_status: "running", enrichment_error: null })
    .eq("id", personId);
  try {
    const email = await enrichEmail(userId, personId);
    if (options.research !== false)
      await buildPersonBrief(userId, personId, { force: options.force });
    await supabase
      .from("people")
      .update({ enrichment_status: "done" })
      .eq("id", personId);
    return { email };
  } catch (error) {
    const message =
      error instanceof EnrichmentError ||
      (error instanceof Error &&
        ["AiError", "ProviderError"].includes(error.name))
        ? error.message
        : "Something went wrong while looking this person up.";
    await supabase
      .from("people")
      .update({
        enrichment_status: "failed",
        enrichment_error: message.slice(0, 300),
      })
      .eq("id", personId);
    throw new EnrichmentError(message);
  }
}
