import type { Metadata } from "next";
import { Building2, CircleAlert, Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { EmptyState } from "@/components/empty-state";
import { TargetCard } from "@/components/targets/target-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listTargets } from "@/lib/data/targets";

export const metadata: Metadata = { title: "Targets" };

export default function TargetsPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Targets</h1>
          <p className="text-muted-foreground">
            The jobs, companies and people you are going after.
          </p>
        </div>
        <Button asChild>
          <Link href="/targets/new">
            <Plus aria-hidden /> New target
          </Link>
        </Button>
      </header>
      <Suspense fallback={<TargetsSkeleton />}>
        <TargetList />
      </Suspense>
    </div>
  );
}

async function TargetList() {
  const { targets, error } = await listTargets();
  const active = targets.filter((target) => target.status === "active");
  const inactive = targets.filter((target) => target.status !== "active");

  if (error) {
    return (
      <Alert variant="destructive">
        <CircleAlert aria-hidden />
        <AlertDescription>
          Your targets could not be loaded. Refresh the page to try again.
        </AlertDescription>
      </Alert>
    );
  }

  if (targets.length === 0) {
    return (
      <EmptyState
        size="page"
        icon={Building2}
        title="No targets yet"
        description="Paste a job posting, name a company, or add a person you want to reach. LeadX then finds the right people and helps you write to them."
        action={
          <Button asChild>
            <Link href="/targets/new">
              <Plus aria-hidden /> Add your first target
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3" aria-label="Active targets">
        {active.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No active targets. Resume one below or add a new one.
          </p>
        ) : (
          active.map((target) => <TargetCard key={target.id} target={target} />)
        )}
      </section>
      {inactive.length > 0 ? (
        <section
          className="flex flex-col gap-3"
          aria-label="Paused and archived targets"
        >
          <h2 className="text-muted-foreground text-sm font-medium">
            Paused and archived
          </h2>
          {inactive.map((target) => (
            <TargetCard key={target.id} target={target} />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function TargetsSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy aria-label="Loading targets">
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} className="h-24 w-full" />
      ))}
    </div>
  );
}
