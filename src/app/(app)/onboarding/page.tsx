import type { Metadata } from "next";
import { Suspense } from "react";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { Skeleton } from "@/components/ui/skeleton";
import { getProfile, requireUser } from "@/lib/auth";
import { toProfileView } from "@/lib/data/profile";

export const metadata: Metadata = { title: "Set up your profile" };

export default function OnboardingPage() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Suspense fallback={<OnboardingSkeleton />}>
        <Onboarding />
      </Suspense>
    </div>
  );
}

async function Onboarding() {
  const user = await requireUser();
  const profile = await getProfile();
  if (!profile) return <OnboardingSkeleton />;
  const view = toProfileView(profile);

  return (
    <OnboardingWizard
      initial={{
        userId: user.id,
        profile: view.form,
        resumeFileName: view.resumeFileName,
        resumeIsSample: view.resumeIsSample,
        storyAnswers: view.storyAnswers,
        positioning: view.positioning,
        tone: view.tone,
        writingSample: view.writingSample,
      }}
    />
  );
}

function OnboardingSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-label="Loading">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-2 w-full" />
      <Skeleton className="h-56 w-full" />
    </div>
  );
}
