import { z } from "zod";

export const REPLY_CLASSES = [
  "interested",
  "referral_offered",
  "not_now",
  "not_relevant",
  "opt_out",
] as const;

export const replyClassificationSchema = z.object({
  classification: z.enum(REPLY_CLASSES),
  reason: z
    .string()
    .describe("One short sentence explaining the classification"),
  suggested_reply: z
    .string()
    .describe(
      "A short plain-text reply for the job seeker to send (under 80 words), or an empty string for opt_out",
    ),
});

export const followUpSchema = z.object({
  subject: z.string().nullable(),
  body: z.string(),
});

export type ReplyClassification = z.infer<typeof replyClassificationSchema>;
