import "server-only";

import { cache } from "react";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import type { NavCounts } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/server";

/** Small badge counts for the navigation. */
export const getNavCounts = cache(async (): Promise<NavCounts> => {
  const user = await getCurrentUser();
  if (!user) return {};

  const supabase = await createClient();
  const { count } = await supabase
    .from("threads")
    .select("id", { count: "exact", head: true })
    .eq("needs_attention", true);

  return { inbox: count ?? 0 };
});

const sendAllowanceSchema = z.object({
  used: z.number(),
  cap: z.number(),
  remaining: z.number(),
  local_day: z.string(),
});

export type SendAllowance = z.infer<typeof sendAllowanceSchema>;

/** How many outreach emails the user can still send today (the database is the source of truth). */
export const getSendAllowance = cache(
  async (): Promise<SendAllowance | null> => {
    const user = await getCurrentUser();
    if (!user) return null;

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("sends_remaining_today");
    if (error) return null;
    const parsed = sendAllowanceSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  },
);
