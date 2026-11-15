import { z } from "zod";

import { AiError } from "@/lib/ai/errors";

export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}

/** Turn any thrown error into a message that is safe to show the user. */
export function failFrom(error: unknown): ActionResult<never> {
  if (error instanceof AiError) return fail(error.userMessage);
  if (error instanceof z.ZodError) {
    return fail(error.issues[0]?.message ?? "Some fields are not valid.");
  }
  console.error(error);
  return fail("Something went wrong. Please try again.");
}
