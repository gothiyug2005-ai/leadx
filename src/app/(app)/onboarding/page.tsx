import type { Metadata } from "next";
import { UserRoundPen } from "lucide-react";
import { Suspense } from "react";

import { PlaceholderPage } from "@/components/placeholder-page";
import { RequireUser } from "@/components/require-user";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Set up your profile" };

export default function OnboardingPage() {
  return (
    <Suspense fallback={<Skeleton className="mt-16 h-48 w-full" />}>
      <RequireUser>
        <PlaceholderPage
          icon={UserRoundPen}
          title="Set up your profile"
          description="Upload your resume, tell your story in a few answers, and pick a writing tone."
          arrivesIn="Step 4"
        />
      </RequireUser>
    </Suspense>
  );
}
