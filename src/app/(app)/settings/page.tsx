import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { GmailCard, GmailResultToast } from "@/components/profile/gmail-card";
import { ProfileForm } from "@/components/profile/profile-form";
import { SampleNotice } from "@/components/profile/sample-notice";
import { SendingLimitForm } from "@/components/profile/sending-limit-form";
import { SettingsResume } from "@/components/profile/settings-resume";
import { StoryHelper } from "@/components/profile/story-helper";
import { ToneForm } from "@/components/profile/tone-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { isAiSampleMode } from "@/lib/ai/client";
import { getProfile, requireUser } from "@/lib/auth";
import { getGmailStatus } from "@/lib/data/gmail";
import { toProfileView } from "@/lib/data/profile";
import { getSetupStatus } from "@/lib/setup-status";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Your profile, story and tone shape every message LeadX writes.
        </p>
      </header>
      <Suspense fallback={<SettingsSkeleton />}>
        <Settings />
      </Suspense>
    </div>
  );
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-20">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

async function Settings() {
  const user = await requireUser();
  const profile = await getProfile();
  if (!profile) return <SettingsSkeleton />;
  const view = toProfileView(profile);
  const services = getSetupStatus().filter((group) => group.id !== "supabase");
  const aiSample = isAiSampleMode();
  const gmail = await getGmailStatus();

  return (
    <div className="flex flex-col gap-6">
      <Suspense>
        <GmailResultToast />
      </Suspense>
      {!profile.onboarding_completed_at ? (
        <Card className="flex-row items-center justify-between gap-4 px-6">
          <p className="text-sm">
            You have not finished setting up your profile yet.
          </p>
          <Button asChild size="sm">
            <Link href="/onboarding">Continue setup</Link>
          </Button>
        </Card>
      ) : null}

      <Section
        id="resume"
        title="Resume"
        description="Upload a new PDF and LeadX re-reads it. Only you can see it."
      >
        <div className="flex flex-col gap-3">
          {aiSample ? (
            <SampleNotice>
              The AI is not connected yet, so uploads produce a sample profile
              you can edit.
            </SampleNotice>
          ) : null}
          <SettingsResume userId={user.id} fileName={view.resumeFileName} />
        </div>
      </Section>

      <Section
        id="profile"
        title="Profile"
        description="What LeadX knows about you. It never invents anything beyond this."
      >
        <ProfileForm key={profile.updated_at} initial={view.form} />
      </Section>

      <Section
        id="story"
        title="Your story"
        description="Your 2-line positioning statement for outreach."
      >
        <StoryHelper
          savedAnswers={view.storyAnswers}
          savedStatement={view.positioning}
        />
      </Section>

      <Section
        id="tone"
        title="Writing tone"
        description="How your messages should sound."
      >
        <ToneForm initialTone={view.tone} initialSample={view.writingSample} />
      </Section>

      <Section
        id="gmail"
        title="Gmail"
        description="Send from your own address. Every email is reviewed by you before it goes out."
      >
        <GmailCard
          configured={gmail?.configured ?? false}
          connection={gmail?.connection ?? null}
        />
      </Section>

      <Section
        id="sending"
        title="Sending limit"
        description="LeadX never sends more than this many outreach emails in a day."
      >
        <SendingLimitForm initialCap={view.dailySendCap} />
      </Section>

      <Section
        id="services"
        title="Connected services"
        description="Services that are not connected use clearly labelled sample data."
      >
        <ul className="flex flex-col divide-y">
          {services.map((group) => {
            const connected = group.items.every((item) => item.isSet);
            return (
              <li
                key={group.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{group.title}</span>
                  <span className="text-muted-foreground text-xs">
                    {group.description}
                  </span>
                </div>
                <Badge variant={connected ? "secondary" : "outline"}>
                  {connected ? "Connected" : "Sample data"}
                </Badge>
              </li>
            );
          })}
        </ul>
        <p className="text-muted-foreground mt-4 text-xs">
          Gmail is connected per account in a later step. Keys are added in your
          hosting settings; see docs/SETUP.md.
        </p>
      </Section>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div
      className="flex flex-col gap-6"
      aria-busy
      aria-label="Loading settings"
    >
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} className="h-48 w-full" />
      ))}
    </div>
  );
}
