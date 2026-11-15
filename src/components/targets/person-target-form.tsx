"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createPersonTarget } from "@/lib/actions/targets";
import { normalizeDomain } from "@/lib/web/domain";

const formSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(200),
  title: z.string().max(160),
  company_name: z.string().trim().min(1, "Company is required").max(200),
  company_domain: z
    .string()
    .max(253)
    .refine(
      (value) => value.trim() === "" || normalizeDomain(value) !== null,
      "Enter a website like acme.com",
    ),
  linkedin_url: z
    .string()
    .max(2000)
    .refine(
      (value) => value.trim() === "" || /^https?:\/\/\S+$/i.test(value.trim()),
      "Enter a full link starting with https://",
    ),
  role_title: z.string().max(160),
  notes: z.string().max(2000),
});

type FormValues = z.infer<typeof formSchema>;

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-destructive text-xs">
      {message}
    </p>
  ) : null;
}

export function PersonTargetForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      full_name: "",
      title: "",
      company_name: "",
      company_domain: "",
      linkedin_url: "",
      role_title: "",
      notes: "",
    },
  });
  const errors = formState.errors;

  async function submit(values: FormValues) {
    setSaving(true);
    const result = await createPersonTarget(values);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Target created");
    router.push(`/targets/${result.data.id}`);
  }

  return (
    <form
      onSubmit={handleSubmit(submit)}
      className="flex flex-col gap-5"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="person_name">Their name</Label>
          <Input
            id="person_name"
            placeholder="Priya Raman"
            {...register("full_name")}
            aria-invalid={!!errors.full_name}
          />
          <FieldError message={errors.full_name?.message} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="person_title">Their title (optional)</Label>
          <Input
            id="person_title"
            placeholder="Engineering Manager"
            {...register("title")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="person_company">Company</Label>
          <Input
            id="person_company"
            placeholder="Acme"
            {...register("company_name")}
            aria-invalid={!!errors.company_name}
          />
          <FieldError message={errors.company_name?.message} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="person_domain">Company website (optional)</Label>
          <Input
            id="person_domain"
            placeholder="acme.com"
            {...register("company_domain")}
            aria-invalid={!!errors.company_domain}
          />
          <FieldError message={errors.company_domain?.message} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="person_linkedin">Profile link (optional)</Label>
        <Input
          id="person_linkedin"
          placeholder="https://www.linkedin.com/in/…"
          {...register("linkedin_url")}
          aria-invalid={!!errors.linkedin_url}
        />
        <FieldError message={errors.linkedin_url?.message} />
        <p className="text-muted-foreground text-xs">
          Saved for your reference only. LeadX never reads or automates
          LinkedIn.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="person_role">
          Role you are interested in there (optional)
        </Label>
        <Input
          id="person_role"
          placeholder="Frontend Engineer"
          {...register("role_title")}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="person_notes">Notes (optional)</Label>
        <Textarea
          id="person_notes"
          rows={3}
          placeholder="How you know them, what you have in common…"
          {...register("notes")}
        />
      </div>
      <div>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Create target"}
        </Button>
      </div>
    </form>
  );
}
