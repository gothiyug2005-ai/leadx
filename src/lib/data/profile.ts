import "server-only";

import { parsedResumeSchema } from "@/lib/ai/schemas/resume";
import type { StoryAnswer } from "@/lib/ai/schemas/story";
import type { Profile } from "@/lib/auth";
import { safeTimeZone } from "@/lib/dates";
import { TONES, type Tone } from "@/lib/validation/profile";

/** Turn a profile row into the plain, validated shape the profile forms use. */
export function toProfileView(profile: Profile) {
  const resume = parsedResumeSchema.safeParse(profile.resume_parsed);
  const prefs =
    profile.preferences &&
    typeof profile.preferences === "object" &&
    !Array.isArray(profile.preferences)
      ? (profile.preferences as Record<string, unknown>)
      : {};
  const answers = Array.isArray(profile.story_answers)
    ? (profile.story_answers as unknown[]).filter(
        (entry): entry is StoryAnswer =>
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as StoryAnswer).id === "string" &&
          typeof (entry as StoryAnswer).question === "string" &&
          typeof (entry as StoryAnswer).answer === "string",
      )
    : [];
  const tone: Tone = (TONES as readonly string[]).includes(profile.tone)
    ? (profile.tone as Tone)
    : "warm";

  return {
    form: {
      full_name: profile.full_name,
      headline: profile.headline,
      location: profile.location,
      timezone: safeTimeZone(profile.timezone),
      target_roles: profile.target_roles,
      resume: resume.success ? resume.data : null,
    },
    resumeFileName: profile.resume_file_name,
    resumeIsSample: prefs.resume_is_sample === true,
    storyAnswers: answers,
    positioning: profile.positioning_statement,
    tone,
    writingSample: profile.writing_sample,
    dailySendCap: profile.daily_send_cap,
  };
}
