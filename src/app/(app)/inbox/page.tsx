import type { Metadata } from "next";
import { Inbox } from "lucide-react";

import { Suspense } from "react";

import { PlaceholderPage } from "@/components/placeholder-page";
import { RequireUser } from "@/components/require-user";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Inbox" };

export default function InboxPage() {
  return (
    <Suspense fallback={<Skeleton className="mt-16 h-48 w-full" />}>
      <RequireUser>
        <PlaceholderPage
          icon={Inbox}
          title="Inbox"
          description="Conversations with the people you have contacted, synced from Gmail."
          arrivesIn="Step 10"
        />
      </RequireUser>
    </Suspense>
  );
}
