import type { Metadata } from "next";
import { CircleAlert } from "lucide-react";
import { Suspense } from "react";

import {
  FollowUpsSection,
  GettingStarted,
  RepliesSection,
  ToContactSection,
} from "@/components/today/sections";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import { formatLongDate, greetingForHour } from "@/lib/dates";
import { getTodayData } from "@/lib/data/today";

export const metadata: Metadata = { title: "Today" };

export default function TodayPage() {
  return (
    <Suspense fallback={<TodaySkeleton />}>
      <Today />
    </Suspense>
  );
}

async function Today() {
  await requireUser();
  const data = await getTodayData();
  if (!data) return <TodaySkeleton />;

  const firstName = data.profile.full_name?.split(" ")[0];
  const isFirstRun =
    data.activeTargets === 0 || !data.profile.onboarding_completed_at;
  const hasWork =
    data.replies.length + data.followUps.length + data.toContact.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="text-muted-foreground text-sm">
          {formatLongDate(data.now, data.timeZone)}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {greetingForHour(data.day.hour)}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-muted-foreground">
          {hasWork
            ? "Here is what needs you today."
            : "You are all caught up. Here is how to line up your next conversations."}
        </p>
      </header>

      {data.hasError ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription>
            Some of today&apos;s items could not be loaded. Refresh the page to
            try again.
          </AlertDescription>
        </Alert>
      ) : null}

      {isFirstRun ? <GettingStarted data={data} /> : null}

      <RepliesSection data={data} />
      <FollowUpsSection data={data} />
      <ToContactSection data={data} />
    </div>
  );
}

function TodaySkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy aria-label="Loading today">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="flex flex-col gap-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ))}
    </div>
  );
}
