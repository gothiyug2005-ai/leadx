import { z } from "zod";

import { SENIORITIES } from "@/lib/ai/schemas/job";
import { normalizeDomain } from "@/lib/web/domain";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .transform((value) => value ?? null);

const skillList = z
  .array(z.string().trim().min(1).max(60))
  .max(15)
  .transform((items) => Array.from(new Set(items)));

const domainField = z
  .string()
  .trim()
  .max(253)
  .nullable()
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;
    const domain = normalizeDomain(value);
    if (!domain) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a website like acme.com",
      });
      return z.NEVER;
    }
    return domain;
  });

const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .nullable()
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" && url.protocol !== "http:")
        throw new Error("protocol");
      return url.toString();
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "Enter a full link starting with https://",
      });
      return z.NEVER;
    }
  });

export const targetFormSchema = z.object({
  kind: z.enum(["job_posting", "company"]),
  company_name: z.string().trim().min(1, "Company is required").max(200),
  company_domain: domainField,
  role_title: optionalText(160),
  team: optionalText(160),
  seniority: z
    .enum(SENIORITIES)
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  location: optionalText(160),
  must_have_skills: skillList,
  nice_to_have_skills: skillList,
  job_url: httpUrl,
  job_text: optionalText(30000),
  job_summary: optionalText(1000),
});

export type TargetFormInput = z.input<typeof targetFormSchema>;
export type TargetFormOutput = z.output<typeof targetFormSchema>;

export const personTargetSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(200),
  title: optionalText(160),
  company_name: z.string().trim().min(1, "Company is required").max(200),
  company_domain: domainField,
  linkedin_url: httpUrl,
  role_title: optionalText(160),
  notes: optionalText(2000),
});

export type PersonTargetInput = z.input<typeof personTargetSchema>;

export const readPostingSchema = z
  .object({
    url: z.string().trim().max(2000).optional().default(""),
    text: z.string().trim().max(30000).optional().default(""),
  })
  .refine((value) => value.url !== "" || value.text.length >= 80, {
    message:
      "Paste a job link, or at least a few lines of the job description.",
  });

export const TARGET_STATUSES = ["active", "paused", "archived"] as const;
export const targetStatusSchema = z.enum(TARGET_STATUSES);

export const uuidSchema = z.uuid();
