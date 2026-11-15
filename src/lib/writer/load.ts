import "server-only";

import {
  companyBriefSchema,
  personBriefSchema,
} from "@/lib/ai/schemas/research";
import { parsedResumeSchema } from "@/lib/ai/schemas/resume";
import { readAngles } from "@/lib/discovery/view";
import { createClient } from "@/lib/supabase/server";

import type { WriterContext } from "./context";
import type { MessageType } from "./rules";

const TONES = new Set(["formal", "warm", "concise"]);

export class WriterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WriterError";
  }
}

/** Gather everything the writer may use for one person. RLS keeps it to the user's own data. */
export async function loadWriterContext(
  userId: string,
  personId: string,
  type: MessageType,
) {
  const supabase = await createClient();
  const [{ data: person }, { data: profile }, { data: briefs }] =
    await Promise.all([
      supabase
        .from("people")
        .select(
          "id, full_name, first_name, title, role_type, connection_angles, do_not_contact, target_id, company_id, company:companies(name), target:targets(role_title, team, must_have_skills, job_summary)",
        )
        .eq("id", personId)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select(
          "full_name, headline, positioning_statement, tone, writing_sample, resume_parsed, story_answers",
        )
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("research_briefs")
        .select("scope, content, person_id, company_id")
        .or(`person_id.eq.${personId},scope.eq.company`),
    ]);
  if (!person?.company) throw new WriterError("That person no longer exists.");
  if (person.do_not_contact)
    throw new WriterError("This person is marked do-not-contact.");

  const resume = parsedResumeSchema.safeParse(profile?.resume_parsed);
  const companyBrief = companyBriefSchema.safeParse(
    briefs?.find(
      (row) => row.scope === "company" && row.company_id === person.company_id,
    )?.content,
  );
  const personBrief = personBriefSchema.safeParse(
    briefs?.find((row) => row.scope === "person" && row.person_id === personId)
      ?.content,
  );

  const { data: previous } =
    type === "follow_up"
      ? await supabase
          .from("messages")
          .select("subject, body")
          .eq("person_id", personId)
          .eq("channel", "email")
          .in("status", ["sent", "scheduled"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

  const answers = Array.isArray(profile?.story_answers)
    ? (profile.story_answers as { answer?: unknown }[])
        .map((entry) => (typeof entry?.answer === "string" ? entry.answer : ""))
        .filter(Boolean)
    : [];
  const fullName = profile?.full_name ?? "Me";

  const context: WriterContext = {
    type,
    sender: {
      fullName,
      firstName: fullName.split(" ")[0] ?? fullName,
      headline: profile?.headline ?? null,
      positioning: profile?.positioning_statement ?? null,
      tone: TONES.has(profile?.tone ?? "")
        ? (profile!.tone as WriterContext["sender"]["tone"])
        : "warm",
      writingSample: profile?.writing_sample ?? null,
      skills: resume.success ? resume.data.skills : [],
      highlights: resume.success
        ? resume.data.experience.flatMap((job) => job.highlights).slice(0, 8)
        : [],
      storyAnswers: answers,
    },
    recipient: {
      firstName:
        person.first_name ?? person.full_name.split(" ")[0] ?? person.full_name,
      fullName: person.full_name,
      title: person.title,
      roleType: person.role_type,
    },
    target: {
      company: person.company.name,
      role: person.target?.role_title ?? null,
      team: person.target?.team ?? null,
      skills: person.target?.must_have_skills ?? [],
      summary: person.target?.job_summary ?? null,
    },
    angles: readAngles(person.connection_angles),
    brief:
      personBrief.success || companyBrief.success
        ? {
            bestHook: personBrief.success ? personBrief.data.best_hook : null,
            talkingPoints: personBrief.success
              ? personBrief.data.talking_points
              : [],
            avoid: personBrief.success ? personBrief.data.avoid : [],
            news: companyBrief.success
              ? companyBrief.data.recent_news.map((item) => item.headline)
              : [],
            teamFocus: companyBrief.success
              ? companyBrief.data.team_focus
              : null,
          }
        : null,
    previous: previous
      ? { subject: previous.subject, body: previous.body }
      : null,
  };

  return { context, person: { id: person.id, targetId: person.target_id } };
}
