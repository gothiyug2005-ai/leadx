"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveSendingLimit } from "@/lib/actions/profile";

export function SendingLimitForm({ initialCap }: { initialCap: number }) {
  const [cap, setCap] = useState(String(initialCap));
  const [saving, setSaving] = useState(false);
  const value = Number(cap);
  const valid = Number.isInteger(value) && value >= 1 && value <= 40;

  async function save() {
    setSaving(true);
    const result = await saveSendingLimit(value);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Sending limit saved");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="daily-cap">Outreach emails per day</Label>
        <Input
          id="daily-cap"
          type="number"
          inputMode="numeric"
          min={1}
          max={40}
          className="w-28"
          value={cap}
          onChange={(event) => setCap(event.target.value)}
          aria-invalid={!valid}
        />
        <p className="text-muted-foreground text-xs">
          Between 1 and 40. Sending fewer, better emails protects your Gmail
          reputation. Replies to people who wrote back do not count.
        </p>
      </div>
      <div>
        <Button onClick={() => void save()} disabled={!valid || saving}>
          {saving ? "Saving…" : "Save limit"}
        </Button>
      </div>
    </div>
  );
}
