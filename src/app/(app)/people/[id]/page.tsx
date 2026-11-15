import type { Metadata } from "next";
import { ArrowLeft, Ban, ExternalLink } from "lucide-react";
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
import { Composer } from "@/components/writer/composer";
import { isAiSampleMode } from "@/lib/ai/client";
import { requireUser } from "@/lib/auth";
import {
  getComposerDrafts,
  getPerson,
  getPersonResearch,
} from "@/lib/data/people";
import { readAngles } from "@/lib/discovery/view";
import { ROLE_TYPE_LABELS, STAGE_LABELS, labelFor } from "@/lib/labels";
import { contextSourceText } from "@/lib/writer/context";
import { loadWriterContext } from "@/lib/writer/load";

export const metadata: Metadata = { title: "Person" };

export default function PersonPage({ params }: PageProps<"/people/[id]">) {
  return (
    <div data-wide className="flex flex-col gap-6">
      <Suspense fallback={<PersonSkeleton />}>
        <Person params={params} />
      </Suspense>
    </div>
  );
}

async function Person({ params }: Pick<PageProps<"/people/[id]">, "params">) {
  const { id } = await params;
  const user = await requireUser();
  const person = await getPerson(id);
  if (!person) notFound();

  const angles = readAngles(person.connection_angles);
  const [research, drafts] = await Promise.all([
    getPersonResearch(person.id, person.company_id),
    getComposerDrafts(person.id),
  ]);
  const writer = person.do_not_contact
    ? null
    : await loadWriterContext(user.id, person.id, "cold_email");
  const emailReady =
    Boolean(person.email) &&
    (person.email_status === "valid" ||
      (["risky", "unknown"].includes(person.email_status) &&
        Boolean(person.email_risk_accepted_at)));

  return (
    <>
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

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex flex-col gap-6">
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
        </div>

        <div className="flex flex-col gap-6 lg:sticky lg:top-6">
          {writer ? (
            <Composer
              personId={person.id}
              recipientFirstName={writer.context.recipient.firstName}
              drafts={drafts}
              sourceText={contextSourceText(writer.context)}
              linkedinUrl={person.linkedin_url}
              emailReady={emailReady}
              aiSample={isAiSampleMode()}
            />
          ) : (
            <EmptyState
              icon={Ban}
              title="Not contacting this person"
              description="You asked LeadX never to email them again, so there is nothing to write."
            />
          )}
        </div>
      </div>
    </>
  );
}

function PersonSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-label="Loading person">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  );
}
