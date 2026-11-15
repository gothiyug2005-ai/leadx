import { Compass } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center">
      <EmptyState
        size="page"
        icon={Compass}
        title="Page not found"
        description="This page does not exist, or it may have moved."
        action={
          <Button asChild>
            <Link href="/today">Back to Today</Link>
          </Button>
        }
      />
    </main>
  );
}
