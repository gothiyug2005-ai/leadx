"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SENIORITIES } from "@/lib/ai/schemas/job";
import { splitList } from "@/lib/validation/profile";
import type { TargetFormInput } from "@/lib/validation/target";
import { normalizeDomain } from "@/lib/web/domain";

const SENIORITY_LABELS: Record<(typeof SENIORITIES)[number], string> = {
  intern: "Intern",
  entry: "Entry level",
  mid: "Mid level",
  senior: "Senior",
  staff: "Staff",
  principal: "Principal",
  manager: "Manager",
  director: "Director",
  executive: "Executive",
};

const formSchema = z.object({
  company_name: z.string().trim().min(1, "Company is required").max(200),
  company_domain: z
    .string()
    .max(253)
    .refine(
      (value) => value.trim() === "" || normalizeDomain(value) !== null,
      "Enter a website like acme.com",
    ),
  role_title: z.string().max(160),
  team: z.string().max(160),
  seniority: z.string(),
  location: z.string().max(160),
  must_have_skills: z.string().max(1000),
  nice_to_have_skills: z.string().max(1000),
  job_url: z
    .string()
    .max(2000)
    .refine(
      (value) => value.trim() === "" || /^https?:\/\/\S+$/i.test(value.trim()),
      "Enter a full link starting with https://",
    ),
  job_summary: z.string().max(1000),
});

type FormValues = z.infer<typeof formSchema>;

export interface TargetFormInitial {
  company_name: string;
  company_domain: string | null;
  role_title: string | null;
  team: string | null;
  seniority: string | null;
  location: string | null;
  must_have_skills: string[];
  nice_to_have_skills: string[];
  job_url: string | null;
  job_summary: string | null;
}

interface TargetFormProps {
  kind: "job_posting" | "company";
  initial?: Partial<TargetFormInitial>;
  /** Full posting text, carried through to the saved target but not edited here. */
  jobText?: string | null;
  submitLabel: string;
  /** Show the job-posting fields (link, summary, skills). */
  showJobFields?: boolean;
  onSubmit: (
    values: TargetFormInput,
  ) => Promise<{ ok: boolean; error?: string }>;
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-destructive text-xs">
      {message}
    </p>
  ) : null;
}

export function TargetForm({
  kind,
  initial = {},
  jobText,
  submitLabel,
  showJobFields = true,
  onSubmit,
}: TargetFormProps) {
  const [saving, setSaving] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      company_name: initial.company_name ?? "",
      company_domain: initial.company_domain ?? "",
      role_title: initial.role_title ?? "",
      team: initial.team ?? "",
      seniority: initial.seniority ?? "",
      location: initial.location ?? "",
      must_have_skills: (initial.must_have_skills ?? []).join(", "),
      nice_to_have_skills: (initial.nice_to_have_skills ?? []).join(", "),
      job_url: initial.job_url ?? "",
      job_summary: initial.job_summary ?? "",
    },
  });
  const { register, handleSubmit, formState, setValue, control } = form;
  const errors = formState.errors;
  const seniority = useWatch({ control, name: "seniority" });

  async function submit(values: FormValues) {
    setSaving(true);
    const result = await onSubmit({
      kind,
      company_name: values.company_name,
      company_domain: values.company_domain,
      role_title: values.role_title,
      team: values.team,
      seniority: (SENIORITIES as readonly string[]).includes(values.seniority)
        ? (values.seniority as (typeof SENIORITIES)[number])
        : null,
      location: values.location,
      must_have_skills: splitList(values.must_have_skills),
      nice_to_have_skills: splitList(values.nice_to_have_skills),
      job_url: values.job_url,
      job_text: jobText ?? null,
      job_summary: values.job_summary,
    });
    setSaving(false);
    if (!result.ok && result.error) toast.error(result.error);
  }

  return (
    <form
      onSubmit={handleSubmit(submit)}
      className="flex flex-col gap-5"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="company_name">Company</Label>
          <Input
            id="company_name"
            placeholder="Acme"
            {...register("company_name")}
            aria-invalid={!!errors.company_name}
          />
          <FieldError message={errors.company_name?.message} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="company_domain">Website (optional)</Label>
          <Input
            id="company_domain"
            placeholder="acme.com"
            {...register("company_domain")}
            aria-invalid={!!errors.company_domain}
          />
          <FieldError message={errors.company_domain?.message} />
          <p className="text-muted-foreground text-xs">
            Helps LeadX find the right people and their emails.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="role_title">
            Role {showJobFields ? "" : "(optional)"}
          </Label>
          <Input
            id="role_title"
            placeholder="Frontend Engineer"
            {...register("role_title")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="team">Team (optional)</Label>
          <Input id="team" placeholder="Payments" {...register("team")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="seniority">Seniority</Label>
          <Select
            value={seniority || "none"}
            onValueChange={(value) =>
              setValue("seniority", value === "none" ? "" : value)
            }
          >
            <SelectTrigger id="seniority" className="w-full">
              <SelectValue placeholder="Not specified" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not specified</SelectItem>
              {SENIORITIES.map((value) => (
                <SelectItem key={value} value={value}>
                  {SENIORITY_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="location">Location (optional)</Label>
          <Input
            id="location"
            placeholder="Bengaluru (hybrid)"
            {...register("location")}
          />
        </div>
      </div>

      {showJobFields ? (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="must_have_skills">Must-have skills</Label>
            <Input
              id="must_have_skills"
              placeholder="React, TypeScript"
              {...register("must_have_skills")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nice_to_have_skills">Nice-to-have skills</Label>
            <Input
              id="nice_to_have_skills"
              placeholder="GraphQL"
              {...register("nice_to_have_skills")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="job_summary">Summary</Label>
            <Textarea id="job_summary" rows={3} {...register("job_summary")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="job_url">Job link (optional)</Label>
            <Input
              id="job_url"
              placeholder="https://"
              {...register("job_url")}
              aria-invalid={!!errors.job_url}
            />
            <FieldError message={errors.job_url?.message} />
          </div>
        </>
      ) : null}

      <div>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
