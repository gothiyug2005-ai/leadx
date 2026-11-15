import "server-only";

import { getEnv } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export interface UsageRecord {
  userId: string;
  provider: string;
  operation: string;
  units?: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  model?: string | null;
  isMock?: boolean;
  cacheHit?: boolean;
  metadata?: Record<string, Json>;
}

/**
 * Record one provider or AI call against a user, for future credits and billing.
 * Best effort: a failure here is logged and never breaks the user's action.
 */
export async function recordUsage(record: UsageRecord): Promise<void> {
  if (!getEnv().SUPABASE_SECRET_KEY) return;
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("api_usage").insert({
      user_id: record.userId,
      provider: record.provider,
      operation: record.operation,
      units: record.units ?? 1,
      input_tokens: record.inputTokens ?? null,
      output_tokens: record.outputTokens ?? null,
      model: record.model ?? null,
      is_mock: record.isMock ?? false,
      cache_hit: record.cacheHit ?? false,
      metadata: record.metadata ?? {},
    });
    if (error) console.error("recordUsage failed", error.message);
  } catch (error) {
    console.error("recordUsage failed", error);
  }
}
