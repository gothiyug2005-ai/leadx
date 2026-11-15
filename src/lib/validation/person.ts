import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));

export const manualPersonSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(200),
  title: optionalText(160),
  email: z
    .string()
    .trim()
    .max(320)
    .optional()
    .nullable()
    .transform((value, ctx) => {
      if (!value) return null;
      const email = value.toLowerCase();
      if (!z.email().safeParse(email).success) {
        ctx.addIssue({
          code: "custom",
          message: "Enter a valid email address",
        });
        return z.NEVER;
      }
      return email;
    }),
  linkedin_url: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
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
    }),
  role_type: z
    .enum([
      "hiring_manager",
      "recruiter",
      "team_member",
      "alumni",
      "leadership",
    ])
    .optional()
    .nullable()
    .transform((value) => value ?? null),
  notes: optionalText(2000),
});

export type ManualPersonInput = z.input<typeof manualPersonSchema>;
