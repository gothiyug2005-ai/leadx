"use client";

import { Loader2, RefreshCw, UserRoundSearch } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { findPeople } from "@/lib/actions/people";

export function FindPeopleButton({
  targetId,
  hasPeople,
}: {
  targetId: string;
  hasPeople: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [phase, setPhase] = useState("");

  function run() {
    setPhase("Searching for people…");
    // The ranking step usually takes longer; tell the user what is happening.
    const timer = setTimeout(
      () => setPhase("Ranking who can help most…"),
      2500,
    );
    startTransition(async () => {
      const result = await findPeople(targetId);
      clearTimeout(timer);
      setPhase("");
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { added, isSample } = result.data;
      toast.success(
        added === 0
          ? "No new people found this time."
          : `Found ${added} ${added === 1 ? "person" : "people"}${isSample ? " (sample data)" : ""}.`,
      );
    });
  }

  return (
    <Button
      onClick={run}
      disabled={pending}
      variant={hasPeople ? "outline" : "default"}
      aria-live="polite"
    >
      {pending ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : hasPeople ? (
        <RefreshCw aria-hidden />
      ) : (
        <UserRoundSearch aria-hidden />
      )}
      {pending
        ? phase || "Working…"
        : hasPeople
          ? "Find more people"
          : "Find people"}
    </Button>
  );
}
