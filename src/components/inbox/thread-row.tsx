import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { CLASSIFICATION_LABELS, labelFor } from "@/lib/labels";
import type { InboxThread } from "@/lib/data/inbox";
import { cn } from "@/lib/utils";

export function ThreadRow({
  thread,
  timeZone,
}: {
  thread: InboxThread;
  timeZone: string;
}) {
  const time = thread.last_message_at
    ? new Intl.DateTimeFormat("en", {
        timeZone,
        month: "short",
        day: "numeric",
      }).format(new Date(thread.last_message_at))
    : "";
  return (
    <li>
      <Link
        href={`/inbox/${thread.id}`}
        className={cn(
          "group bg-card hover:bg-accent/50 flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors",
          thread.needs_attention && "border-primary/40",
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "truncate",
                thread.needs_attention ? "font-semibold" : "font-medium",
              )}
            >
              {thread.person?.full_name ?? "Unknown"}
            </span>
            {thread.classification ? (
              <Badge
                variant={
                  thread.classification === "opt_out"
                    ? "destructive"
                    : "secondary"
                }
              >
                {labelFor(CLASSIFICATION_LABELS, thread.classification)}
              </Badge>
            ) : null}
            {thread.is_sample ? <Badge variant="outline">Sample</Badge> : null}
            <span className="text-muted-foreground ml-auto text-xs">
              {time}
            </span>
          </div>
          <span className="text-muted-foreground truncate text-sm">
            {[thread.person?.title, thread.person?.company?.name]
              .filter(Boolean)
              .join(" · ")}
          </span>
          {thread.snippet ? (
            <span className="text-muted-foreground line-clamp-1 text-sm">
              {thread.snippet}
            </span>
          ) : null}
        </div>
        <ArrowRight
          className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>
    </li>
  );
}
