import "server-only";

import { decryptToken, encryptToken } from "@/lib/crypto/tokens";
import { getEnv } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";

import {
  GmailAuthError,
  refreshAccessToken,
  type TokenResponse,
} from "./oauth";

export function gmailConfigured(): boolean {
  const env = getEnv();
  return Boolean(
    env.GOOGLE_CLIENT_ID &&
    env.GOOGLE_CLIENT_SECRET &&
    env.TOKEN_ENCRYPTION_KEY &&
    env.SUPABASE_SECRET_KEY,
  );
}

function googleCredentials() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = getEnv();
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET)
    throw new Error("Google OAuth is not configured.");
  return { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET };
}

/** Store a new Gmail connection. Tokens are encrypted before they reach the database. */
export async function saveConnection(
  userId: string,
  email: string,
  tokens: TokenResponse,
): Promise<void> {
  const supabase = createServiceClient();
  const { error: connectionError } = await supabase
    .from("gmail_connections")
    .upsert({
      user_id: userId,
      email: email.toLowerCase(),
      status: "connected",
      scopes: (tokens.scope ?? "").split(" ").filter(Boolean),
      last_error: null,
      connected_at: new Date().toISOString(),
    });
  if (connectionError)
    throw new Error(
      `Saving the Gmail connection failed: ${connectionError.message}`,
    );

  const { error: tokenError } = await supabase.from("gmail_tokens").upsert({
    user_id: userId,
    refresh_token_enc: encryptToken(tokens.refresh_token!),
    access_token_enc: encryptToken(tokens.access_token),
    access_token_expires_at: new Date(
      Date.now() + tokens.expires_in * 1000,
    ).toISOString(),
  });
  if (tokenError)
    throw new Error(`Saving Gmail tokens failed: ${tokenError.message}`);
}

export async function markConnectionError(
  userId: string,
  message: string,
  status: "error" | "revoked" = "error",
) {
  await createServiceClient()
    .from("gmail_connections")
    .update({ status, last_error: message.slice(0, 300) })
    .eq("user_id", userId);
}

export interface GmailSession {
  accessToken: string;
  email: string;
}

/** A valid access token for the user's Gmail, refreshed if it is about to expire. */
export async function getGmailSession(
  userId: string,
): Promise<GmailSession | null> {
  const supabase = createServiceClient();
  const { data: connection } = await supabase
    .from("gmail_connections")
    .select("email, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (!connection || connection.status !== "connected") return null;

  const { data: tokens } = await supabase
    .from("gmail_tokens")
    .select("refresh_token_enc, access_token_enc, access_token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!tokens) return null;

  const expiresAt = tokens.access_token_expires_at
    ? new Date(tokens.access_token_expires_at).getTime()
    : 0;
  if (tokens.access_token_enc && expiresAt - Date.now() > 60_000) {
    return {
      accessToken: decryptToken(tokens.access_token_enc),
      email: connection.email,
    };
  }

  try {
    const fresh = await refreshAccessToken({
      refreshToken: decryptToken(tokens.refresh_token_enc),
      ...googleCredentials(),
    });
    await supabase
      .from("gmail_tokens")
      .update({
        access_token_enc: encryptToken(fresh.access_token),
        access_token_expires_at: new Date(
          Date.now() + fresh.expires_in * 1000,
        ).toISOString(),
        // Google may rotate the refresh token.
        ...(fresh.refresh_token
          ? { refresh_token_enc: encryptToken(fresh.refresh_token) }
          : {}),
      })
      .eq("user_id", userId);
    return { accessToken: fresh.access_token, email: connection.email };
  } catch (error) {
    if (error instanceof GmailAuthError && error.code === "invalid_grant") {
      await markConnectionError(userId, error.message, "revoked");
      return null;
    }
    throw error;
  }
}

export async function removeConnection(userId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data: tokens } = await supabase
    .from("gmail_tokens")
    .select("refresh_token_enc")
    .eq("user_id", userId)
    .maybeSingle();
  await supabase.from("gmail_connections").delete().eq("user_id", userId);
  try {
    return tokens ? decryptToken(tokens.refresh_token_enc) : null;
  } catch {
    return null;
  }
}
