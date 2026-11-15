import { randomBytes } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { gmailConfigured } from "@/lib/gmail/connection";
import { buildAuthUrl } from "@/lib/gmail/oauth";
import { getRequestOrigin } from "@/lib/request";

import { STATE_COOKIE } from "@/lib/gmail/state";

/** Start the separate Gmail consent: send and read access, asked only when the user chooses. */
export async function GET() {
  const origin = await getRequestOrigin();
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${origin}/login?next=/settings`);
  if (!gmailConfigured())
    return NextResponse.redirect(
      `${origin}/settings?gmail=not_configured#gmail`,
    );

  const state = randomBytes(32).toString("base64url");
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, `${state}.${user.id}`, {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    path: "/api/gmail",
    maxAge: 600,
  });

  return NextResponse.redirect(
    buildAuthUrl({
      clientId: getEnv().GOOGLE_CLIENT_ID!,
      redirectUri: `${origin}/api/gmail/callback`,
      state,
      loginHint: user.email,
    }),
  );
}
