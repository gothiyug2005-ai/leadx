"use client";

import {
  Archive,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  deleteTarget,
  setTargetStatus,
  updateTarget,
} from "@/lib/actions/targets";

import { TargetForm, type TargetFormInitial } from "./target-form";

interface TargetActionsProps {
  id: string;
  kind: "job_posting" | "company" | "person";
  status: string;
  initial: TargetFormInitial;
}

export function TargetActions({
  id,
  kind,
  status,
  initial,
}: TargetActionsProps) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  function changeStatus(next: "active" | "paused" | "archived") {
    startTransition(async () => {
      const result = await setTargetStatus(id, next);
      if (!result.ok) toast.error(result.error);
      else
        toast.success(
          next === "active"
            ? "Target resumed"
            : next === "paused"
              ? "Target paused"
              : "Target archived",
        );
    });
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil aria-hidden /> Edit
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              aria-label="More actions"
              disabled={pending}
            >
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {status === "active" ? (
              <DropdownMenuItem onSelect={() => changeStatus("paused")}>
                <Pause aria-hidden /> Pause
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => changeStatus("active")}>
                <Play aria-hidden /> Resume
              </DropdownMenuItem>
            )}
            {status !== "archived" ? (
              <DropdownMenuItem onSelect={() => changeStatus("archived")}>
                <Archive aria-hidden /> Archive
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setConfirmDelete(true)}
            >
              <Trash2 aria-hidden /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit target</DialogTitle>
            <DialogDescription>
              Changes apply to this target and its company.
            </DialogDescription>
          </DialogHeader>
          <TargetForm
            kind={kind === "job_posting" ? "job_posting" : "company"}
            showJobFields={kind === "job_posting"}
            initial={initial}
            submitLabel="Save changes"
            onSubmit={async (values) => {
              const result = await updateTarget(id, values);
              if (!result.ok) return { ok: false, error: result.error };
              toast.success("Target updated");
              setEditing(false);
              return { ok: true };
            }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this target?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the target and everyone found for it, with their
              drafts and history. It cannot be undone. To keep the history,
              archive it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={() => startTransition(() => deleteTarget(id))}
            >
              Delete target
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
