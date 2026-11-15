"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { runPrompt } from "@/lib/ai/run";
import {
  positioningPrompt,
  resumeParsePrompt,
  storyQuestionsPrompt,
} from "@/lib/ai/prompts";
import { parsedResumeSchema, type ParsedResume } from "@/lib/ai/schemas/resume";
import type { Positioning, StoryQuestions } from "@/lib/ai/schemas/story";
import { getProfile, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  RESUME_MAX_BYTES,
  positioningStatementSchema,
  profileFormSchema,
  sendingLimitSchema,
  storyAnswersSchema,
  toneFormSchema,
} from "@/lib/validation/profile";
import type { Json } from "@/types/database";

import { fail, failFrom, ok, type ActionResult } from "./result";

function storedResume(value: Json | null | undefined): ParsedResume | null {
  const parsed = parsedResumeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function preferences(value: Json | null | undefined): Record<string, Json> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Json>)
    : {};
}

/**
 * Read the resume the browser just uploaded to private storage, let the AI
 * extract it, and store the result on the profile.
 */
export async function parseResume(input: {
  path: string;
  fileName: string;
}): Promise<ActionResult<{ resume: ParsedResume; isSample: boolean }>> {
  try {
    const user = await requireUser();
    // The path must be inside the user's own folder; storage RLS enforces this too.
    if (!input.path.startsWith(`${user.id}/`) || input.path.includes("..")) {
      return fail("That file does not belong to you.");
    }

    const supabase = await createClient();
    const { data: file, error } = await supabase.storage
      .from("resumes")
      .download(input.path);
    if (error || !file)
      return fail(
        "We could not read the uploaded file. Please upload it again.",
      );
    if (file.size > RESUME_MAX_BYTES)
      return fail("The resume must be 5 MB or smaller.");

    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") {
      return fail("That file is not a PDF.");
    }

    const result = await runPrompt(
      resumeParsePrompt,
      {
        pdfBase64: bytes.toString("base64"),
        fileName: input.fileName.slice(0, 200),
      },
      { userId: user.id },
    );

    const profile = await getProfile();
    const resume = result.output;
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        resume_path: input.path,
        resume_file_name: input.fileName.slice(0, 200),
        resume_parsed: resume as unknown as Json,
        resume_parsed_at: new Date().toISOString(),
        // Only fill blanks, never overwrite what the user already set.
        full_name: profile?.full_name ?? resume.full_name,
        headline: profile?.headline ?? resume.headline,
        location: profile?.location ?? resume.location,
        target_roles: profile?.target_roles.length
          ? profile.target_roles
          : resume.suggested_target_roles.slice(0, 4),
        preferences: {
          ...preferences(profile?.preferences),
          resume_is_sample: result.isSample,
        },
      })
      .eq("id", user.id);
    if (updateError)
      return fail(
        "We read your resume but could not save it. Please try again.",
      );

    return ok({ resume, isSample: result.isSample });
  } catch (error) {
    return failFrom(error);
  }
}

export async function saveProfile(values: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = profileFormSchema.parse(values);
    const profile = await getProfile();
    const previous = storedResume(profile?.resume_parsed);

    const resume: ParsedResume = {
      full_name: parsed.full_name,
      headline: parsed.headline,
      location: parsed.location,
      email: previous?.email ?? null,
      summary: parsed.summary,
      skills: parsed.skills,
      experience: parsed.experience,
      education: parsed.education,
      links: previous?.links ?? [],
      suggested_target_roles: previous?.suggested_target_roles ?? [],
    };

    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: parsed.full_name,
        headline: parsed.headline,
        location: parsed.location,
        timezone: parsed.timezone,
        target_roles: parsed.target_roles,
        resume_parsed: resume as unknown as Json,
      })
      .eq("id", user.id);
    if (error) return fail("Could not save your profile. Please try again.");

    refresh();
    return ok(undefined);
  } catch (error) {
    return failFrom(error);
  }
}

export async function getStoryQuestions(): Promise<
  ActionResult<StoryQuestions & { isSample: boolean }>
> {
  try {
    const user = await requireUser();
    const profile = await getProfile();
    const result = await runPrompt(
      storyQuestionsPrompt,
      {
        resume: storedResume(profile?.resume_parsed),
        targetRoles: profile?.target_roles ?? [],
      },
      { userId: user.id },
    );
    return ok({ ...result.output, isSample: result.isSample });
  } catch (error) {
    return failFrom(error);
  }
}

export async function generatePositioning(
  answers: unknown,
): Promise<ActionResult<Positioning & { isSample: boolean }>> {
  try {
    const user = await requireUser();
    const parsedAnswers = storyAnswersSchema.parse(answers);
    const profile = await getProfile();

    const result = await runPrompt(
      positioningPrompt,
      {
        resume: storedResume(profile?.resume_parsed),
        targetRoles: profile?.target_roles ?? [],
        answers: parsedAnswers,
      },
      { userId: user.id },
    );

    const supabase = await createClient();
    await supabase
      .from("profiles")
      .update({ story_answers: parsedAnswers as unknown as NonNullable<Json> })
      .eq("id", user.id);

    return ok({ ...result.output, isSample: result.isSample });
  } catch (error) {
    return failFrom(error);
  }
}

export async function savePositioning(
  statement: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = positioningStatementSchema.parse(statement);
    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ positioning_statement: parsed })
      .eq("id", user.id);
    if (error) return fail("Could not save your statement. Please try again.");
    refresh();
    return ok(undefined);
  } catch (error) {
    return failFrom(error);
  }
}

export async function saveTone(values: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = toneFormSchema.parse(values);
    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ tone: parsed.tone, writing_sample: parsed.writing_sample })
      .eq("id", user.id);
    if (error) return fail("Could not save your tone. Please try again.");
    refresh();
    return ok(undefined);
  } catch (error) {
    return failFrom(error);
  }
}

export async function saveSendingLimit(value: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const cap = sendingLimitSchema.parse(value);
    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ daily_send_cap: cap })
      .eq("id", user.id);
    if (error) return fail("Could not save your sending limit.");
    refresh();
    return ok(undefined);
  } catch (error) {
    return failFrom(error);
  }
}

export async function completeOnboarding(): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", user.id);
  redirect("/today");
}
