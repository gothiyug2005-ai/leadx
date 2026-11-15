"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { checkForReplies } from "@/lib/actions/inbox";

export function CheckRepliesButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await checkForReplies();
          if (!result.ok) toast.error(result.error);
          else
            toast.success(
              result.data.newReplies
                ? `${result.data.newReplies} new ${result.data.newReplies === 1 ? "reply" : "replies"}`
                : "No new replies",
            );
        })
      }
    >
      {pending ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : (
        <RefreshCw aria-hidden />
      )}{" "}
      Check for replies
    </Button>
  );
}
