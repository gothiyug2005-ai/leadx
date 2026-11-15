"use client";

import { Ban, GripVertical, MoreHorizontal, Search, Star } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setStage } from "@/lib/actions/inbox";
import { ROLE_TYPE_LABELS, STAGE_LABELS, labelFor } from "@/lib/labels";
import { cn } from "@/lib/utils";

export interface BoardPerson {
  id: string;
  full_name: string;
  title: string | null;
  stage: string;
  role_type: string | null;
  is_recommended: boolean;
  do_not_contact: boolean;
  is_sample: boolean;
  relevance_score: number | null;
  target_id: string;
  company: { name: string } | null;
}

const COLUMNS = [
  { id: "to_contact", title: "To contact", stages: ["to_contact"] },
  { id: "contacted", title: "Contacted", stages: ["contacted"] },
  { id: "followed_up", title: "Followed up", stages: ["followed_up"] },
  { id: "replied", title: "Replied", stages: ["replied"] },
  { id: "interview", title: "Interview", stages: ["interview"] },
  { id: "offer", title: "Offer / Closed", stages: ["offer", "closed"] },
] as const;

const ALL_STAGES = [
  "to_contact",
  "contacted",
  "followed_up",
  "replied",
  "interview",
  "offer",
  "closed",
] as const;
const COLUMN_LIMIT = 30;

export function PipelineBoard({
  people: initial,
  targets,
}: {
  people: BoardPerson[];
  targets: { id: string; label: string }[];
}) {
  const [people, setPeople] = useState(initial);
  const [target, setTarget] = useState("all");
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return people.filter(
      (person) =>
        (target === "all" || person.target_id === target) &&
        (!needle ||
          `${person.full_name} ${person.title ?? ""} ${person.company?.name ?? ""}`
            .toLowerCase()
            .includes(needle)),
    );
  }, [people, target, query]);

  function move(personId: string, stage: string) {
    const before = people.find((person) => person.id === personId);
    if (!before || before.stage === stage) return;
    setPeople((current) =>
      current.map((person) =>
        person.id === personId ? { ...person, stage } : person,
      ),
    );
    startTransition(async () => {
      const result = await setStage(personId, stage);
      if (!result.ok) {
        setPeople((current) =>
          current.map((person) =>
            person.id === personId
              ? { ...person, stage: before.stage }
              : person,
          ),
        );
        toast.error(result.error);
      } else {
        toast.success(
          `${before.full_name} moved to ${labelFor(STAGE_LABELS, stage)}`,
        );
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative sm:w-64">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            aria-label="Search people"
            placeholder="Search people"
            className="pl-8"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger className="sm:w-72" aria-label="Filter by target">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All targets</SelectItem>
            {targets.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="grid min-w-[1080px] grid-cols-6 gap-3">
          {COLUMNS.map((column) => {
            const cards = visible
              .filter((person) =>
                (column.stages as readonly string[]).includes(person.stage),
              )
              .sort(
                (a, b) =>
                  Number(b.is_recommended) - Number(a.is_recommended) ||
                  (b.relevance_score ?? 0) - (a.relevance_score ?? 0),
              );
            const shown = expanded[column.id]
              ? cards
              : cards.slice(0, COLUMN_LIMIT);
            const target = column.stages[0];
            return (
              <section
                key={column.id}
                aria-label={column.title}
                onDragOver={(event) => {
                  event.preventDefault();
                  setOver(column.id);
                }}
                onDragLeave={() =>
                  setOver((current) => (current === column.id ? null : current))
                }
                onDrop={(event) => {
                  event.preventDefault();
                  const id =
                    event.dataTransfer.getData("text/plain") || dragging;
                  setOver(null);
                  setDragging(null);
                  if (id) move(id, target);
                }}
                className={cn(
                  "bg-muted/50 flex min-h-48 flex-col gap-2 rounded-xl p-2 transition-colors",
                  over === column.id && "bg-accent ring-primary/40 ring-2",
                )}
              >
                <h2 className="flex items-center justify-between px-1 pt-1 text-sm font-medium">
                  {column.title}
                  <span className="text-muted-foreground text-xs font-normal tabular-nums">
                    {cards.length}
                  </span>
                </h2>
                <ul className="flex flex-col gap-2">
                  {shown.map((person) => (
                    <li
                      key={person.id}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", person.id);
                        event.dataTransfer.effectAllowed = "move";
                        setDragging(person.id);
                      }}
                      onDragEnd={() => setDragging(null)}
                      className={cn(
                        "group bg-card flex flex-col gap-1 rounded-lg border p-2.5 text-sm shadow-xs",
                        dragging === person.id && "opacity-50",
                      )}
                    >
                      <div className="flex items-start gap-1">
                        <GripVertical
                          className="text-muted-foreground/60 mt-0.5 size-3.5 shrink-0 cursor-grab"
                          aria-hidden
                        />
                        <Link
                          href={`/people/${person.id}`}
                          className="min-w-0 flex-1 truncate font-medium hover:underline"
                        >
                          {person.full_name}
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="-my-1 size-6"
                              aria-label={`Move ${person.full_name}`}
                            >
                              <MoreHorizontal aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Move to</DropdownMenuLabel>
                            {ALL_STAGES.map((stage) => (
                              <DropdownMenuItem
                                key={stage}
                                disabled={stage === person.stage}
                                onSelect={() => move(person.id, stage)}
                              >
                                {labelFor(STAGE_LABELS, stage)}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <span className="text-muted-foreground truncate pl-4.5 text-xs">
                        {[person.title, person.company?.name]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      <div className="flex flex-wrap gap-1 pl-4.5">
                        {person.is_recommended && !person.do_not_contact ? (
                          <Badge className="px-1.5 text-[10px]">
                            <Star aria-hidden /> Top pick
                          </Badge>
                        ) : null}
                        {person.role_type ? (
                          <Badge
                            variant="secondary"
                            className="px-1.5 text-[10px]"
                          >
                            {labelFor(ROLE_TYPE_LABELS, person.role_type)}
                          </Badge>
                        ) : null}
                        {person.stage === "closed" ? (
                          <Badge
                            variant="outline"
                            className="px-1.5 text-[10px]"
                          >
                            Closed
                          </Badge>
                        ) : null}
                        {person.do_not_contact ? (
                          <Badge
                            variant="destructive"
                            className="px-1.5 text-[10px]"
                          >
                            <Ban aria-hidden /> Do not contact
                          </Badge>
                        ) : null}
                        {person.is_sample ? (
                          <Badge
                            variant="outline"
                            className="px-1.5 text-[10px]"
                          >
                            Sample
                          </Badge>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
                {cards.length === 0 ? (
                  <p className="text-muted-foreground px-1 py-4 text-center text-xs">
                    Nobody here yet
                  </p>
                ) : null}
                {cards.length > COLUMN_LIMIT ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setExpanded((current) => ({
                        ...current,
                        [column.id]: !current[column.id],
                      }))
                    }
                  >
                    {expanded[column.id]
                      ? "Show fewer"
                      : `Show all ${cards.length}`}
                  </Button>
                ) : null}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
