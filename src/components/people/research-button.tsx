"use client";

import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { refreshResearch } from "@/lib/actions/enrichment";

export function ResearchButton({
  personId,
  hasBrief,
}: {
  personId: string;
  hasBrief: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant={hasBrief ? "ghost" : "default"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await refreshResearch(personId);
          if (!result.ok) toast.error(result.error);
          else toast.success("Research brief ready");
        })
      }
    >
      {pending ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : hasBrief ? (
        <RefreshCw aria-hidden />
      ) : (
        <Sparkles aria-hidden />
      )}
      {pending ? "Researching…" : hasBrief ? "Refresh" : "Build brief"}
    </Button>
  );
}
