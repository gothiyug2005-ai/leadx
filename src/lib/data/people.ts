import "server-only";

import { cache } from "react";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const getPerson = cache(async (id: string) => {
  await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("people")
    .select(
      "id, full_name, first_name, last_name, title, location, linkedin_url, role_type, relevance_score, relevance_reason, connection_angles, is_recommended, do_not_contact, stage, email, email_status, email_source, notes, source, is_sample, target:targets(id, role_title, team, kind), company:companies(id, name, domain)",
    )
    .eq("id", id)
    .maybeSingle();
  return data;
});

export type PersonDetail = NonNullable<Awaited<ReturnType<typeof getPerson>>>;
