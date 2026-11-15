"use client";

import { ArrowLeft, Check } from "lucide-react";
import { useState, useTransition } from "react";

import {
  ProfileForm,
  type ProfileFormInitial,
} from "@/components/profile/profile-form";
import { ResumeUpload } from "@/components/profile/resume-upload";
import { SampleNotice } from "@/components/profile/sample-notice";
import { StoryHelper } from "@/components/profile/story-helper";
import { ToneForm } from "@/components/profile/tone-form";
import { Button } from "@/components/ui/button";
import { completeOnboarding } from "@/lib/actions/profile";
import type { ParsedResume } from "@/lib/ai/schemas/resume";
import type { StoryAnswer } from "@/lib/ai/schemas/story";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/validation/profile";

const STEPS = [
  {
    title: "Your resume",
    description: "Upload it and LeadX reads it for you.",
  },
  {
    title: "Check your profile",
    description: "Fix anything the AI got wrong.",
  },
  { title: "Your story", description: "A few questions, then a 2-line pitch." },
  { title: "Your tone", description: "How your messages should sound." },
] as const;

export interface OnboardingInitial {
  userId: string;
  profile: ProfileFormInitial;
  resumeFileName: string | null;
  resumeIsSample: boolean;
  storyAnswers: StoryAnswer[];
  positioning: string | null;
  tone: Tone;
  writingSample: string | null;
}

function firstStep(initial: OnboardingInitial): number {
  if (!initial.profile.resume) return 0;
  if (!initial.positioning) return 1;
  return 3;
}

export function OnboardingWizard({ initial }: { initial: OnboardingInitial }) {
  const [step, setStep] = useState(() => firstStep(initial));
  const [profile, setProfile] = useState(initial.profile);
  const [resumeIsSample, setResumeIsSample] = useState(initial.resumeIsSample);
  const [profileVersion, setProfileVersion] = useState(0);
  const [finishing, startFinishing] = useTransition();

  function onParsed(result: { resume: ParsedResume; isSample: boolean }) {
    const resume = result.resume;
    setProfile((current) => ({
      ...current,
      full_name: current.full_name ?? resume.full_name,
      headline: current.headline ?? resume.headline,
      location: current.location ?? resume.location,
      target_roles: current.target_roles.length
        ? current.target_roles
        : resume.suggested_target_roles.slice(0, 4),
      resume,
    }));
    setResumeIsSample(result.isSample);
    setProfileVersion((version) => version + 1);
    setStep(1);
  }

  const current = STEPS[step] ?? STEPS[0];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="text-muted-foreground text-sm">
          Step {step + 1} of {STEPS.length}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {current.title}
        </h1>
        <p className="text-muted-foreground">{current.description}</p>
      </header>

      <ol className="grid grid-cols-4 gap-2" aria-label="Progress">
        {STEPS.map((item, index) => (
          <li key={item.title} className="flex flex-col gap-2">
            <span
              className={cn(
                "bg-muted h-1.5 rounded-full",
                index < step && "bg-primary",
                index === step && "bg-primary/60",
              )}
            />
            <span
              className={cn(
                "text-muted-foreground hidden text-xs sm:flex sm:items-center sm:gap-1",
                index === step && "text-foreground font-medium",
              )}
            >
              {index < step ? <Check className="size-3" aria-hidden /> : null}
              {item.title}
              <span className="sr-only">
                {index < step ? " (done)" : index === step ? " (current)" : ""}
              </span>
            </span>
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <div className="flex flex-col gap-4">
          <ResumeUpload
            userId={initial.userId}
            currentFileName={initial.resumeFileName}
            onParsed={onParsed}
          />
          <Button
            variant="link"
            className="self-start px-0"
            onClick={() => setStep(1)}
          >
            Skip, I&apos;ll fill in my profile myself
          </Button>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="flex flex-col gap-4">
          {resumeIsSample ? <SampleNotice /> : null}
          <ProfileForm
            key={profileVersion}
            initial={profile}
            submitLabel="Save and continue"
            onSaved={() => setStep(2)}
          />
        </div>
      ) : null}

      {step === 2 ? (
        <StoryHelper
          savedAnswers={initial.storyAnswers}
          savedStatement={initial.positioning}
          submitLabel="Save and continue"
          onSaved={() => setStep(3)}
        />
      ) : null}

      {step === 3 ? (
        <ToneForm
          initialTone={initial.tone}
          initialSample={initial.writingSample}
          submitLabel={finishing ? "Finishing…" : "Finish setup"}
          onSaved={() => startFinishing(() => completeOnboarding())}
        />
      ) : null}

      {step > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground self-start"
          onClick={() => setStep((value) => Math.max(0, value - 1))}
        >
          <ArrowLeft aria-hidden /> Back
        </Button>
      ) : null}
    </div>
  );
}
