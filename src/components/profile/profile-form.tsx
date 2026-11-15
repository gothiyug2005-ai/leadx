"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { saveProfile } from "@/lib/actions/profile";
import type { ParsedResume } from "@/lib/ai/schemas/resume";
import { isValidTimeZone } from "@/lib/dates";
import { splitList, type ProfileFormValues } from "@/lib/validation/profile";

// The form edits lists as comma or line separated text; it is converted to
// arrays on submit and validated again on the server.
const formSchema = z.object({
  full_name: z.string().trim().min(1, "Your name is required").max(120),
  headline: z.string().max(160),
  location: z.string().max(120),
  timezone: z.string().refine(isValidTimeZone, "Choose a valid timezone"),
  target_roles: z.string().max(500),
  skills: z.string().max(2000),
  summary: z.string().max(1200),
  experience: z
    .array(
      z.object({
        company: z.string().trim().min(1, "Company is required").max(120),
        title: z.string().trim().min(1, "Title is required").max(120),
        start: z.string().max(40),
        end: z.string().max(40),
        highlights: z.string().max(1500),
      }),
    )
    .max(12),
  education: z
    .array(
      z.object({
        school: z.string().trim().min(1, "School is required").max(160),
        degree: z.string().max(120),
        field: z.string().max(120),
        end_year: z.string().max(20),
      }),
    )
    .max(8),
});

type FormValues = z.infer<typeof formSchema>;

export interface ProfileFormInitial {
  full_name: string | null;
  headline: string | null;
  location: string | null;
  timezone: string;
  target_roles: string[];
  resume: ParsedResume | null;
}

function browserTimeZone(fallback: string): string {
  if (fallback !== "UTC") return fallback;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || fallback;
  } catch {
    return fallback;
  }
}

function toFormValues(initial: ProfileFormInitial): FormValues {
  const resume = initial.resume;
  return {
    full_name: initial.full_name ?? resume?.full_name ?? "",
    headline: initial.headline ?? resume?.headline ?? "",
    location: initial.location ?? resume?.location ?? "",
    timezone: browserTimeZone(initial.timezone),
    target_roles: (initial.target_roles.length
      ? initial.target_roles
      : (resume?.suggested_target_roles ?? [])
    ).join(", "),
    skills: (resume?.skills ?? []).join(", "),
    summary: resume?.summary ?? "",
    experience: (resume?.experience ?? []).map((job) => ({
      company: job.company,
      title: job.title,
      start: job.start ?? "",
      end: job.end ?? "",
      highlights: job.highlights.join("\n"),
    })),
    education: (resume?.education ?? []).map((school) => ({
      school: school.school,
      degree: school.degree ?? "",
      field: school.field ?? "",
      end_year: school.end_year ?? "",
    })),
  };
}

function toPayload(values: FormValues): ProfileFormValues {
  return {
    full_name: values.full_name,
    headline: values.headline,
    location: values.location,
    timezone: values.timezone,
    target_roles: splitList(values.target_roles),
    skills: splitList(values.skills),
    summary: values.summary,
    experience: values.experience.map((job) => ({
      company: job.company,
      title: job.title,
      location: "",
      start: job.start,
      end: job.end,
      highlights: job.highlights
        .split("\n")
        .map((line) => line.replace(/^[-•*]\s*/, "").trim())
        .filter(Boolean),
    })),
    education: values.education,
  };
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-destructive text-xs">
      {message}
    </p>
  ) : null;
}

interface ProfileFormProps {
  initial: ProfileFormInitial;
  submitLabel?: string;
  onSaved?: () => void;
}

export function ProfileForm({
  initial,
  submitLabel = "Save profile",
  onSaved,
}: ProfileFormProps) {
  const [saving, setSaving] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: toFormValues(initial),
  });
  const { register, control, handleSubmit, formState } = form;
  const errors = formState.errors;
  const experience = useFieldArray({ control, name: "experience" });
  const education = useFieldArray({ control, name: "education" });

  async function onSubmit(values: FormValues) {
    setSaving(true);
    const result = await saveProfile(toPayload(values));
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Profile saved");
    onSaved?.();
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-6"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="full_name">Full name</Label>
          <Input
            id="full_name"
            autoComplete="name"
            {...register("full_name")}
            aria-invalid={!!errors.full_name}
          />
          <FieldError message={errors.full_name?.message} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="headline">Headline</Label>
          <Input
            id="headline"
            placeholder="Frontend engineer, 3 years in fintech"
            {...register("headline")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            placeholder="Bengaluru, India"
            {...register("location")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="timezone">Timezone</Label>
          <Input
            id="timezone"
            placeholder="Asia/Kolkata"
            {...register("timezone")}
            aria-invalid={!!errors.timezone}
          />
          <FieldError message={errors.timezone?.message} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="target_roles">Roles you are going after</Label>
        <Input
          id="target_roles"
          placeholder="Frontend Engineer, Full-stack Engineer"
          {...register("target_roles")}
        />
        <p className="text-muted-foreground text-xs">
          Separate with commas. Up to 6.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="skills">Skills</Label>
        <Textarea
          id="skills"
          rows={2}
          placeholder="TypeScript, React, Accessibility"
          {...register("skills")}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="summary">Summary</Label>
        <Textarea id="summary" rows={3} {...register("summary")} />
      </div>

      <Separator />

      <fieldset className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <legend className="font-medium">Experience</legend>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              experience.append({
                company: "",
                title: "",
                start: "",
                end: "",
                highlights: "",
              })
            }
          >
            <Plus aria-hidden /> Add role
          </Button>
        </div>
        {experience.fields.length === 0 ? (
          <p className="text-muted-foreground text-sm">No roles yet.</p>
        ) : null}
        {experience.fields.map((field, index) => (
          <div
            key={field.id}
            className="flex flex-col gap-3 rounded-lg border p-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`experience.${index}.title`}>Title</Label>
                <Input
                  id={`experience.${index}.title`}
                  {...register(`experience.${index}.title`)}
                />
                <FieldError
                  message={errors.experience?.[index]?.title?.message}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`experience.${index}.company`}>Company</Label>
                <Input
                  id={`experience.${index}.company`}
                  {...register(`experience.${index}.company`)}
                />
                <FieldError
                  message={errors.experience?.[index]?.company?.message}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`experience.${index}.start`}>From</Label>
                <Input
                  id={`experience.${index}.start`}
                  placeholder="2022"
                  {...register(`experience.${index}.start`)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`experience.${index}.end`}>To</Label>
                <Input
                  id={`experience.${index}.end`}
                  placeholder="Present"
                  {...register(`experience.${index}.end`)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`experience.${index}.highlights`}>
                Highlights (one per line)
              </Label>
              <Textarea
                id={`experience.${index}.highlights`}
                rows={3}
                {...register(`experience.${index}.highlights`)}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground self-end"
              onClick={() => experience.remove(index)}
            >
              <Trash2 aria-hidden /> Remove role
            </Button>
          </div>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <legend className="font-medium">Education</legend>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              education.append({
                school: "",
                degree: "",
                field: "",
                end_year: "",
              })
            }
          >
            <Plus aria-hidden /> Add school
          </Button>
        </div>
        {education.fields.length === 0 ? (
          <p className="text-muted-foreground text-sm">No education yet.</p>
        ) : null}
        {education.fields.map((field, index) => (
          <div
            key={field.id}
            className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2"
          >
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor={`education.${index}.school`}>School</Label>
              <Input
                id={`education.${index}.school`}
                {...register(`education.${index}.school`)}
              />
              <FieldError
                message={errors.education?.[index]?.school?.message}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`education.${index}.degree`}>Degree</Label>
              <Input
                id={`education.${index}.degree`}
                {...register(`education.${index}.degree`)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`education.${index}.field`}>Field</Label>
              <Input
                id={`education.${index}.field`}
                {...register(`education.${index}.field`)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`education.${index}.end_year`}>Year</Label>
              <Input
                id={`education.${index}.end_year`}
                {...register(`education.${index}.end_year`)}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground self-end justify-self-end"
              onClick={() => education.remove(index)}
            >
              <Trash2 aria-hidden /> Remove
            </Button>
          </div>
        ))}
      </fieldset>

      <div>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
