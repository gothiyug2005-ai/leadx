"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { UserRoundPlus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addPerson } from "@/lib/actions/people";

const formSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(200),
  title: z.string().max(160),
  email: z
    .string()
    .max(320)
    .refine(
      (value) =>
        value.trim() === "" || z.email().safeParse(value.trim()).success,
      "Enter a valid email address",
    ),
  linkedin_url: z
    .string()
    .max(2000)
    .refine(
      (value) => value.trim() === "" || /^https?:\/\/\S+$/i.test(value.trim()),
      "Enter a full link starting with https://",
    ),
  notes: z.string().max(2000),
});

type FormValues = z.infer<typeof formSchema>;

export function AddPersonDialog({ targetId }: { targetId: string }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, formState, reset } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      full_name: "",
      title: "",
      email: "",
      linkedin_url: "",
      notes: "",
    },
  });
  const errors = formState.errors;

  async function submit(values: FormValues) {
    setSaving(true);
    const result = await addPerson(targetId, values);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${values.full_name} added`);
    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserRoundPlus aria-hidden /> Add someone
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a person</DialogTitle>
          <DialogDescription>
            Someone you already know of at this company.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(submit)}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-name">Name</Label>
            <Input
              id="add-name"
              {...register("full_name")}
              aria-invalid={!!errors.full_name}
            />
            {errors.full_name ? (
              <p role="alert" className="text-destructive text-xs">
                {errors.full_name.message}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-title">Title (optional)</Label>
            <Input
              id="add-title"
              placeholder="Engineering Manager"
              {...register("title")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-email">Email (optional)</Label>
            <Input
              id="add-email"
              type="email"
              {...register("email")}
              aria-invalid={!!errors.email}
            />
            {errors.email ? (
              <p role="alert" className="text-destructive text-xs">
                {errors.email.message}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-link">Profile link (optional)</Label>
            <Input
              id="add-link"
              placeholder="https://"
              {...register("linkedin_url")}
              aria-invalid={!!errors.linkedin_url}
            />
            {errors.linkedin_url ? (
              <p role="alert" className="text-destructive text-xs">
                {errors.linkedin_url.message}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-notes">Notes (optional)</Label>
            <Textarea id="add-notes" rows={2} {...register("notes")} />
          </div>
          <div>
            <Button type="submit" disabled={saving}>
              {saving ? "Adding…" : "Add person"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
