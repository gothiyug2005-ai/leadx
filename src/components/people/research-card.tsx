import { BookOpen, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  companyBriefSchema,
  personBriefSchema,
} from "@/lib/ai/schemas/research";

import { ResearchButton } from "./research-button";

interface BriefRow {
  content: unknown;
  is_sample: boolean;
  created_at: string;
}

export function ResearchCard({
  personId,
  company,
  person,
}: {
  personId: string;
  company: BriefRow | null;
  person: BriefRow | null;
}) {
  const companyBrief = companyBriefSchema.safeParse(company?.content);
  const personBrief = personBriefSchema.safeParse(person?.content);
  const isSample = Boolean(company?.is_sample || person?.is_sample);
  const updated = person?.created_at ?? company?.created_at;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="size-4" aria-hidden /> Research brief
            {isSample ? <Badge variant="outline">Sample</Badge> : null}
          </CardTitle>
          <CardDescription>
            {updated
              ? `Updated ${new Date(updated).toLocaleDateString("en", { month: "short", day: "numeric" })}. `
              : ""}
            Used to make your message specific.
          </CardDescription>
        </div>
        <ResearchButton personId={personId} hasBrief={personBrief.success} />
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {!personBrief.success && !companyBrief.success ? (
          <p className="text-muted-foreground">
            No research yet. Build a brief to see the company&apos;s recent news
            and the best way to open.
          </p>
        ) : null}
        {personBrief.success ? (
          <>
            <div className="bg-accent/60 rounded-lg p-3">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Best hook
              </p>
              <p className="mt-1">{personBrief.data.best_hook}</p>
            </div>
            <p>{personBrief.data.person_summary}</p>
            {personBrief.data.talking_points.length ? (
              <div className="flex flex-col gap-1">
                <p className="font-medium">Worth mentioning</p>
                <ul className="text-muted-foreground list-disc pl-5">
                  {personBrief.data.talking_points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {personBrief.data.avoid.length ? (
              <div className="flex flex-col gap-1">
                <p className="font-medium">Avoid</p>
                <ul className="text-muted-foreground list-disc pl-5">
                  {personBrief.data.avoid.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}
        {companyBrief.success ? (
          <div className="flex flex-col gap-3 border-t pt-4">
            <p className="font-medium">About the company</p>
            <p className="text-muted-foreground">
              {companyBrief.data.company_summary}
            </p>
            {companyBrief.data.team_focus ? (
              <p>
                <span className="text-muted-foreground">Team focus: </span>
                {companyBrief.data.team_focus}
              </p>
            ) : null}
            {companyBrief.data.recent_news.length ? (
              <ul className="flex flex-col gap-2">
                {companyBrief.data.recent_news.map((item) => (
                  <li key={item.url} className="flex flex-col gap-0.5">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-primary flex items-center gap-1 font-medium hover:underline"
                    >
                      {item.headline}{" "}
                      <ExternalLink className="size-3 shrink-0" aria-hidden />
                    </a>
                    <span className="text-muted-foreground">
                      {item.why_it_matters}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {companyBrief.data.likely_pain_points.length ? (
              <div className="flex flex-col gap-1">
                <p className="font-medium">Likely needs</p>
                <ul className="text-muted-foreground list-disc pl-5">
                  {companyBrief.data.likely_pain_points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
