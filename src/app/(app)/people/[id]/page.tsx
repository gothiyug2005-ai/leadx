import type { Metadata } from "next";
import { ArrowLeft, ExternalLink, PenLine } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { EmptyState } from "@/components/empty-state";
import { ContactCard } from "@/components/people/contact-card";
import { AngleChips } from "@/components/people/person-card";
import { PersonMenu } from "@/components/people/person-menu";
import { ResearchCard } from "@/components/people/research-card";
import { targetTitle } from "@/components/targets/target-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getPerson, getPersonResearch } from "@/lib/data/people";
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

async function Person({ params }: Pick<PageProps<"/people/[id]">, "params">) {
  const { id } = await params;
  const person = await getPerson(id);
  if (!person) notFound();
  const angles = readAngles(person.connection_angles);
  const research = await getPersonResearch(person.id, person.company_id);

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
          {person.location ? (
            <p>
              <span className="text-muted-foreground">Location: </span>
              {person.location}
            </p>
          ) : null}
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

      <ContactCard
        personId={person.id}
        email={person.email}
        status={person.email_status}
        source={person.email_source}
        confidence={person.email_confidence}
        riskAccepted={Boolean(person.email_risk_accepted_at)}
        error={person.enrichment_error}
        doNotContact={person.do_not_contact}
      />

      <ResearchCard
        personId={person.id}
        company={research.company}
        person={research.person}
      />

      <EmptyState
        icon={PenLine}
        title="Message writer coming in Step 8"
        description="Next, LeadX will use this research to draft three personal messages for you to choose from."
        action={<Badge variant="secondary">Coming in Step 8</Badge>}
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
