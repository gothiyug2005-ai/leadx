"use client";

import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SampleNotice } from "@/components/profile/sample-notice";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  generatePositioning,
  getStoryQuestions,
  savePositioning,
} from "@/lib/actions/profile";
import type { StoryAnswer } from "@/lib/ai/schemas/story";
import { cn } from "@/lib/utils";

interface Question {
  id: string;
  question: string;
  hint: string;
}

interface StoryHelperProps {
  savedAnswers: StoryAnswer[];
  savedStatement: string | null;
  submitLabel?: string;
  onSaved?: () => void;
}

export function StoryHelper({
  savedAnswers,
  savedStatement,
  submitLabel = "Save statement",
  onSaved,
}: StoryHelperProps) {
  const [questions, setQuestions] = useState<Question[] | null>(
    savedAnswers.length
      ? savedAnswers.map((entry) => ({
          id: entry.id,
          question: entry.question,
          hint: "",
        }))
      : null,
  );
  const [answers, setAnswers] = useState<Record<string, string>>(
    Object.fromEntries(savedAnswers.map((entry) => [entry.id, entry.answer])),
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSample, setIsSample] = useState(false);
  const [writing, setWriting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statement, setStatement] = useState(savedStatement ?? "");
  const [options, setOptions] = useState<string[]>([]);

  async function fetchQuestions() {
    const result = await getStoryQuestions();
    if (!result.ok) {
      setLoadError(result.error);
      return;
    }
    setIsSample(result.data.isSample);
    setQuestions(result.data.questions);
  }

  function reloadQuestions() {
    setLoadError(null);
    setQuestions(null);
    void fetchQuestions();
  }

  useEffect(() => {
    // Saved answers mean the questions are already known; otherwise ask the AI once.
    if (savedAnswers.length) return;
    let cancelled = false;
    void getStoryQuestions().then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      setIsSample(result.data.isSample);
      setQuestions(result.data.questions);
    });
    return () => {
      cancelled = true;
    };
  }, [savedAnswers.length]);

  const answered = Object.values(answers).filter((value) =>
    value.trim(),
  ).length;

  async function write() {
    if (!questions) return;
    setWriting(true);
    const payload: StoryAnswer[] = questions.map((q) => ({
      id: q.id,
      question: q.question,
      answer: (answers[q.id] ?? "").trim(),
    }));
    const result = await generatePositioning(payload);
    setWriting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setIsSample(result.data.isSample);
    setStatement(result.data.statement);
    setOptions([result.data.statement, ...result.data.alternatives]);
  }

  async function save() {
    setSaving(true);
    const result = await savePositioning(statement);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Positioning statement saved");
    onSaved?.();
  }

  return (
    <div className="flex flex-col gap-6">
      {isSample ? <SampleNotice /> : null}

      {loadError ? (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-destructive text-sm">
            {loadError}
          </p>
          <Button variant="outline" size="sm" onClick={reloadQuestions}>
            Try again
          </Button>
        </div>
      ) : null}

      {!questions && !loadError ? (
        <div
          className="flex flex-col gap-4"
          aria-busy
          aria-label="Preparing questions"
        >
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-20 w-full" />
            </div>
          ))}
        </div>
      ) : null}

      {questions ? (
        <div className="flex flex-col gap-5">
          {questions.map((q, index) => (
            <div key={q.id} className="flex flex-col gap-1.5">
              <Label htmlFor={`story-${q.id}`}>
                {index + 1}. {q.question}
              </Label>
              <Textarea
                id={`story-${q.id}`}
                rows={3}
                maxLength={1000}
                placeholder={q.hint ? `For example: ${q.hint}` : undefined}
                value={answers[q.id] ?? ""}
                onChange={(event) =>
                  setAnswers((current) => ({
                    ...current,
                    [q.id]: event.target.value,
                  }))
                }
              />
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => void write()}
              disabled={writing || answered < 2}
            >
              {writing ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Sparkles aria-hidden />
              )}
              {statement ? "Rewrite my statement" : "Write my statement"}
            </Button>
            {answered < 2 ? (
              <span className="text-muted-foreground text-sm">
                Answer at least two questions.
              </span>
            ) : null}
            {savedAnswers.length ? (
              <Button variant="ghost" size="sm" onClick={reloadQuestions}>
                <RefreshCw aria-hidden /> New questions
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {options.length > 1 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            Pick a version, then edit it below
          </p>
          <div className="flex flex-col gap-2">
            {options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setStatement(option)}
                className={cn(
                  "hover:bg-accent/50 rounded-lg border p-3 text-left text-sm transition-colors",
                  statement === option && "border-primary bg-accent/60",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {statement || savedStatement ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="positioning">Your positioning statement</Label>
          <Textarea
            id="positioning"
            rows={3}
            maxLength={400}
            value={statement}
            onChange={(event) => setStatement(event.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            Two sentences at most. LeadX uses this as the backbone of every
            message.
          </p>
          <div>
            <Button
              onClick={() => void save()}
              disabled={saving || statement.trim().length < 10}
            >
              {saving ? "Saving…" : submitLabel}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
