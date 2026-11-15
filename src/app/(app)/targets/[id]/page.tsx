import type { Metadata } from "next";
import {
  ArrowLeft,
  CircleAlert,
  ExternalLink,
  Globe,
  MapPin,
  UserRoundSearch,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { EmptyState } from "@/components/empty-state";
import { AddPersonDialog } from "@/components/people/add-person-dialog";
import { FindPeopleButton } from "@/components/people/find-people-button";
import { PersonCard } from "@/components/people/person-card";
import { TargetActions } from "@/components/targets/target-actions";
import { targetTitle } from "@/components/targets/target-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getTarget, type TargetDetail } from "@/lib/data/targets";
import { sortPeople } from "@/lib/discovery/view";

export const metadata: Metadata = { title: "Target" };

export default function TargetPage({ params }: PageProps<"/targets/[id]">) {
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/targets"
        className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> Targets
      </Link>
      <Suspense fallback={<TargetSkeleton />}>
        <Target params={params} />
      </Suspense>
    </div>
  );
}

const SENIORITY_LABELS: Record<string, string> = {
  intern: "Intern",
  entry: "Entry level",
  mid: "Mid level",
  senior: "Senior",
  staff: "Staff",
  principal: "Principal",
  manager: "Manager",
  director: "Director",
  executive: "Executive",
};

async function Target({ params }: Pick<PageProps<"/targets/[id]">, "params">) {
  const { id } = await params;
  const target = await getTarget(id);
  if (!target) notFound();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {targetTitle(target)}
          </h1>
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-foreground font-medium">
              {target.company?.name}
            </span>
            {target.team ? <span>{target.team}</span> : null}
            {target.company?.domain ? (
              <span className="flex items-center gap-1">
                <Globe className="size-3.5" aria-hidden />{" "}
                {target.company.domain}
              </span>
            ) : null}
            {target.location ? (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden /> {target.location}
              </span>
            ) : null}
            {target.status !== "active" ? (
              <Badge variant="secondary">
                {target.status === "paused" ? "Paused" : "Archived"}
              </Badge>
            ) : null}
          </div>
        </div>
        <TargetActions
          id={target.id}
          kind={target.kind as "job_posting" | "company" | "person"}
          status={target.status}
          initial={{
            company_name: target.company?.name ?? "",
            company_domain: target.company?.domain ?? null,
            role_title: target.role_title,
            team: target.team,
            seniority: target.seniority,
            location: target.location,
            must_have_skills: target.must_have_skills,
            nice_to_have_skills: target.nice_to_have_skills,
            job_url: target.job_url,
            job_summary: target.job_summary,
          }}
        />
      </header>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "People found", value: target.progress.found },
          { label: "Contacted", value: target.progress.contacted },
          { label: "Replied", value: target.progress.replied },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-card flex flex-col rounded-lg border p-4"
          >
            <span className="text-2xl font-semibold tabular-nums">
              {stat.value}
            </span>
            <span className="text-muted-foreground text-xs">{stat.label}</span>
          </div>
        ))}
      </div>

      {target.kind !== "person" ? <TargetDetails target={target} /> : null}
      <People target={target} />
    </div>
  );
}

function TargetDetails({ target }: { target: TargetDetail }) {
  const hasDetails =
    target.job_summary ||
    target.must_have_skills.length ||
    target.nice_to_have_skills.length ||
    target.seniority ||
    target.job_url;
  if (!hasDetails) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">About this role</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {target.job_summary ? <p>{target.job_summary}</p> : null}
        {target.seniority ? (
          <p>
            <span className="text-muted-foreground">Seniority: </span>
            {SENIORITY_LABELS[target.seniority] ?? target.seniority}
          </p>
        ) : null}
        {target.must_have_skills.length ? (
          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground">Must-have skills</span>
            <div className="flex flex-wrap gap-1.5">
              {target.must_have_skills.map((skill) => (
                <Badge key={skill}>{skill}</Badge>
              ))}
            </div>
          </div>
        ) : null}
        {target.nice_to_have_skills.length ? (
          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground">Nice to have</span>
            <div className="flex flex-wrap gap-1.5">
              {target.nice_to_have_skills.map((skill) => (
                <Badge key={skill} variant="outline">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
        {target.job_url ? (
          <a
            href={target.job_url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-primary flex items-center gap-1 self-start hover:underline"
          >
            View the original posting{" "}
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        ) : null}
      </CardContent>
    </Card>
  );
}

function People({ target }: { target: TargetDetail }) {
  const people = sortPeople(target.people);
  const recommended = people.filter(
    (person) => person.is_recommended && !person.do_not_contact,
  );
  const others = people.filter((person) => !recommended.includes(person));
  const hasPeople = people.length > 0;
  const isPersonTarget = target.kind === "person";

  return (
    <section className="flex flex-col gap-4" aria-label="People">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-semibold tracking-tight">People</h2>
          <p className="text-muted-foreground text-sm">
            {hasPeople
              ? "Ranked by how likely they are to help with this role."
              : "Find the hiring manager, recruiters and teammates, ranked by who is most likely to help."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AddPersonDialog targetId={target.id} />
          {!isPersonTarget ? (
            <FindPeopleButton targetId={target.id} hasPeople={hasPeople} />
          ) : null}
        </div>
      </div>

      {target.discovery_status === "failed" && target.discovery_error ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription>{target.discovery_error}</AlertDescription>
        </Alert>
      ) : null}

      {!hasPeople ? (
        <EmptyState
          icon={UserRoundSearch}
          title="No people yet"
          description={
            target.company?.domain
              ? "Click Find people to search this company. You can also add someone you already know."
              : "Click Find people to search this company. Adding the company website (Edit) gives better results."
          }
        />
      ) : (
        <>
          {recommended.length ? (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">
                Start with these {recommended.length}
              </h3>
              <ul className="flex flex-col gap-2">
                {recommended.map((person) => (
                  <PersonCard key={person.id} person={person} />
                ))}
              </ul>
            </div>
          ) : null}
          {others.length ? (
            <div className="flex flex-col gap-2">
              {recommended.length ? (
                <h3 className="text-muted-foreground text-sm font-medium">
                  Everyone else
                </h3>
              ) : null}
              <ul className="flex flex-col gap-2">
                {others.map((person) => (
                  <PersonCard key={person.id} person={person} />
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function TargetSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-label="Loading target">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
