import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Circle,
  MessageCircleReply,
  UserRoundSearch,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/dates";
import {
  CLASSIFICATION_LABELS,
  ROLE_TYPE_LABELS,
  labelFor,
} from "@/lib/labels";
import type { TodayData } from "@/lib/data/today";
import { cn } from "@/lib/utils";

function Section({
  title,
  count,
  description,
  children,
}: {
  title: string;
  count?: number;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <div className="flex items-baseline gap-2">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {count ? (
          <span className="text-muted-foreground text-sm tabular-nums">
            {count}
          </span>
        ) : null}
      </div>
      <p className="text-muted-foreground -mt-2 text-sm">{description}</p>
      {children}
    </section>
  );
}

function Row({
  href,
  primary,
  secondary,
  meta,
  badge,
}: {
  href: string;
  primary: string;
  secondary?: string | null;
  meta?: string | null;
  badge?: ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="group bg-card hover:bg-accent/50 flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{primary}</span>
            {badge}
          </div>
          {secondary ? (
            <span className="text-muted-foreground truncate text-sm">
              {secondary}
            </span>
          ) : null}
          {meta ? (
            <span className="text-muted-foreground line-clamp-2 text-sm">
              {meta}
            </span>
          ) : null}
        </div>
        <ArrowRight
          className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>
    </li>
  );
}

function personLine(
  person: {
    title: string | null;
    company: { name: string } | null;
  } | null,
): string | null {
  if (!person) return null;
  return (
    [person.title, person.company?.name].filter(Boolean).join(" · ") || null
  );
}

function SampleBadge({ show }: { show: boolean }) {
  return show ? <Badge variant="outline">Sample</Badge> : null;
}

export function RepliesSection({ data }: { data: TodayData }) {
  return (
    <Section
      title="Replies to handle"
      count={data.replies.length}
      description="People who wrote back. Answer these first."
    >
      {data.replies.length === 0 ? (
        <EmptyState
          icon={MessageCircleReply}
          title="No replies waiting"
          description="When someone answers, their reply shows up here with a suggested response."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.replies.map((thread) => (
            <Row
              key={thread.id}
              href={`/inbox/${thread.id}`}
              primary={thread.person?.full_name ?? "Unknown sender"}
              secondary={personLine(thread.person)}
              meta={thread.snippet}
              badge={
                <>
                  {thread.classification ? (
                    <Badge variant="secondary">
                      {labelFor(CLASSIFICATION_LABELS, thread.classification)}
                    </Badge>
                  ) : null}
                  <SampleBadge show={thread.is_sample} />
                </>
              }
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

export function FollowUpsSection({ data }: { data: TodayData }) {
  return (
    <Section
      title="Follow-ups due"
      count={data.followUps.length}
      description="Gentle nudges scheduled for today. They stop automatically if someone replies."
    >
      {data.followUps.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Nothing due today"
          description="Follow-ups go out on day 3 and day 7 after your first email."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.followUps.map((message) => (
            <Row
              key={message.id}
              href={
                message.person ? `/people/${message.person.id}` : "/pipeline"
              }
              primary={message.person?.full_name ?? "Unknown person"}
              secondary={personLine(message.person)}
              meta={`Follow-up ${message.sequence_step}${
                message.scheduled_at
                  ? ` · ${formatRelative(new Date(message.scheduled_at), data.now)}`
                  : ""
              }`}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

export function ToContactSection({ data }: { data: TodayData }) {
  return (
    <Section
      title="Who to contact today"
      count={data.toContact.length}
      description="The people most likely to help, best matches first."
    >
      {data.toContact.length === 0 ? (
        <EmptyState
          icon={UserRoundSearch}
          title="No one queued up"
          description="Open a target to find people there. The best matches will appear here."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/targets">Go to targets</Link>
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.toContact.map((person) => (
            <Row
              key={person.id}
              href={`/people/${person.id}`}
              primary={person.full_name}
              secondary={personLine(person)}
              meta={person.relevance_reason}
              badge={
                <>
                  {person.role_type ? (
                    <Badge variant="secondary">
                      {labelFor(ROLE_TYPE_LABELS, person.role_type)}
                    </Badge>
                  ) : null}
                  {person.is_recommended ? <Badge>Top pick</Badge> : null}
                  <SampleBadge show={person.is_sample} />
                </>
              }
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

/** First-run checklist, shown until the user has an active target. */
export function GettingStarted({ data }: { data: TodayData }) {
  const steps = [
    {
      done: Boolean(data.profile.onboarding_completed_at),
      title: "Tell LeadX about you",
      description:
        "Upload your resume and pick a writing tone, so every message sounds like you.",
      href: "/onboarding",
      cta: "Set up profile",
    },
    {
      done: data.activeTargets > 0,
      title: "Choose your first target",
      description: "Paste a job posting or name a company you want to work at.",
      href: "/targets",
      cta: "Add a target",
    },
    {
      done: false,
      title: "Reach out to the right people",
      description:
        "LeadX finds who to contact, drafts a personal message, and you review it before anything is sent.",
      href: null,
      cta: null,
    },
  ];
  const next = steps.findIndex((step) => !step.done);

  return (
    <section
      aria-label="Getting started"
      className="bg-card flex flex-col gap-4 rounded-xl border p-5 sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">
          Let&apos;s get you started
        </h2>
        <p className="text-muted-foreground text-sm">
          Three steps, and LeadX starts lining up conversations for you.
        </p>
      </div>
      <ol className="flex flex-col gap-3">
        {steps.map((step, index) => {
          const isNext = index === next;
          return (
            <li
              key={step.title}
              className={cn(
                "flex gap-3 rounded-lg p-3",
                isNext && "bg-accent/60",
              )}
            >
              {step.done ? (
                <CheckCircle2
                  className="text-primary mt-0.5 size-5 shrink-0"
                  aria-label="Done"
                />
              ) : (
                <Circle
                  className="text-muted-foreground mt-0.5 size-5 shrink-0"
                  aria-label="Not done yet"
                />
              )}
              <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex flex-1 flex-col gap-0.5">
                  <span
                    className={cn(
                      "font-medium",
                      step.done && "text-muted-foreground line-through",
                    )}
                  >
                    {step.title}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {step.description}
                  </span>
                </div>
                {isNext && step.href && step.cta ? (
                  <Button
                    asChild
                    size="sm"
                    className="self-start sm:self-center"
                  >
                    <Link href={step.href}>{step.cta}</Link>
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
