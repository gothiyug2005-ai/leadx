import type { Metadata } from "next";
import { Sun } from "lucide-react";

import { Suspense } from "react";

import { PlaceholderPage } from "@/components/placeholder-page";
import { RequireUser } from "@/components/require-user";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Today" };

export default function TodayPage() {
  return (
    <Suspense fallback={<Skeleton className="mt-16 h-48 w-full" />}>
      <RequireUser>
        <PlaceholderPage
          icon={Sun}
          title="Today"
          description="Who to contact today, follow-ups that are due, and replies waiting for you."
          arrivesIn="Step 3"
        />
      </RequireUser>
    </Suspense>
  );
}
