"use client";

import {
  Check,
  CircleAlert,
  CircleCheck,
  Copy,
  ExternalLink,
  Loader2,
  Minimize2,
  Pilcrow,
  Smile,
  Sparkles,
  Target,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { SampleNotice } from "@/components/profile/sample-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { SendDialog, type SendInfo } from "./send-dialog";
import {
  generateDrafts,
  markCopied,
  rewriteDraft,
  saveDraft,
  selectDraft,
} from "@/lib/actions/writer";
import { checkMessage } from "@/lib/writer/quality";
import {
  ANGLE_LABELS,
  MESSAGE_TYPES,
  RULES,
  type Angle,
  type MessageType,
} from "@/lib/writer/rules";
import { cn } from "@/lib/utils";

export interface ComposerDraft {
  id: string;
  type: string;
  angle: string | null;
  subject: string | null;
  body: string;
  status: string;
  is_selected: boolean;
  is_sample: boolean;
}

interface ComposerProps {
  personId: string;
  recipientFirstName: string;
  drafts: ComposerDraft[];
  /** The user's own material, so claims can be checked live while typing. */
  sourceText: string;
  linkedinUrl: string | null;
  sendInfo: SendInfo;
  aiSample: boolean;
}

type Edits = Record<string, { subject: string; body: string }>;

/** The paragraph that makes each draft different: its angle, not the shared intro. */
function draftPreview(body: string): string {
  const paragraphs = body.split(/\n{2,}/);
  return paragraphs.length > 4
    ? (paragraphs[2] ?? body)
    : (paragraphs[1] ?? body);
}

function isMessageType(value: string): value is MessageType {
  return (MESSAGE_TYPES as readonly string[]).includes(value);
}

export function Composer(props: ComposerProps) {
  const initialType =
    props.drafts[0] && isMessageType(props.drafts[0].type)
      ? props.drafts[0].type
      : "cold_email";
  const [type, setType] = useState<MessageType>(initialType);
  const [activeId, setActiveId] = useState<string | null>(
    (props.drafts.find((draft) => draft.is_selected) ?? props.drafts[0])?.id ??
      null,
  );
  const [edits, setEdits] = useState<Edits>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const drafts = props.drafts.filter((draft) => draft.type === type);
  const active =
    drafts.find((draft) => draft.id === activeId) ??
    drafts.find((draft) => draft.is_selected) ??
    drafts[0] ??
    null;
  const current = active
    ? (edits[active.id] ?? { subject: active.subject ?? "", body: active.body })
    : null;
  const dirty = Boolean(
    active &&
    edits[active.id] &&
    (edits[active.id]!.body !== active.body ||
      edits[active.id]!.subject !== (active.subject ?? "")),
  );
  const rules = RULES[type];

  // The React compiler memoises this; it re-checks as the user types.
  const quality = current
    ? checkMessage({
        type,
        subject: rules.hasSubject ? current.subject : null,
        body: current.body,
        sourceText: props.sourceText,
      })
    : null;
  const paragraphs = current
    ? current.body
        .split(/\n{2,}/)
        .map((text) => text.trim())
        .filter(Boolean)
    : [];

  function setField(field: "subject" | "body", value: string) {
    if (!active || !current) return;
    setEdits((previous) => ({
      ...previous,
      [active.id]: { ...current, [field]: value },
    }));
  }

  function run(label: string, task: () => Promise<void>) {
    setBusy(label);
    startTransition(async () => {
      try {
        await task();
      } finally {
        setBusy(null);
      }
    });
  }

  function write() {
    run("write", async () => {
      const result = await generateDrafts(props.personId, type);
      if (!result.ok) toast.error(result.error);
      else {
        setEdits({});
        setActiveId(null);
        toast.success("3 drafts ready. Pick one and make it yours.");
      }
    });
  }

  function save() {
    if (!active || !current) return;
    run("save", async () => {
      const result = await saveDraft(active.id, {
        subject: rules.hasSubject ? current.subject : null,
        body: current.body,
      });
      if (!result.ok) toast.error(result.error);
      else {
        // Keep showing what was saved; it matches the refreshed draft, so it stops counting as unsaved.
        toast.success("Draft saved");
      }
    });
  }

  function rewrite(
    action: "shorten" | "warmer" | "more_specific" | "regenerate_paragraph",
    paragraphIndex?: number,
  ) {
    if (!active || !current) return;
    run(action, async () => {
      const result = await rewriteDraft(
        active.id,
        action,
        {
          subject: rules.hasSubject ? current.subject : null,
          body: current.body,
        },
        paragraphIndex,
      );
      if (!result.ok) toast.error(result.error);
      else {
        // The server saved the rewrite; show it straight away instead of waiting for the refresh.
        setEdits((previous) => ({
          ...previous,
          [active.id]: {
            subject: result.data.subject ?? "",
            body: result.data.body,
          },
        }));
      }
    });
  }

  function choose(id: string) {
    setActiveId(id);
    startTransition(async () => {
      await selectDraft(id);
    });
  }

  async function copy() {
    if (!active || !current) return;
    try {
      await navigator.clipboard.writeText(current.body);
    } catch {
      toast.error("Could not copy. Select the text and copy it yourself.");
      return;
    }
    run("copy", async () => {
      const result = await markCopied(active.id, {
        subject: null,
        body: current.body,
      });
      if (!result.ok) toast.error(result.error);
      else
        toast.success("Copied. Paste it into LinkedIn and send it yourself.");
    });
  }

  const limitText = rules.maxChars
    ? `${quality?.chars ?? 0} / ${rules.maxChars} characters`
    : `${quality?.words ?? 0} / ${rules.maxWords} words`;
  const overLimit = Boolean(
    quality?.issues.some((issue) => issue.code === "too_long"),
  );

  return (
    <Card className="gap-4">
      <CardHeader className="gap-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4" aria-hidden /> Write to{" "}
          {props.recipientFirstName}
        </CardTitle>
        <div
          role="radiogroup"
          aria-label="Message type"
          className="flex flex-wrap gap-1.5"
        >
          {MESSAGE_TYPES.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={type === value}
              onClick={() => setType(value)}
              className={cn(
                "hover:bg-accent rounded-full border px-3 py-1 text-xs transition-colors",
                type === value &&
                  "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              {RULES[value].label}
            </button>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">{rules.description}</p>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {props.aiSample ? (
          <SampleNotice>
            The AI is not connected yet, so drafts are built from templates
            using your real profile and research. Edit freely.
          </SampleNotice>
        ) : null}

        {!active || !current ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-4">
            <p className="text-muted-foreground text-sm">
              LeadX writes 3 versions, each from a different angle, using only
              what is true about you and what we found about them.
            </p>
            <Button onClick={write} disabled={busy !== null}>
              {busy === "write" ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Sparkles aria-hidden />
              )}
              {busy === "write" ? "Writing…" : "Write 3 drafts"}
            </Button>
          </div>
        ) : (
          <>
            <div
              role="tablist"
              aria-label="Drafts"
              className="grid gap-2 sm:grid-cols-3"
            >
              {drafts.map((draft, index) => {
                const label =
                  draft.angle && draft.angle in ANGLE_LABELS
                    ? ANGLE_LABELS[draft.angle as Angle]
                    : `Draft ${index + 1}`;
                const selected = draft.id === active.id;
                return (
                  <button
                    key={draft.id}
                    role="tab"
                    aria-selected={selected}
                    onClick={() => choose(draft.id)}
                    className={cn(
                      "hover:bg-accent/50 flex flex-col items-start gap-1 rounded-lg border p-2.5 text-left text-xs transition-colors",
                      selected && "border-primary bg-accent/60",
                    )}
                  >
                    <span className="flex items-center gap-1 font-medium">
                      {selected ? (
                        <Check className="size-3" aria-hidden />
                      ) : null}
                      {label}
                    </span>
                    <span className="text-muted-foreground line-clamp-2">
                      {draftPreview(draft.body)}
                    </span>
                  </button>
                );
              })}
            </div>

            {rules.hasSubject ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="draft-subject">Subject</Label>
                <Input
                  id="draft-subject"
                  value={current.subject}
                  onChange={(event) => setField("subject", event.target.value)}
                  maxLength={200}
                />
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="draft-body">Message</Label>
                <span
                  className={cn(
                    "text-muted-foreground text-xs tabular-nums",
                    overLimit && "text-destructive font-medium",
                  )}
                >
                  {limitText}
                </span>
              </div>
              <Textarea
                id="draft-body"
                rows={type === "linkedin_note" ? 5 : 12}
                value={current.body}
                onChange={(event) => setField("body", event.target.value)}
                className="font-sans leading-relaxed"
              />
            </div>

            <div className="flex flex-wrap gap-2" aria-label="Quick edits">
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() => rewrite("shorten")}
              >
                {busy === "shorten" ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <Minimize2 aria-hidden />
                )}{" "}
                Shorten
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() => rewrite("warmer")}
              >
                {busy === "warmer" ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <Smile aria-hidden />
                )}{" "}
                Warmer
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() => rewrite("more_specific")}
              >
                {busy === "more_specific" ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <Target aria-hidden />
                )}{" "}
                More specific
              </Button>
              {paragraphs.length > 2 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy !== null}
                    >
                      {busy === "regenerate_paragraph" ? (
                        <Loader2 className="animate-spin" aria-hidden />
                      ) : (
                        <Pilcrow aria-hidden />
                      )}{" "}
                      Rewrite a paragraph
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="max-w-xs">
                    <DropdownMenuLabel>Which paragraph?</DropdownMenuLabel>
                    {paragraphs.map((paragraph, index) =>
                      index === 0 || index === paragraphs.length - 1 ? null : (
                        <DropdownMenuItem
                          key={`${index}-${paragraph.slice(0, 12)}`}
                          onSelect={() =>
                            rewrite("regenerate_paragraph", index)
                          }
                        >
                          <span className="line-clamp-2 text-xs">
                            {paragraph}
                          </span>
                        </DropdownMenuItem>
                      ),
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>

            {quality ? (
              <div
                className="flex flex-col gap-2 rounded-lg border p-3"
                aria-live="polite"
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  {quality.issues.length === 0 ? (
                    <CircleCheck
                      className="size-4 text-emerald-600 dark:text-emerald-400"
                      aria-hidden
                    />
                  ) : (
                    <CircleAlert
                      className="size-4 text-amber-600 dark:text-amber-400"
                      aria-hidden
                    />
                  )}
                  Quality check
                  <Badge
                    variant={quality.score >= 80 ? "secondary" : "outline"}
                    className="ml-auto tabular-nums"
                  >
                    {quality.score}/100
                  </Badge>
                </div>
                {quality.issues.length === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    Clear ask, right length, nothing generic. Looks good.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1 text-xs">
                    {quality.issues.map((issue) => (
                      <li
                        key={`${issue.code}-${issue.message}`}
                        className={cn(
                          "flex gap-1.5",
                          issue.severity === "error"
                            ? "text-destructive"
                            : "text-muted-foreground",
                        )}
                      >
                        <span aria-hidden>•</span>
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              {dirty ? (
                <Button
                  variant="secondary"
                  onClick={save}
                  disabled={busy !== null}
                >
                  {busy === "save" ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : null}{" "}
                  Save draft
                </Button>
              ) : null}
              {rules.channel === "linkedin" ? (
                <>
                  <Button
                    onClick={() => void copy()}
                    disabled={busy !== null || overLimit}
                  >
                    <Copy aria-hidden />{" "}
                    {active.status === "copied" ? "Copy again" : "Copy message"}
                  </Button>
                  {props.linkedinUrl ? (
                    <Button asChild variant="outline">
                      <a
                        href={props.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                      >
                        Open profile <ExternalLink aria-hidden />
                      </a>
                    </Button>
                  ) : null}
                  <span className="text-muted-foreground text-xs">
                    LeadX never sends LinkedIn messages for you.
                  </span>
                </>
              ) : (
                <SendDialog
                  messageId={active.id}
                  canFollowUp={
                    type === "cold_email" || type === "referral_request"
                  }
                  subject={current.subject}
                  body={current.body}
                  issues={quality?.issues ?? []}
                  info={props.sendInfo}
                  disabled={busy !== null}
                />
              )}
              <Button
                variant="ghost"
                className="ml-auto"
                onClick={write}
                disabled={busy !== null}
              >
                {busy === "write" ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <Sparkles aria-hidden />
                )}{" "}
                New drafts
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
