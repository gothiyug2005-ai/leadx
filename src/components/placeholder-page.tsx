import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";

interface PlaceholderPageProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** The build step that turns this placeholder into the real screen. */
  arrivesIn: string;
}

/** Temporary screen used until each feature's step is built. */
export function PlaceholderPage({
  icon: Icon,
  title,
  description,
  arrivesIn,
}: PlaceholderPageProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <div className="bg-accent flex size-12 items-center justify-center rounded-full">
        <Icon className="text-accent-foreground size-5" aria-hidden />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground max-w-md">{description}</p>
      <Badge variant="secondary">Coming in {arrivesIn}</Badge>
    </div>
  );
}
