import { timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { gmailConfigured, saveConnection } from "@/lib/gmail/connection";
import { GmailAuthError, exchangeCode } from "@/lib/gmail/oauth";
import { getRequestOrigin } from "@/lib/request";

import { STATE_COOKIE } from "@/lib/gmail/state";

const profileSchema = z.object({ emailAddress: z.string() });

function sameState(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Google sends the user back here after the Gmail consent screen. */
export async function GET(request: NextRequest) {
  const origin = await getRequestOrigin();
  const done = (status: string) =>
    NextResponse.redirect(`${origin}/settings?gmail=${status}#gmail`);

  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${origin}/login?next=/settings`);
  if (!gmailConfigured()) return done("not_configured");

  const cookieStore = await cookies();
  const stored = cookieStore.get(STATE_COOKIE)?.value ?? "";
  cookieStore.delete({ name: STATE_COOKIE, path: "/api/gmail" });

  const params = request.nextUrl.searchParams;
  if (params.get("error")) return done("denied");

  const [state, stateUserId] = stored.split(".");
  const returned = params.get("state") ?? "";
  // The state must match the one we set, for the same signed-in user (prevents login CSRF).
  if (
    !state ||
    !returned ||
    stateUserId !== user.id ||
    !sameState(state, returned)
  )
    return done("invalid_state");

  const code = params.get("code");
  if (!code) return done("denied");

  try {
    const env = getEnv();
    const tokens = await exchangeCode({
      code,
      clientId: env.GOOGLE_CLIENT_ID!,
      clientSecret: env.GOOGLE_CLIENT_SECRET!,
      redirectUri: `${origin}/api/gmail/callback`,
    });

    const profile = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      {
        headers: { authorization: `Bearer ${tokens.access_token}` },
        signal: AbortSignal.timeout(15_000),
      },
    );
    const parsed = profileSchema.safeParse(
      await profile.json().catch(() => null),
    );
    if (!profile.ok || !parsed.success) return done("error");

    await saveConnection(user.id, parsed.data.emailAddress, tokens);
    return done("connected");
  } catch (error) {
    if (error instanceof GmailAuthError) return done(error.code);
    console.error("Gmail connect failed", error);
    return done("error");
  }
}
