"use client";

import { Briefcase, Check, FlaskConical, Loader2, Send } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  markHandled,
  sendReply,
  setStage,
  simulateReply,
} from "@/lib/actions/inbox";

interface ReplyPanelProps {
  threadId: string;
  personId: string;
  personFirstName: string;
  suggestedReply: string | null;
  needsAttention: boolean;
  canReply: boolean;
  stage: string;
  isSample: boolean;
  hasInbound: boolean;
}

const SAMPLE_REPLIES = [
  "Thanks for reaching out! Happy to chat. Does Thursday afternoon work?",
  "I'd be glad to refer you. Can you send me your resume?",
  "Thanks, but we're on a hiring freeze until next quarter. Reach out again then.",
  "Please remove me from your list.",
];

export function ReplyPanel(props: ReplyPanelProps) {
  const [body, setBody] = useState(props.suggestedReply ?? "");
  const [simulated, setSimulated] = useState(SAMPLE_REPLIES[0]!);
  const [pending, startTransition] = useTransition();

  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.error ?? "Something went wrong.");
      else toast.success(success);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {props.canReply && props.hasInbound ? (
        <div className="bg-card flex flex-col gap-2 rounded-xl border p-4">
          <Label htmlFor="reply-body">
            Your reply to {props.personFirstName}
          </Label>
          <Textarea
            id="reply-body"
            rows={7}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write a reply…"
          />
          {props.suggestedReply ? (
            <p className="text-muted-foreground text-xs">
              Suggested by LeadX. Edit it so it sounds like you.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={pending || !body.trim()}
              onClick={() =>
                run(
                  () => sendReply(props.threadId, { body }),
                  props.isSample
                    ? "Reply simulated (sample person)"
                    : "Reply sent",
                )
              }
            >
              {pending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Send aria-hidden />
              )}{" "}
              Send reply
            </Button>
            {props.needsAttention ? (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(() => markHandled(props.threadId), "Marked as handled")
                }
              >
                <Check aria-hidden /> Mark handled
              </Button>
            ) : null}
            {!["interview", "offer"].includes(props.stage) ? (
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  run(
                    () => setStage(props.personId, "interview"),
                    "Moved to Interview",
                  )
                }
              >
                <Briefcase aria-hidden /> Got an interview
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {props.isSample ? (
        <div className="flex flex-col gap-2 rounded-xl border border-dashed p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <FlaskConical className="size-4" aria-hidden /> Try it: simulate a
            reply
          </p>
          <p className="text-muted-foreground text-xs">
            This is a sample person, so no real reply will arrive. Pretend they
            wrote back to see how LeadX sorts replies and suggests a response.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_REPLIES.map((reply) => (
              <button
                key={reply}
                type="button"
                onClick={() => setSimulated(reply)}
                className="hover:bg-accent rounded-full border px-2.5 py-1 text-left text-xs"
              >
                {reply.length > 40 ? `${reply.slice(0, 40)}…` : reply}
              </button>
            ))}
          </div>
          <Textarea
            aria-label="Simulated reply"
            rows={3}
            value={simulated}
            onChange={(event) => setSimulated(event.target.value)}
          />
          <div>
            <Button
              size="sm"
              variant="secondary"
              disabled={pending || !simulated.trim()}
              onClick={() =>
                run(
                  () => simulateReply(props.threadId, simulated),
                  "Simulated reply received",
                )
              }
            >
              Simulate reply
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
