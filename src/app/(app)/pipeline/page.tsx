import type { Metadata } from "next";
import { KanbanSquare } from "lucide-react";

import { Suspense } from "react";

import { PlaceholderPage } from "@/components/placeholder-page";
import { RequireUser } from "@/components/require-user";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Pipeline" };

export default function PipelinePage() {
  return (
    <Suspense fallback={<Skeleton className="mt-16 h-48 w-full" />}>
      <RequireUser>
        <PlaceholderPage
          icon={KanbanSquare}
          title="Pipeline"
          description="Everyone you are in touch with, from first contact to offer."
          arrivesIn="Step 11"
        />
      </RequireUser>
    </Suspense>
  );
}
