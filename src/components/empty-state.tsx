import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  action?: ReactNode;
  /** "compact" for empty sections inside a page, "page" for a whole empty screen. */
  size?: "compact" | "page";
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = "compact",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        size === "page"
          ? "gap-4 px-4 py-16"
          : "gap-2 rounded-lg border border-dashed px-4 py-8",
        className,
      )}
    >
      <div
        className={cn(
          "bg-accent flex items-center justify-center rounded-full",
          size === "page" ? "size-12" : "size-9",
        )}
      >
        <Icon
          className={cn(
            "text-accent-foreground",
            size === "page" ? "size-5" : "size-4",
          )}
          aria-hidden
        />
      </div>
      <h2
        className={cn(
          "font-semibold tracking-tight",
          size === "page" ? "text-xl" : "text-sm",
        )}
      >
        {title}
      </h2>
      <div
        className={cn(
          "text-muted-foreground max-w-md",
          size === "page" ? "text-base" : "text-sm",
        )}
      >
        {description}
      </div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
