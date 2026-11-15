import type { Metadata } from "next";
import {
  ArrowLeft,
  ExternalLink,
  Globe,
  MapPin,
  UserRoundSearch,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { EmptyState } from "@/components/empty-state";
import { TargetActions } from "@/components/targets/target-actions";
import { targetTitle } from "@/components/targets/target-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getTarget, type TargetDetail } from "@/lib/data/targets";
import { ROLE_TYPE_LABELS, STAGE_LABELS, labelFor } from "@/lib/labels";

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
  return (
    <section className="flex flex-col gap-3" aria-label="People">
      <h2 className="text-base font-semibold tracking-tight">People</h2>
      {target.people.length === 0 ? (
        <EmptyState
          icon={UserRoundSearch}
          title="No people yet"
          description="Soon LeadX will find the hiring manager, recruiters and teammates here, ranked by who is most likely to help."
          action={<Badge variant="secondary">Coming in Step 6</Badge>}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {target.people.map((person) => (
            <li
              key={person.id}
              className="bg-card flex flex-col gap-1 rounded-lg border px-4 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{person.full_name}</span>
                {person.role_type ? (
                  <Badge variant="secondary">
                    {labelFor(ROLE_TYPE_LABELS, person.role_type)}
                  </Badge>
                ) : null}
                <Badge variant="outline">
                  {labelFor(STAGE_LABELS, person.stage)}
                </Badge>
                {person.is_sample ? (
                  <Badge variant="outline">Sample</Badge>
                ) : null}
              </div>
              {person.title ? (
                <span className="text-muted-foreground text-sm">
                  {person.title}
                </span>
              ) : null}
              {person.relevance_reason ? (
                <span className="text-muted-foreground text-sm">
                  {person.relevance_reason}
                </span>
              ) : null}
              {person.linkedin_url ? (
                <a
                  href={person.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-primary flex items-center gap-1 self-start text-sm hover:underline"
                >
                  Profile <ExternalLink className="size-3" aria-hidden />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
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
