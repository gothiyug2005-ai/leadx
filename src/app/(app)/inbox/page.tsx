import type { Metadata } from "next";
import { Inbox as InboxIcon } from "lucide-react";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { EmptyState } from "@/components/empty-state";
import { CheckRepliesButton } from "@/components/inbox/check-replies-button";
import { ThreadRow } from "@/components/inbox/thread-row";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getProfile } from "@/lib/auth";
import { getGmailStatus } from "@/lib/data/gmail";
import { listThreads, type InboxThread } from "@/lib/data/inbox";

export const metadata: Metadata = { title: "Inbox" };

export default function InboxPage() {
  return (
    <div className="flex flex-col gap-8">
      <Suspense fallback={<InboxSkeleton />}>
        <Inbox />
      </Suspense>
    </div>
  );
}

function Section({
  title,
  description,
  threads,
  timeZone,
  children,
}: {
  title: string;
  description: string;
  threads: InboxThread[];
  timeZone: string;
  children?: ReactNode;
}) {
  if (threads.length === 0 && !children) return null;
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-base font-semibold tracking-tight">
          {title}{" "}
          {threads.length ? (
            <span className="text-muted-foreground text-sm font-normal">
              {threads.length}
            </span>
          ) : null}
        </h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {children}
      <ul className="flex flex-col gap-2">
        {threads.map((thread) => (
          <ThreadRow key={thread.id} thread={thread} timeZone={timeZone} />
        ))}
      </ul>
    </section>
  );
}

async function Inbox() {
  const [{ needsReply, waiting, done }, gmail, profile] = await Promise.all([
    listThreads(),
    getGmailStatus(),
    getProfile(),
  ]);
  const timeZone = profile?.timezone ?? "UTC";
  const connected = gmail?.connection?.status === "connected";
  const empty = needsReply.length + waiting.length + done.length === 0;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
          <p className="text-muted-foreground">
            Conversations with the people you have emailed.
          </p>
        </div>
        {connected ? <CheckRepliesButton /> : null}
      </header>

      {empty ? (
        <EmptyState
          size="page"
          icon={InboxIcon}
          title="No conversations yet"
          description={
            connected
              ? "When you email someone from LeadX, the conversation shows up here, and replies are picked up from Gmail automatically."
              : "Send your first email from a person's page. Connect Gmail in Settings so LeadX can pick up replies."
          }
          action={
            <Button asChild variant="outline">
              <Link href={connected ? "/targets" : "/settings#gmail"}>
                {connected ? "Go to targets" : "Connect Gmail"}
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <Section
            title="Needs your reply"
            description="People who wrote back. LeadX has a suggested response ready."
            threads={needsReply}
            timeZone={timeZone}
          >
            {needsReply.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nothing waiting on you.
              </p>
            ) : null}
          </Section>
          <Section
            title="Waiting for a reply"
            description="Follow-ups go out automatically unless you stopped them."
            threads={waiting}
            timeZone={timeZone}
          />
          <Section
            title="Handled"
            description="Replies you have dealt with."
            threads={done}
            timeZone={timeZone}
          />
        </>
      )}
    </>
  );
}

function InboxSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy aria-label="Loading inbox">
      <Skeleton className="h-8 w-40" />
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} className="h-20 w-full" />
      ))}
    </div>
  );
}
