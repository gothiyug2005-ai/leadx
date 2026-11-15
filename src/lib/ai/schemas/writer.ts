import { z } from "zod";

import { ANGLES } from "@/lib/writer/rules";

export const draftSchema = z.object({
  angle: z.enum(ANGLES),
  subject: z.string().nullable(),
  body: z
    .string()
    .describe(
      "Plain text. Paragraphs separated by a blank line. Greeting first, sign-off last.",
    ),
});

export const variantsSchema = z.object({
  variants: z
    .array(draftSchema)
    .describe("Exactly 3 drafts, each with a different angle"),
});

export const rewriteSchema = z.object({
  subject: z.string().nullable(),
  body: z.string(),
});

export type Variants = z.infer<typeof variantsSchema>;
export type Rewrite = z.infer<typeof rewriteSchema>;
