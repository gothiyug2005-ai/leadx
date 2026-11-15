"use client";

import {
  CircleAlert,
  CircleCheck,
  CircleHelp,
  CircleX,
  Loader2,
  Mail,
  Pencil,
  Search,
  ShieldCheck,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import {
  acceptRiskyEmail,
  findEmailAction,
  setEmail,
} from "@/lib/actions/enrichment";

interface ContactCardProps {
  personId: string;
  email: string | null;
  status: string;
  source: string | null;
  confidence: number | null;
  riskAccepted: boolean;
  error: string | null;
  doNotContact: boolean;
}

const STATUS = {
  valid: {
    label: "Verified",
    icon: CircleCheck,
    tone: "text-emerald-600 dark:text-emerald-400",
  },
  risky: {
    label: "Risky",
    icon: CircleAlert,
    tone: "text-amber-600 dark:text-amber-400",
  },
  unknown: {
    label: "Not verified",
    icon: CircleHelp,
    tone: "text-muted-foreground",
  },
  invalid: { label: "Invalid", icon: CircleX, tone: "text-destructive" },
  not_found: {
    label: "Not found",
    icon: CircleX,
    tone: "text-muted-foreground",
  },
} as const;

export function ContactCard(props: ContactCardProps) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(props.email ?? "");
  const status = STATUS[props.status as keyof typeof STATUS] ?? STATUS.unknown;
  const Icon = status.icon;
  const sendable =
    props.status === "valid" ||
    ((props.status === "risky" || props.status === "unknown") &&
      props.riskAccepted);

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="size-4" aria-hidden /> Contact
        </CardTitle>
        <CardDescription>
          Only verified addresses can be emailed without your confirmation.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {editing ? (
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              run(async () => {
                const result = await setEmail(props.personId, draft);
                if (result.ok) setEditing(false);
                return result;
              }, "Email saved and checked");
            }}
          >
            <Input
              type="email"
              aria-label="Email address"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="name@company.com"
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : props.email ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium break-all">{props.email}</span>
            <span className={`flex items-center gap-1 ${status.tone}`}>
              <Icon className="size-4" aria-hidden /> {status.label}
            </span>
            {props.source ? (
              <Badge variant="outline">via {props.source}</Badge>
            ) : null}
            {props.riskAccepted && props.status !== "valid" ? (
              <Badge variant="secondary">You confirmed this address</Badge>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground">
            {props.status === "not_found"
              ? "No email found yet. You can add one yourself."
              : "No email yet."}
          </p>
        )}

        {props.status === "risky" && !props.riskAccepted ? (
          <p className="text-amber-700 dark:text-amber-400">
            This company accepts mail for any address, so the address cannot be
            confirmed. It may bounce.
          </p>
        ) : null}
        {props.status === "invalid" ? (
          <p className="text-destructive">
            This address will bounce, so it cannot be emailed.
          </p>
        ) : null}
        {props.error ? (
          <p role="alert" className="text-destructive">
            {props.error}
          </p>
        ) : null}

        {!props.doNotContact && !editing ? (
          <div className="flex flex-wrap gap-2">
            {!props.email ||
            props.status === "invalid" ||
            props.status === "not_found" ? (
              <Button
                size="sm"
                onClick={() =>
                  run(
                    () => findEmailAction(props.personId),
                    "Email search finished",
                  )
                }
                disabled={pending}
              >
                {pending ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <Search aria-hidden />
                )}{" "}
                Find email
              </Button>
            ) : null}
            {props.email && props.status === "unknown" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  run(() => findEmailAction(props.personId), "Address checked")
                }
                disabled={pending}
              >
                <ShieldCheck aria-hidden /> Verify
              </Button>
            ) : null}
            {props.email &&
            (props.status === "risky" || props.status === "unknown") &&
            !props.riskAccepted ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  run(
                    () => acceptRiskyEmail(props.personId),
                    "You can email this address",
                  )
                }
                disabled={pending}
              >
                Use anyway
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(props.email ?? "");
                setEditing(true);
              }}
            >
              <Pencil aria-hidden /> {props.email ? "Change" : "Add email"}
            </Button>
          </div>
        ) : null}
        {sendable ? (
          <p className="text-muted-foreground text-xs">Ready to email.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
