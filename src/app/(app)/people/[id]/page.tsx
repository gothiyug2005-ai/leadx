import type { Metadata } from "next";
import { ArrowLeft, ExternalLink, PenLine } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { EmptyState } from "@/components/empty-state";
import { AngleChips } from "@/components/people/person-card";
import { PersonMenu } from "@/components/people/person-menu";
import { targetTitle } from "@/components/targets/target-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getPerson } from "@/lib/data/people";
import { readAngles } from "@/lib/discovery/view";
import { ROLE_TYPE_LABELS, STAGE_LABELS, labelFor } from "@/lib/labels";

export const metadata: Metadata = { title: "Person" };

export default function PersonPage({ params }: PageProps<"/people/[id]">) {
  return (
    <Suspense fallback={<PersonSkeleton />}>
      <Person params={params} />
    </Suspense>
  );
}

const EMAIL_STATUS: Record<string, string> = {
  unknown: "Not checked yet",
  valid: "Verified",
  risky: "Risky",
  invalid: "Invalid",
  not_found: "Not found",
};

async function Person({ params }: Pick<PageProps<"/people/[id]">, "params">) {
  const { id } = await params;
  const person = await getPerson(id);
  if (!person) notFound();
  const angles = readAngles(person.connection_angles);

  return (
    <div className="flex flex-col gap-6">
      {person.target ? (
        <Link
          href={`/targets/${person.target.id}`}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {targetTitle({
            role_title: person.target.role_title,
            company: person.company,
          })}
        </Link>
      ) : null}

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {person.full_name}
            </h1>
            {person.role_type ? (
              <Badge variant="secondary">
                {labelFor(ROLE_TYPE_LABELS, person.role_type)}
              </Badge>
            ) : null}
            <Badge variant="outline">
              {labelFor(STAGE_LABELS, person.stage)}
            </Badge>
            {person.do_not_contact ? (
              <Badge variant="destructive">Do not contact</Badge>
            ) : null}
            {person.is_sample ? <Badge variant="outline">Sample</Badge> : null}
          </div>
          <p className="text-muted-foreground">
            {[person.title, person.company?.name].filter(Boolean).join(" · ")}
          </p>
        </div>
        <PersonMenu
          id={person.id}
          name={person.full_name}
          recommended={person.is_recommended}
          doNotContact={person.do_not_contact}
        />
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Why reach out</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {person.relevance_reason ? (
            <p>{person.relevance_reason}</p>
          ) : (
            <p className="text-muted-foreground">No notes yet.</p>
          )}
          <AngleChips angles={angles} />
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd>
                {person.email
                  ? `${person.email} (${EMAIL_STATUS[person.email_status] ?? person.email_status})`
                  : "Not found yet"}
              </dd>
            </div>
            {person.location ? (
              <div>
                <dt className="text-muted-foreground">Location</dt>
                <dd>{person.location}</dd>
              </div>
            ) : null}
          </dl>
          {person.notes ? (
            <p className="text-muted-foreground whitespace-pre-line">
              {person.notes}
            </p>
          ) : null}
          {person.linkedin_url ? (
            <a
              href={person.linkedin_url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-primary flex items-center gap-1 self-start hover:underline"
            >
              Profile <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : null}
        </CardContent>
      </Card>

      <EmptyState
        icon={PenLine}
        title="Message writer coming next"
        description="Soon you will see their research brief here and get three personal message drafts to choose from."
        action={<Badge variant="secondary">Coming in Steps 7–8</Badge>}
      />
    </div>
  );
}

function PersonSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-label="Loading person">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
