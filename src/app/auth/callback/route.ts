import { NextResponse, type NextRequest } from "next/server";

import { getRequestOrigin } from "@/lib/request";
import { safeNextPath } from "@/lib/routes";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Google sends the user back here after sign-in. We swap the one-time code for
 * a session cookie, then continue to wherever they were heading.
 */
export async function GET(request: NextRequest) {
  const origin = await getRequestOrigin();
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (!getSupabaseConfig()) {
    return NextResponse.redirect(`${origin}/setup`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const params = new URLSearchParams({ error: "sign_in_failed" });
  return NextResponse.redirect(`${origin}/login?${params.toString()}`);
}
