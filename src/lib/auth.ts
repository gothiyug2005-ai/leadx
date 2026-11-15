import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { getEnv } from "@/lib/env";
import { getSupabaseConfig, isLocalSupabase } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export interface CurrentUser {
  id: string;
  email: string | null;
}

export type Profile = Tables<"profiles">;

/**
 * The signed-in user, verified against Supabase Auth, or null.
 * Memoised per request, so calling it from several components is free.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  if (!getSupabaseConfig()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;

  const email = data.claims.email;
  return {
    id: data.claims.sub,
    email: typeof email === "string" && email !== "" ? email : null,
  };
});

/**
 * Use at the top of every protected page, Server Action and Route Handler.
 * The proxy also redirects signed-out visitors, but that is only a convenience;
 * this is the check that counts.
 */
export async function requireUser(): Promise<CurrentUser> {
  if (!getSupabaseConfig()) redirect("/setup");
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** The signed-in user's profile row. Row Level Security guarantees it is their own. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  return data;
});

/**
 * Dev login lets you sign in without Google while developing locally.
 * It needs all three: a non-production build, ENABLE_DEV_LOGIN=true, and a
 * Supabase URL on localhost. It can never be active on a deployed app.
 */
export function isDevLoginEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (!getEnv().ENABLE_DEV_LOGIN) return false;
  return isLocalSupabase(getSupabaseConfig());
}
