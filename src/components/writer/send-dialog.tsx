"use client";

import { CircleAlert, Loader2, Send } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { approveAndSend } from "@/lib/actions/sending";
import type { QualityIssue } from "@/lib/writer/quality";

export interface SendInfo {
  toEmail: string | null;
  emailReady: boolean;
  gmailEmail: string | null;
  isSamplePerson: boolean;
  remainingToday: number | null;
  dailyCap: number | null;
}

interface SendDialogProps {
  messageId: string;
  /** First emails can schedule follow-ups. */
  canFollowUp: boolean;
  subject: string;
  body: string;
  issues: QualityIssue[];
  info: SendInfo;
  /** Called before sending so unsaved edits are not lost. */
  disabled?: boolean;
}

export function SendDialog({
  messageId,
  canFollowUp,
  subject,
  body,
  issues,
  info,
  disabled,
}: SendDialogProps) {
  const [open, setOpen] = useState(false);
  const [followUps, setFollowUps] = useState(true);
  const [pending, startTransition] = useTransition();
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  const simulated = !info.gmailEmail && info.isSamplePerson;
  const needsGmail = !info.gmailEmail && !info.isSamplePerson;
  const capReached = info.remainingToday !== null && info.remainingToday <= 0;

  const blockers = [
    !info.toEmail ? "There is no email address for this person yet." : null,
    info.toEmail && !info.emailReady
      ? 'The address is not verified. Confirm it with "Use anyway" in the Contact card.'
      : null,
    needsGmail ? "Connect Gmail in Settings to send real email." : null,
    capReached
      ? `You have reached today's limit of ${info.dailyCap} outreach emails.`
      : null,
    ...errors.map((issue) => issue.message),
  ].filter((value): value is string => Boolean(value));

  function send() {
    startTransition(async () => {
      const result = await approveAndSend(messageId, {
        subject,
        body,
        followUps: canFollowUp && followUps,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      toast.success(
        result.data.simulated
          ? `Simulated send to ${result.data.to} (sample person, nothing was emailed)`
          : `Sent to ${result.data.to}`,
      );
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled}>
          <Send aria-hidden /> Review and send
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Review before sending</DialogTitle>
          <DialogDescription>
            This is exactly what will be sent
            {info.gmailEmail ? ` from ${info.gmailEmail}` : ""}. Nothing goes
            out until you press Send.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">To</dt>
          <dd className="break-all">{info.toEmail ?? "No address"}</dd>
          <dt className="text-muted-foreground">Subject</dt>
          <dd>
            {subject || <span className="text-destructive">Missing</span>}
          </dd>
        </dl>
        <div className="bg-muted/40 max-h-64 overflow-y-auto rounded-lg border p-3 text-sm whitespace-pre-wrap">
          {body}
        </div>

        {blockers.length ? (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertDescription>
              <ul className="flex flex-col gap-1">
                {blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}
        {!blockers.length && warnings.length ? (
          <div className="text-muted-foreground flex flex-col gap-1 text-xs">
            <p className="text-foreground font-medium">Worth a second look:</p>
            <ul className="flex flex-col gap-0.5">
              {warnings.map((issue) => (
                <li key={issue.message}>• {issue.message}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {simulated && !blockers.length ? (
          <p className="text-muted-foreground text-xs">
            This is a sample person and Gmail is not connected, so LeadX will
            simulate the send. Nothing is emailed.
          </p>
        ) : null}
        {canFollowUp ? (
          <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
            <Checkbox
              checked={followUps}
              onCheckedChange={(value) => setFollowUps(value === true)}
              className="mt-0.5"
              aria-label="Follow up automatically"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">
                Follow up automatically if there is no reply
              </span>
              <span className="text-muted-foreground text-xs">
                Two short follow-ups on day 3 and day 7, on a weekday morning in
                their time zone. Any reply stops them, and you can edit or
                cancel them before they go.
              </span>
            </span>
          </label>
        ) : null}
        {info.remainingToday !== null && !capReached ? (
          <p className="text-muted-foreground text-xs">
            {info.remainingToday} of {info.dailyCap} outreach emails left today.
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Keep editing
          </Button>
          <Button onClick={send} disabled={pending || blockers.length > 0}>
            {pending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Send aria-hidden />
            )}
            {pending ? "Sending…" : simulated ? "Simulate send" : "Send now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
