import type { Metadata } from "next";
import { Settings } from "lucide-react";

import { Suspense } from "react";

import { PlaceholderPage } from "@/components/placeholder-page";
import { RequireUser } from "@/components/require-user";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<Skeleton className="mt-16 h-48 w-full" />}>
      <RequireUser>
        <PlaceholderPage
          icon={Settings}
          title="Settings"
          description="Your profile, writing tone, Gmail connection, and sending limits."
          arrivesIn="Step 4"
        />
      </RequireUser>
    </Suspense>
  );
}
