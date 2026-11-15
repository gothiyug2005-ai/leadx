"use client";

import { CircleAlert, CircleCheck, Loader2, Mail, Unplug } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { disconnectGmail } from "@/lib/actions/sending";

const RESULTS: Record<string, { ok: boolean; text: string }> = {
  connected: {
    ok: true,
    text: "Gmail connected. LeadX can now send from your address.",
  },
  denied: {
    ok: false,
    text: "Gmail was not connected because access was declined.",
  },
  invalid_state: {
    ok: false,
    text: "That connection attempt expired. Please try again.",
  },
  missing_scope: {
    ok: false,
    text: "LeadX needs permission to send email. Tick the Gmail boxes when Google asks.",
  },
  no_refresh_token: {
    ok: false,
    text: "Google did not grant ongoing access. Please try again.",
  },
  not_configured: {
    ok: false,
    text: "Gmail is not set up on this server yet (see docs/SETUP.md).",
  },
  error: {
    ok: false,
    text: "Something went wrong connecting Gmail. Please try again.",
  },
  unavailable: { ok: false, text: "Google did not respond. Please try again." },
  invalid_grant: {
    ok: false,
    text: "Google rejected the connection. Please try again.",
  },
};

/** Shows the outcome when Google sends the user back to Settings. */
export function GmailResultToast() {
  const params = useSearchParams();
  const shown = useRef(false);
  const result = params.get("gmail");
  useEffect(() => {
    if (!result || shown.current) return;
    shown.current = true;
    const outcome = RESULTS[result] ?? RESULTS.error!;
    if (outcome.ok) toast.success(outcome.text);
    else toast.error(outcome.text);
  }, [result]);
  return null;
}

interface GmailCardProps {
  configured: boolean;
  connection: {
    email: string;
    status: string;
    last_error: string | null;
  } | null;
}

export function GmailCard({ configured, connection }: GmailCardProps) {
  const [pending, startTransition] = useTransition();
  const connected = connection?.status === "connected";

  return (
    <div className="flex flex-col gap-4 text-sm">
      {connected ? (
        <div className="flex flex-wrap items-center gap-2">
          <CircleCheck
            className="size-4 text-emerald-600 dark:text-emerald-400"
            aria-hidden
          />
          <span>
            Sending as <span className="font-medium">{connection.email}</span>
          </span>
        </div>
      ) : connection ? (
        <div className="text-destructive flex items-start gap-2">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Gmail needs reconnecting
            {connection.last_error ? `: ${connection.last_error}` : "."} Nothing
            will send until you do.
          </span>
        </div>
      ) : (
        <p className="text-muted-foreground">
          Connect Gmail to send emails from your own address. LeadX asks Google
          for permission to send email and to read replies to your outreach,
          nothing else, and you can disconnect at any time.
        </p>
      )}

      {!configured ? (
        <p className="text-muted-foreground text-xs">
          Gmail is not set up on this server yet. The administrator needs to add
          the Google client and an encryption key (see docs/SETUP.md). Until
          then, sends to sample people are simulated.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {configured && !connected ? (
          <Button asChild>
            {/* A plain link: the OAuth flow needs a full page navigation to Google. */}
            <a href="/api/gmail/connect">
              <Mail aria-hidden />{" "}
              {connection ? "Reconnect Gmail" : "Connect Gmail"}
            </a>
          </Button>
        ) : null}
        {connection ? (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await disconnectGmail();
                if (!result.ok) toast.error(result.error);
                else toast.success("Gmail disconnected");
              })
            }
          >
            {pending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Unplug aria-hidden />
            )}{" "}
            Disconnect
          </Button>
        ) : null}
      </div>
    </div>
  );
}
