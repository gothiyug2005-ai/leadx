"use client";

import { Loader2, MailSearch } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { enrichTopPicks } from "@/lib/actions/enrichment";

export function EnrichTopPicksButton({
  targetId,
  pendingCount,
}: {
  targetId: string;
  pendingCount: number;
}) {
  const [pending, startTransition] = useTransition();
  if (pendingCount === 0) return null;
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await enrichTopPicks(targetId);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          const { found, processed, failed } = result.data;
          if (failed)
            toast.warning(
              `Found ${found} of ${processed} emails; ${failed} could not be looked up.`,
            );
          else
            toast.success(
              `Found ${found} of ${processed} emails and built their research briefs.`,
            );
        })
      }
    >
      {pending ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : (
        <MailSearch aria-hidden />
      )}
      {pending
        ? "Looking up emails…"
        : `Find emails for top picks (${pendingCount})`}
    </Button>
  );
}
