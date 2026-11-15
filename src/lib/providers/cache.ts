import "server-only";

import { createHash } from "node:crypto";

import { getEnv } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export const DAY = 24 * 60 * 60 * 1000;

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export function cacheKey(
  provider: string,
  operation: string,
  input: unknown,
): string {
  const digest = createHash("sha256")
    .update(stableStringify(input))
    .digest("hex");
  return `${provider}:${operation}:${digest}`;
}

/**
 * Return a cached provider response if it is still fresh, otherwise call the
 * provider and store the result. Saves credits when several users look at the
 * same company. Errors are never cached; the cache failing never blocks a call.
 */
export async function withProviderCache<T>(
  options: {
    provider: string;
    operation: string;
    input: unknown;
    ttlMs: number;
  },
  load: () => Promise<T>,
): Promise<{ value: T; hit: boolean }> {
  // Sample data is cheap and must never be served in place of real data.
  if (options.provider === "mock" || !getEnv().SUPABASE_SECRET_KEY) {
    return { value: await load(), hit: false };
  }

  const key = cacheKey(options.provider, options.operation, options.input);
  const supabase = createServiceClient();
  try {
    const { data } = await supabase
      .from("provider_cache")
      .select("payload, expires_at")
      .eq("cache_key", key)
      .maybeSingle();
    if (data && new Date(data.expires_at).getTime() > Date.now()) {
      return { value: data.payload as T, hit: true };
    }
  } catch (error) {
    console.error("provider cache read failed", error);
  }

  const value = await load();
  try {
    await supabase.from("provider_cache").upsert({
      cache_key: key,
      provider: options.provider,
      operation: options.operation,
      payload: value as unknown as NonNullable<Json>,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + options.ttlMs).toISOString(),
    });
  } catch (error) {
    console.error("provider cache write failed", error);
  }
  return { value, hit: false };
}
