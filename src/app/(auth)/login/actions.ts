"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { isDevLoginEnabled } from "@/lib/auth";
import { getRequestOrigin } from "@/lib/request";
import { safeNextPath } from "@/lib/routes";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

function loginError(code: string, next: string): never {
  const params = new URLSearchParams({ error: code });
  if (next !== "/today") params.set("next", next);
  redirect(`/login?${params.toString()}`);
}

export async function signInWithGoogle(formData: FormData) {
  if (!getSupabaseConfig()) redirect("/setup");

  const next = safeNextPath(formData.get("next"));
  const supabase = await createClient();
  const origin = await getRequestOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      // Always show the account chooser, so switching accounts is possible.
      queryParams: { prompt: "select_account" },
    },
  });

  if (error || !data.url) loginError("google_unavailable", next);
  redirect(data.url);
}

// A fixed password is acceptable here only because dev login is restricted to
// a Supabase stack running on localhost (see isDevLoginEnabled).
const DEV_LOGIN_PASSWORD = "leadx-local-dev-only";

const devLoginSchema = z.object({
  email: z.email().max(200),
});

export async function signInWithDevAccount(formData: FormData) {
  const next = safeNextPath(formData.get("next"));
  if (!isDevLoginEnabled()) loginError("dev_login_disabled", next);

  const parsed = devLoginSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) loginError("dev_login_invalid_email", next);
  const email = parsed.data.email.toLowerCase();

  const supabase = await createClient();
  const signIn = await supabase.auth.signInWithPassword({
    email,
    password: DEV_LOGIN_PASSWORD,
  });

  if (signIn.error) {
    const localPart = email.split("@")[0] ?? "Dev User";
    const signUp = await supabase.auth.signUp({
      email,
      password: DEV_LOGIN_PASSWORD,
      options: { data: { full_name: localPart.replace(/[._-]+/g, " ") } },
    });
    if (signUp.error || !signUp.data.session) {
      loginError("dev_login_failed", next);
    }
  }

  redirect(next);
}

export async function signOut() {
  if (getSupabaseConfig()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
