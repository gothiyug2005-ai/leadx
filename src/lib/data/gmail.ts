import "server-only";

import { cache } from "react";

import { getCurrentUser } from "@/lib/auth";
import { gmailConfigured } from "@/lib/gmail/connection";
import { createClient } from "@/lib/supabase/server";

/** What the user may see about their Gmail link (never the tokens). */
export const getGmailStatus = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("gmail_connections")
    .select("email, status, last_error, connected_at, scopes")
    .eq("user_id", user.id)
    .maybeSingle();
  return { configured: gmailConfigured(), connection: data };
});
