import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { RequireUser } from "@/components/require-user";
import { NewTarget } from "@/components/targets/new-target";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "New target" };

export default function NewTargetPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <Link
        href="/targets"
        className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> Targets
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">New target</h1>
        <p className="text-muted-foreground">
          What are you going after? Start from a job posting, a company, or a
          person.
        </p>
      </header>
      <Suspense fallback={<Skeleton className="h-72 w-full" />}>
        <RequireUser>
          <NewTarget />
        </RequireUser>
      </Suspense>
    </div>
  );
}
