import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";

import { Suspense } from "react";

import { PlaceholderPage } from "@/components/placeholder-page";
import { RequireUser } from "@/components/require-user";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Insights" };

export default function InsightsPage() {
  return (
    <Suspense fallback={<Skeleton className="mt-16 h-48 w-full" />}>
      <RequireUser>
        <PlaceholderPage
          icon={BarChart3}
          title="Insights"
          description="Reply rates, interviews, and which message angles work best."
          arrivesIn="Step 11"
        />
      </RequireUser>
    </Suspense>
  );
}
