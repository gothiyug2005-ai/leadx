import type { Metadata } from "next";
import { CircleCheck, CircleDashed } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { Brand } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSetupStatus, isCoreSetupComplete } from "@/lib/setup-status";

export const metadata: Metadata = { title: "Setup" };

export default function SetupPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12 sm:px-6">
      <Brand />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Finish connecting LeadX
        </h1>
        <p className="text-muted-foreground">
          LeadX needs a database before anyone can sign in. Everything else is
          optional to begin with: until a service is connected, LeadX uses
          clearly labelled sample data for it.
        </p>
      </div>
      <Suspense fallback={<SetupSkeleton />}>
        <SetupChecklist />
      </Suspense>
    </main>
  );
}

async function SetupChecklist() {
  // Read the environment at request time, not at build time.
  await connection();

  // Once the app is connected, this page has nothing to say in production.
  if (isCoreSetupComplete() && process.env.NODE_ENV === "production") {
    redirect("/login");
  }

  const groups = getSetupStatus();
  const coreReady = isCoreSetupComplete();

  return (
    <>
      <div className="flex flex-col gap-3">
        {groups.map((group) => {
          const done = group.items.every((entry) => entry.isSet);
          return (
            <Card key={group.id} className="gap-3 py-4">
              <CardHeader className="px-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <CardTitle className="text-base">{group.title}</CardTitle>
                    <CardDescription>{group.description}</CardDescription>
                  </div>
                  {done ? (
                    <Badge variant="secondary">Connected</Badge>
                  ) : group.required ? (
                    <Badge variant="destructive">Required</Badge>
                  ) : (
                    <Badge variant="outline">Sample data</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-4">
                <ul className="flex flex-col gap-1.5 text-sm">
                  {group.items.map((entry) => (
                    <li key={entry.key} className="flex items-center gap-2">
                      {entry.isSet ? (
                        <CircleCheck
                          className="text-primary size-4 shrink-0"
                          aria-hidden
                        />
                      ) : (
                        <CircleDashed
                          className="text-muted-foreground size-4 shrink-0"
                          aria-hidden
                        />
                      )}
                      <span>{entry.label}</span>
                      <code className="text-muted-foreground ml-auto truncate font-mono text-xs">
                        {entry.key}
                      </code>
                      <span className="sr-only">
                        {entry.isSet ? "set" : "not set"}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="bg-muted/40 flex flex-col gap-3 rounded-lg border p-4 text-sm">
        <p>
          <span className="font-medium">How to add these:</span> follow{" "}
          <code className="font-mono text-xs">docs/SETUP.md</code> in the
          repository. Each value goes into your hosting provider&apos;s
          environment variable settings (on Vercel: Project → Settings →
          Environment Variables), then redeploy.
        </p>
        {coreReady ? (
          <div>
            <Button asChild>
              <Link href="/login">Continue to sign in</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );
}

function SetupSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-28 w-full" />
      ))}
    </div>
  );
}
