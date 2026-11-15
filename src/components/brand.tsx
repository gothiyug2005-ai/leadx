import { cn } from "@/lib/utils";

/** The LeadX wordmark with its small mark. */
export function Brand({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-semibold tracking-tight",
        className,
      )}
    >
      <span
        aria-hidden
        className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md text-xs font-bold"
      >
        L
      </span>
      LeadX
    </span>
  );
}
