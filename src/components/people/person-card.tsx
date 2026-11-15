import {
  Ban,
  Briefcase,
  GraduationCap,
  MapPin,
  PenLine,
  Sparkles,
  Star,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ConnectionAngle } from "@/lib/discovery/angles";
import { readAngles } from "@/lib/discovery/view";
import { ROLE_TYPE_LABELS, STAGE_LABELS, labelFor } from "@/lib/labels";
import { cn } from "@/lib/utils";

import { PersonMenu } from "./person-menu";

const ANGLE_ICONS: Record<ConnectionAngle["type"], typeof GraduationCap> = {
  shared_school: GraduationCap,
  past_company: Briefcase,
  location: MapPin,
  skills: Sparkles,
};

export interface PersonCardData {
  id: string;
  full_name: string;
  title: string | null;
  location: string | null;
  role_type: string | null;
  relevance_score: number | null;
  relevance_reason: string | null;
  connection_angles: unknown;
  is_recommended: boolean;
  do_not_contact: boolean;
  stage: string;
  is_sample: boolean;
}

export function AngleChips({ angles }: { angles: ConnectionAngle[] }) {
  if (angles.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="What you have in common">
      {angles.map((angle) => {
        const Icon = ANGLE_ICONS[angle.type];
        return (
          <li
            key={`${angle.type}-${angle.detail}`}
            className="bg-accent text-accent-foreground flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
          >
            <Icon className="size-3" aria-hidden />
            {angle.detail}
          </li>
        );
      })}
    </ul>
  );
}

export function PersonCard({ person }: { person: PersonCardData }) {
  const angles = readAngles(person.connection_angles);
  return (
    <li
      className={cn(
        "bg-card flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-start",
        person.is_recommended && !person.do_not_contact && "border-primary/40",
        person.do_not_contact && "opacity-60",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{person.full_name}</span>
          {person.is_recommended && !person.do_not_contact ? (
            <Badge>
              <Star aria-hidden /> Top pick
            </Badge>
          ) : null}
          {person.role_type ? (
            <Badge variant="secondary">
              {labelFor(ROLE_TYPE_LABELS, person.role_type)}
            </Badge>
          ) : null}
          {person.stage !== "to_contact" ? (
            <Badge variant="outline">
              {labelFor(STAGE_LABELS, person.stage)}
            </Badge>
          ) : null}
          {person.do_not_contact ? (
            <Badge variant="destructive">
              <Ban aria-hidden /> Do not contact
            </Badge>
          ) : null}
          {person.is_sample ? <Badge variant="outline">Sample</Badge> : null}
        </div>
        {person.title ? (
          <span className="text-muted-foreground text-sm">{person.title}</span>
        ) : null}
        {person.relevance_reason ? (
          <p className="text-sm">{person.relevance_reason}</p>
        ) : null}
        <AngleChips angles={angles} />
      </div>
      <div className="flex items-center gap-2 sm:flex-col sm:items-end">
        {person.relevance_score !== null ? (
          <div
            className="text-muted-foreground flex items-center gap-2 text-xs"
            title="How likely they are to help with this role"
          >
            <span className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
              <span
                className="bg-primary block h-full rounded-full"
                style={{ width: `${person.relevance_score}%` }}
              />
            </span>
            <span className="tabular-nums">{person.relevance_score}</span>
            <span className="sr-only">out of 100 match</span>
          </div>
        ) : null}
        <div className="ml-auto flex items-center gap-1 sm:ml-0">
          {!person.do_not_contact ? (
            <Button asChild size="sm">
              <Link href={`/people/${person.id}`}>
                <PenLine aria-hidden /> Write message
              </Link>
            </Button>
          ) : null}
          <PersonMenu
            id={person.id}
            name={person.full_name}
            recommended={person.is_recommended}
            doNotContact={person.do_not_contact}
          />
        </div>
      </div>
    </li>
  );
}
