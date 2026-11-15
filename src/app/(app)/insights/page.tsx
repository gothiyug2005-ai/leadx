import type { Metadata } from "next";
import { BarChart3, CircleAlert, Download } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { EmptyState } from "@/components/empty-state";
import {
  ChartCard,
  RankedBars,
  StatTile,
  WeeklyBars,
} from "@/components/insights/charts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getInsights } from "@/lib/data/insights";
import { ROLE_TYPE_LABELS, labelFor } from "@/lib/labels";
import { ANGLE_LABELS, type Angle } from "@/lib/writer/rules";

export const metadata: Metadata = { title: "Insights" };

export default function InsightsPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
          <p className="text-muted-foreground">
            What is working in your outreach.
          </p>
        </div>
        <Button asChild variant="outline">
          {/* A plain link: the browser downloads the file. */}
          <a href="/api/export/people" download>
            <Download aria-hidden /> Export CSV
          </a>
        </Button>
      </header>
      <Suspense fallback={<InsightsSkeleton />}>
        <Insights />
      </Suspense>
    </div>
  );
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

async function Insights() {
  const { insights, timeZone, error } = await getInsights();

  if (insights.contacted === 0) {
    return (
      <EmptyState
        size="page"
        icon={BarChart3}
        title="Nothing to measure yet"
        description="Once you start emailing people, this page shows your reply rate, interviews, and which message angles and contacts work best."
        action={
          <Button asChild variant="outline">
            <Link href="/targets">Go to targets</Link>
          </Button>
        }
      />
    );
  }

  const weekLabel = (iso: string) =>
    new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${iso}T12:00:00Z`));
  const funnelTop = Math.max(1, insights.funnel[0]?.count ?? 1);
  const FUNNEL_LABELS = {
    contacted: "Contacted",
    replied: "Replied",
    interview: "Interview",
    offer: "Offer",
  } as const;
  const angleRows = insights.byAngle.map((row) => ({
    label: row.key in ANGLE_LABELS ? ANGLE_LABELS[row.key as Angle] : row.key,
    share: row.rate,
    value: percent(row.rate),
    detail: `${row.replied} of ${row.sent}`,
  }));
  const roleRows = insights.byRoleType.map((row) => ({
    label: labelFor(ROLE_TYPE_LABELS, row.key) ?? "Unclassified",
    share: row.rate,
    value: percent(row.rate),
    detail: `${row.replied} of ${row.sent}`,
  }));

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription>
            Some numbers could not be loaded. Refresh to try again.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Emails sent"
          value={String(insights.sent)}
          detail={`to ${insights.contacted} ${insights.contacted === 1 ? "person" : "people"}`}
        />
        <StatTile
          label="Reply rate"
          value={percent(insights.replyRate)}
          detail={`${insights.replied} of ${insights.contacted} replied`}
        />
        <StatTile label="Interviews" value={String(insights.interviews)} />
        <StatTile label="Offers" value={String(insights.offers)} />
      </div>

      {insights.contacted < 10 ? (
        <p className="text-muted-foreground text-sm">
          Early days: with fewer than 10 people contacted, these percentages
          will move a lot. Treat them as hints.
        </p>
      ) : null}

      <ChartCard
        title="Emails and replies per week"
        description={`Last 8 weeks, in your time zone (${timeZone}).`}
        table={
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 font-medium">Week of</th>
                <th className="py-1 text-right font-medium">Emails sent</th>
                <th className="py-1 text-right font-medium">Replies</th>
              </tr>
            </thead>
            <tbody>
              {insights.weekly.map((row) => (
                <tr key={row.weekStart} className="border-t">
                  <td className="py-1">{weekLabel(row.weekStart)}</td>
                  <td className="py-1 text-right tabular-nums">{row.sends}</td>
                  <td className="py-1 text-right tabular-nums">
                    {row.replies}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        <WeeklyBars
          rows={insights.weekly.map((row) => ({
            label: weekLabel(row.weekStart),
            sends: row.sends,
            replies: row.replies,
          }))}
        />
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-3">
        <ChartCard
          title="From contact to offer"
          description="People at each stage."
        >
          <RankedBars
            empty="No contacts yet."
            rows={insights.funnel.map((step) => ({
              label: FUNNEL_LABELS[step.stage],
              share: step.count / funnelTop,
              value: String(step.count),
              detail:
                step.stage === "contacted"
                  ? undefined
                  : percent(step.count / funnelTop),
            }))}
          />
        </ChartCard>
        <ChartCard
          title="Best message angle"
          description="Reply rate by the angle of the first email."
        >
          <RankedBars
            rows={angleRows}
            empty="Angles show up once you send drafts written by LeadX."
          />
        </ChartCard>
        <ChartCard
          title="Who replies most"
          description="Reply rate by the kind of person you contacted."
        >
          <RankedBars rows={roleRows} empty="No contacts yet." />
        </ChartCard>
      </div>
    </div>
  );
}

function InsightsSkeleton() {
  return (
    <div
      className="flex flex-col gap-6"
      aria-busy
      aria-label="Loading insights"
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
