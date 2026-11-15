"use client";

import { CalendarClock, CircleCheck, Loader2, Pencil, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  cancelFollowUp,
  editFollowUp,
  stopFollowUps,
} from "@/lib/actions/sequences";

interface FollowUp {
  id: string;
  sequence_step: number;
  subject: string | null;
  body: string;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
}

interface SequenceCardProps {
  sequence: {
    id: string;
    status: string;
    stop_reason: string | null;
    followUps: FollowUp[];
  };
  timeZone: string;
}

const STOP_REASONS: Record<string, string> = {
  replied: "They replied, so follow-ups stopped.",
  opted_out: "They asked not to be contacted.",
  bounced: "The email bounced.",
  manual: "You stopped the follow-ups.",
  suppressed: "The address is on your do-not-email list.",
  failed: "Sending failed.",
};

function when(value: string | null, timeZone: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function SequenceCard({ sequence, timeZone }: SequenceCardProps) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<FollowUp | null>(null);
  const [draft, setDraft] = useState({ subject: "", body: "" });
  if (sequence.followUps.length === 0) return null;
  const active = sequence.status === "active";

  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
    after?: () => void,
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.error ?? "Something went wrong.");
      else {
        toast.success(success);
        after?.();
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="size-4" aria-hidden /> Follow-ups
            {active ? (
              <Badge variant="secondary">Active</Badge>
            ) : (
              <Badge variant="outline">
                {sequence.status === "completed" ? "Done" : "Stopped"}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {active
              ? "These go out automatically unless they reply. Times are in your time zone."
              : (STOP_REASONS[sequence.stop_reason ?? ""] ??
                "All follow-ups have been sent.")}
          </CardDescription>
        </div>
        {active ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              run(() => stopFollowUps(sequence.id), "Follow-ups stopped")
            }
          >
            {pending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <X aria-hidden />
            )}{" "}
            Stop all
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3 text-sm">
          {sequence.followUps.map((followUp) => (
            <li
              key={followUp.id}
              className="flex flex-col gap-1 rounded-lg border p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  Follow-up {followUp.sequence_step}
                </span>
                {followUp.status === "scheduled" ? (
                  <Badge variant="outline">
                    {when(followUp.scheduled_at, timeZone)}
                  </Badge>
                ) : followUp.status === "sent" ? (
                  <Badge variant="secondary">
                    <CircleCheck aria-hidden /> Sent{" "}
                    {when(followUp.sent_at, timeZone)}
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    {followUp.status === "cancelled"
                      ? "Cancelled"
                      : followUp.status}
                  </Badge>
                )}
                {followUp.status === "scheduled" ? (
                  <span className="ml-auto flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setDraft({
                          subject: followUp.subject ?? "",
                          body: followUp.body,
                        });
                        setEditing(followUp);
                      }}
                    >
                      <Pencil aria-hidden /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () => cancelFollowUp(followUp.id),
                          "Follow-up cancelled",
                        )
                      }
                    >
                      Cancel
                    </Button>
                  </span>
                ) : null}
              </div>
              <p className="text-muted-foreground line-clamp-3 whitespace-pre-line">
                {followUp.body}
              </p>
            </li>
          ))}
        </ul>
      </CardContent>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit follow-up {editing?.sequence_step}</DialogTitle>
            <DialogDescription>
              It still goes out at{" "}
              {when(editing?.scheduled_at ?? null, timeZone)} unless they reply
              first.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="follow-up-subject">Subject</Label>
              <Input
                id="follow-up-subject"
                value={draft.subject}
                onChange={(event) =>
                  setDraft({ ...draft, subject: event.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="follow-up-body">Message</Label>
              <Textarea
                id="follow-up-body"
                rows={8}
                value={draft.body}
                onChange={(event) =>
                  setDraft({ ...draft, body: event.target.value })
                }
              />
            </div>
            <div>
              <Button
                disabled={pending}
                onClick={() =>
                  editing &&
                  run(
                    () => editFollowUp(editing.id, draft),
                    "Follow-up updated",
                    () => setEditing(null),
                  )
                }
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
