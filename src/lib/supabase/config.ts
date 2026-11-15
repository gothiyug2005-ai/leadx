export interface SupabaseConfig {
  url: string;
  publishableKey: string;
}

/**
 * Public Supabase settings. These are safe to ship to the browser: the
 * publishable key only works together with a signed-in user's session and
 * Row Level Security.
 *
 * Returns null when the project has not been connected to Supabase yet, so
 * callers can show the setup screen instead of crashing.
 */
export function getSupabaseConfig(): SupabaseConfig | null {
  // Referenced literally so Next.js can inline them into the browser bundle.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export function requireSupabaseConfig(): SupabaseConfig {
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return config;
}

/** True when the Supabase URL points at a local development stack. */
export function isLocalSupabase(config: SupabaseConfig | null): boolean {
  if (!config) return false;
  try {
    const { hostname } = new URL(config.url);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}
