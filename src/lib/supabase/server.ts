import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { getEnv } from "@/lib/env";
import type { Database } from "@/types/database";

import { requireSupabaseConfig } from "./config";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * It acts as the signed-in user, so Row Level Security applies.
 * Create a new one for every request.
 */
export async function createClient() {
  const { url, publishableKey } = requireSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. That is fine: proxy.ts
          // refreshes the session on every navigation.
        }
      },
    },
  });
}

/**
 * Service-role client. It bypasses Row Level Security, so it is only for
 * trusted server code (background jobs, the send log, token storage, usage
 * tracking), and every query must filter by user id explicitly.
 */
export function createServiceClient() {
  const { url } = requireSupabaseConfig();
  const { SUPABASE_SECRET_KEY } = getEnv();
  if (!SUPABASE_SECRET_KEY) {
    throw new Error("SUPABASE_SECRET_KEY is not set");
  }

  return createSupabaseClient<Database>(url, SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
