"use client";

import { Ban, MoreHorizontal, Star, StarOff, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  neverContact,
  removePerson,
  setRecommended,
} from "@/lib/actions/people";

interface PersonMenuProps {
  id: string;
  name: string;
  recommended: boolean;
  doNotContact: boolean;
}

export function PersonMenu({
  id,
  name,
  recommended,
  doNotContact,
}: PersonMenuProps) {
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<"never" | "remove" | null>(null);

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
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`More actions for ${name}`}
            disabled={pending}
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!doNotContact ? (
            recommended ? (
              <DropdownMenuItem
                onSelect={() =>
                  run(() => setRecommended(id, false), "Removed from top picks")
                }
              >
                <StarOff aria-hidden /> Remove from top picks
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onSelect={() =>
                  run(() => setRecommended(id, true), "Added to top picks")
                }
              >
                <Star aria-hidden /> Make a top pick
              </DropdownMenuItem>
            )
          ) : null}
          {!doNotContact ? (
            <DropdownMenuItem onSelect={() => setConfirm("never")}>
              <Ban aria-hidden /> Never email again
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirm("remove")}
          >
            <Trash2 aria-hidden /> Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "never"
                ? `Never email ${name} again?`
                : `Remove ${name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "never"
                ? "LeadX will block every future email to this person, from any target, and cancel anything waiting to be sent to them."
                : "This removes them and any drafts for them from this target. It cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={() =>
                confirm === "never"
                  ? run(
                      () => neverContact(id),
                      `${name} will not be emailed again`,
                    )
                  : run(() => removePerson(id), `${name} removed`)
              }
            >
              {confirm === "never" ? "Never email again" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
