import type { LucideIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
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
  icon,
  title,
  description,
  arrivesIn,
}: PlaceholderPageProps) {
  return (
    <EmptyState
      size="page"
      icon={icon}
      title={title}
      description={description}
      action={<Badge variant="secondary">Coming in {arrivesIn}</Badge>}
    />
  );
}
