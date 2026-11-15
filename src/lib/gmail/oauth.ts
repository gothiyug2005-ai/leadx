import { z } from "zod";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  // Read access is used only to notice replies (Step 10). It is a Google "restricted" scope.
  "https://www.googleapis.com/auth/gmail.readonly",
] as const;

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

export class GmailAuthError extends Error {
  constructor(
    readonly code:
      | "denied"
      | "invalid_grant"
      | "missing_scope"
      | "no_refresh_token"
      | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "GmailAuthError";
  }
}

export function buildAuthUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  loginHint?: string | null;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    // Offline + consent guarantees a refresh token, so LeadX can send follow-ups later.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: input.state,
  });
  if (input.loginHint) params.set("login_hint", input.loginHint);
  return `${AUTH_URL}?${params.toString()}`;
}

const tokenSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
  token_type: z.string().optional(),
});

export type TokenResponse = z.infer<typeof tokenSchema>;

async function postForm(
  fetchImpl: typeof fetch,
  url: string,
  body: Record<string, string>,
): Promise<Response> {
  try {
    return await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new GmailAuthError("unavailable", "Google did not respond.");
  }
}

async function readTokens(response: Response): Promise<TokenResponse> {
  const json = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  if (!response.ok) {
    if (json?.error === "invalid_grant") {
      throw new GmailAuthError(
        "invalid_grant",
        "Google access was revoked or expired. Reconnect Gmail.",
      );
    }
    throw new GmailAuthError(
      "unavailable",
      `Google returned ${response.status}.`,
    );
  }
  const parsed = tokenSchema.safeParse(json);
  if (!parsed.success)
    throw new GmailAuthError(
      "unavailable",
      "Google returned an unexpected token response.",
    );
  return parsed.data;
}

export async function exchangeCode(
  input: {
    code: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<TokenResponse> {
  const tokens = await readTokens(
    await postForm(fetchImpl, TOKEN_URL, {
      code: input.code,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: "authorization_code",
    }),
  );
  const granted = new Set((tokens.scope ?? "").split(" "));
  if (!granted.has(GMAIL_SCOPES[0])) {
    throw new GmailAuthError(
      "missing_scope",
      "LeadX needs permission to send email. Tick the Gmail boxes when Google asks.",
    );
  }
  if (!tokens.refresh_token) {
    throw new GmailAuthError(
      "no_refresh_token",
      "Google did not grant offline access. Please try connecting again.",
    );
  }
  return tokens;
}

export async function refreshAccessToken(
  input: { refreshToken: string; clientId: string; clientSecret: string },
  fetchImpl: typeof fetch = fetch,
): Promise<TokenResponse> {
  return readTokens(
    await postForm(fetchImpl, TOKEN_URL, {
      refresh_token: input.refreshToken,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      grant_type: "refresh_token",
    }),
  );
}

export async function revokeToken(
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  // Best effort: a token that is already invalid needs no revoking.
  await postForm(fetchImpl, REVOKE_URL, { token }).catch(() => undefined);
}
