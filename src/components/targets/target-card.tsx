import { ArrowRight, MapPin } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import type { TargetListItem } from "@/lib/data/targets";
import { cn } from "@/lib/utils";

const KIND_LABELS: Record<string, string> = {
  job_posting: "Job posting",
  company: "Company",
  person: "Person",
};

export function targetTitle(target: {
  role_title: string | null;
  company: { name: string } | null;
  personName?: string | null;
}) {
  const company = target.company?.name ?? "this company";
  if (target.personName) return `${target.personName} at ${company}`;
  return target.role_title ?? `Anyone at ${company}`;
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-lg font-semibold tabular-nums">{value}</span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}

export function TargetCard({ target }: { target: TargetListItem }) {
  const muted = target.status !== "active";
  return (
    <Link
      href={`/targets/${target.id}`}
      className={cn(
        "group bg-card hover:bg-accent/40 flex flex-col gap-4 rounded-xl border p-4 transition-colors sm:flex-row sm:items-center",
        muted && "opacity-70",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{targetTitle(target)}</span>
          <Badge variant="outline">
            {KIND_LABELS[target.kind] ?? target.kind}
          </Badge>
          {target.status !== "active" ? (
            <Badge variant="secondary">
              {target.status === "paused" ? "Paused" : "Archived"}
            </Badge>
          ) : null}
        </div>
        <span className="text-muted-foreground truncate text-sm">
          {target.company?.name}
          {target.team ? ` · ${target.team}` : ""}
        </span>
        {target.location ? (
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <MapPin className="size-3" aria-hidden /> {target.location}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-6">
        <Stat value={target.progress.found} label="found" />
        <Stat value={target.progress.contacted} label="contacted" />
        <Stat value={target.progress.replied} label="replied" />
        <ArrowRight
          className="text-muted-foreground hidden size-4 transition-transform group-hover:translate-x-0.5 sm:block"
          aria-hidden
        />
      </div>
    </Link>
  );
}
