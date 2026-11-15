import type { Metadata } from "next";
import { ArrowLeft, Ban, Sparkles } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ReplyPanel } from "@/components/inbox/reply-panel";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getProfile } from "@/lib/auth";
import { getThread } from "@/lib/data/inbox";
import { CLASSIFICATION_LABELS, STAGE_LABELS, labelFor } from "@/lib/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Conversation" };

export default function ThreadPage({ params }: PageProps<"/inbox/[id]">) {
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/inbox"
        className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> Inbox
      </Link>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Thread params={params} />
      </Suspense>
    </div>
  );
}

const KIND_LABELS: Record<string, string> = {
  auto_reply: "Automatic reply",
  bounce: "Bounced",
};

async function Thread({ params }: Pick<PageProps<"/inbox/[id]">, "params">) {
  const { id } = await params;
  const [thread, profile] = await Promise.all([getThread(id), getProfile()]);
  if (!thread?.person) notFound();
  const timeZone = profile?.timezone ?? "UTC";
  const format = (value: string) =>
    new Intl.DateTimeFormat("en", {
      timeZone,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  const hasInbound = thread.thread_messages.some(
    (message) => message.direction === "inbound" && message.kind === "human",
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            <Link
              href={`/people/${thread.person.id}`}
              className="hover:underline"
            >
              {thread.person.full_name}
            </Link>
          </h1>
          <Badge variant="outline">
            {labelFor(STAGE_LABELS, thread.person.stage)}
          </Badge>
          {thread.is_sample ? <Badge variant="outline">Sample</Badge> : null}
        </div>
        <p className="text-muted-foreground">
          {[thread.person.title, thread.person.company?.name]
            .filter(Boolean)
            .join(" · ")}
          {thread.subject ? ` · ${thread.subject}` : ""}
        </p>
      </header>

      {thread.classification ? (
        <div
          className={cn(
            "flex items-start gap-3 rounded-xl border p-4",
            thread.classification === "opt_out"
              ? "border-destructive/40"
              : "bg-accent/40",
          )}
        >
          {thread.classification === "opt_out" ? (
            <Ban className="text-destructive mt-0.5 size-4" aria-hidden />
          ) : (
            <Sparkles className="text-primary mt-0.5 size-4" aria-hidden />
          )}
          <div className="flex flex-col gap-1 text-sm">
            <span className="font-medium">
              {labelFor(CLASSIFICATION_LABELS, thread.classification)}
            </span>
            {thread.classification_reason ? (
              <span className="text-muted-foreground">
                {thread.classification_reason}
              </span>
            ) : null}
            {thread.classification === "opt_out" ? (
              <span className="text-muted-foreground">
                LeadX added them to your do-not-email list and cancelled
                anything scheduled. They will not be emailed again.
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <ol className="flex flex-col gap-3" aria-label="Conversation">
        {thread.thread_messages.map((message) => {
          const outbound = message.direction === "outbound";
          return (
            <li
              key={message.id}
              className={cn(
                "flex max-w-[90%] flex-col gap-1 rounded-xl border p-4 text-sm sm:max-w-[80%]",
                outbound ? "bg-primary/5 self-end" : "bg-card self-start",
              )}
            >
              <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                <span className="text-foreground font-medium">
                  {outbound
                    ? "You"
                    : (message.from_name ?? message.from_email ?? "Them")}
                </span>
                {KIND_LABELS[message.kind] ? (
                  <Badge variant="outline">{KIND_LABELS[message.kind]}</Badge>
                ) : null}
                <span>{format(message.sent_at)}</span>
              </div>
              <p className="whitespace-pre-line">{message.body_text}</p>
            </li>
          );
        })}
      </ol>

      <ReplyPanel
        threadId={thread.id}
        personId={thread.person.id}
        personFirstName={
          thread.person.first_name ??
          thread.person.full_name.split(" ")[0] ??
          "them"
        }
        suggestedReply={thread.suggested_reply}
        needsAttention={thread.needs_attention}
        canReply={!thread.person.do_not_contact}
        stage={thread.person.stage}
        isSample={thread.is_sample}
        hasInbound={hasInbound}
      />
    </div>
  );
}
