import type { Metadata } from "next";
import { CircleAlert, Download, KanbanSquare } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { EmptyState } from "@/components/empty-state";
import { PipelineBoard } from "@/components/pipeline/board";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getPipeline } from "@/lib/data/pipeline";

export const metadata: Metadata = { title: "Pipeline" };

export default function PipelinePage() {
  return (
    <div data-wide className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
          <p className="text-muted-foreground">
            Everyone you are in touch with, from first contact to offer. Drag a
            card, or use its menu, to move it.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href="/api/export/people" download>
            <Download aria-hidden /> Export CSV
          </a>
        </Button>
      </header>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Pipeline />
      </Suspense>
    </div>
  );
}

async function Pipeline() {
  const { people, targets, error } = await getPipeline();
  if (error) {
    return (
      <Alert variant="destructive">
        <CircleAlert aria-hidden />
        <AlertDescription>
          Your pipeline could not be loaded. Refresh to try again.
        </AlertDescription>
      </Alert>
    );
  }
  if (people.length === 0) {
    return (
      <EmptyState
        size="page"
        icon={KanbanSquare}
        title="Your pipeline is empty"
        description="Add a target and find people there. Everyone you find appears here, and moves along as you contact them."
        action={
          <Button asChild>
            <Link href="/targets/new">Add a target</Link>
          </Button>
        }
      />
    );
  }
  return <PipelineBoard people={people} targets={targets} />;
}
