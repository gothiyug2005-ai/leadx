"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveTone } from "@/lib/actions/profile";
import { cn } from "@/lib/utils";
import { TONES, type Tone } from "@/lib/validation/profile";

const TONE_DETAILS: Record<
  Tone,
  { label: string; description: string; example: string }
> = {
  formal: {
    label: "Formal",
    description:
      "Polished and respectful. Good for senior people and traditional industries.",
    example:
      "Dear Ms. Raman, I am writing to express my interest in the Frontend Engineer role…",
  },
  warm: {
    label: "Warm",
    description:
      "Friendly and human, still professional. Works for most people.",
    example:
      "Hi Priya, I came across your team's work on the new checkout and loved it…",
  },
  concise: {
    label: "Concise",
    description: "Short and direct. Busy people appreciate it.",
    example:
      "Hi Priya, I'm a frontend engineer applying for the role on your team. Could we…",
  },
};

interface ToneFormProps {
  initialTone: Tone;
  initialSample: string | null;
  submitLabel?: string;
  onSaved?: () => void;
}

export function ToneForm({
  initialTone,
  initialSample,
  submitLabel = "Save tone",
  onSaved,
}: ToneFormProps) {
  const [tone, setTone] = useState<Tone>(initialTone);
  const [sample, setSample] = useState(initialSample ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const result = await saveTone({ tone, writing_sample: sample });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Tone saved");
    onSaved?.();
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        role="radiogroup"
        aria-label="Writing tone"
        className="grid gap-3 sm:grid-cols-3"
      >
        {TONES.map((value) => {
          const details = TONE_DETAILS[value];
          const selected = tone === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTone(value)}
              className={cn(
                "hover:bg-accent/40 flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors",
                selected && "border-primary bg-accent/60 ring-primary ring-1",
              )}
            >
              <span className="font-medium">{details.label}</span>
              <span className="text-muted-foreground text-sm">
                {details.description}
              </span>
              <span className="text-muted-foreground text-xs italic">
                “{details.example}”
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="writing-sample">
          A sample of your own writing (optional)
        </Label>
        <Textarea
          id="writing-sample"
          rows={5}
          maxLength={3000}
          placeholder="Paste an email or message you wrote that sounds like you. LeadX will match your style."
          value={sample}
          onChange={(event) => setSample(event.target.value)}
        />
      </div>

      <div>
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </Button>
      </div>
    </div>
  );
}
