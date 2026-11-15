import type { Metadata } from "next";
import { Building2 } from "lucide-react";

import { Suspense } from "react";

import { PlaceholderPage } from "@/components/placeholder-page";
import { RequireUser } from "@/components/require-user";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Targets" };

export default function TargetsPage() {
  return (
    <Suspense fallback={<Skeleton className="mt-16 h-48 w-full" />}>
      <RequireUser>
        <PlaceholderPage
          icon={Building2}
          title="Targets"
          description="The jobs and companies you are going after, with progress for each."
          arrivesIn="Step 5"
        />
      </RequireUser>
    </Suspense>
  );
}
