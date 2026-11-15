import { randomBytes } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  TokenCryptoError,
  decryptWithKey,
  encryptWithKey,
  parseKey,
} from "@/lib/crypto/tokens";
import {
  buildMimeMessage,
  encodeHeaderWord,
  sanitizeHeader,
  toBase64Url,
} from "@/lib/gmail/mime";
import {
  GMAIL_SCOPES,
  GmailAuthError,
  buildAuthUrl,
  exchangeCode,
} from "@/lib/gmail/oauth";
import { GmailProvider } from "@/lib/providers/mail/gmail";
import { refusalMessage } from "@/lib/sending/send";

const key = randomBytes(32);

describe("token encryption", () => {
  it("round-trips and uses a fresh IV every time", () => {
    const a = encryptWithKey("refresh-token-123", key);
    const b = encryptWithKey("refresh-token-123", key);
    expect(a).not.toBe(b);
    expect(a).not.toContain("refresh-token-123");
    expect(decryptWithKey(a, key)).toBe("refresh-token-123");
  });

  it("detects tampering and a wrong key", () => {
    const sealed = encryptWithKey("secret", key);
    const parts = sealed.split(":");
    const flipped = Buffer.from(parts[3]!, "base64");
    flipped[0] = flipped[0]! ^ 1;
    expect(() =>
      decryptWithKey(
        [parts[0], parts[1], parts[2], flipped.toString("base64")].join(":"),
        key,
      ),
    ).toThrow(TokenCryptoError);
    expect(() => decryptWithKey(sealed, randomBytes(32))).toThrow(
      TokenCryptoError,
    );
    expect(() => decryptWithKey("garbage", key)).toThrow(TokenCryptoError);
  });

  it("insists on a 32-byte key", () => {
    expect(() => parseKey(undefined)).toThrow(/not set/);
    expect(() => parseKey(Buffer.alloc(16).toString("base64"))).toThrow(
      /32 bytes/,
    );
    expect(parseKey(key.toString("base64"))).toHaveLength(32);
  });
});

function decodeRaw(raw: string): string {
  return Buffer.from(
    raw.replace(/-/g, "+").replace(/_/g, "/"),
    "base64",
  ).toString("utf8");
}

describe("MIME builder", () => {
  const message = buildMimeMessage({
    from: "asha@gmail.com",
    fromName: "Asha Verma",
    to: "priya@acme.com",
    subject: "Frontend role on Payments",
    body: "Hi Priya,\n\nWould you be open to a chat?\n\nBest,\nAsha",
    date: new Date("2026-03-01T10:00:00Z"),
  });

  it("writes the expected headers with CRLF line endings", () => {
    const [head, body] = message.split("\r\n\r\n");
    expect(head).toContain('From: "Asha Verma" <asha@gmail.com>');
    expect(head).toContain("To: priya@acme.com");
    expect(head).toContain("Subject: Frontend role on Payments");
    expect(head).toContain('Content-Type: text/plain; charset="UTF-8"');
    expect(
      Buffer.from(body!.replace(/\r\n/g, ""), "base64").toString("utf8"),
    ).toBe(
      "Hi Priya,\r\n\r\nWould you be open to a chat?\r\n\r\nBest,\r\nAsha",
    );
  });

  it("blocks header injection through the subject or name", () => {
    const injected = buildMimeMessage({
      from: "asha@gmail.com",
      fromName: "Asha\r\nBcc: victim@evil.example",
      to: "priya@acme.com",
      subject: "Hi\r\nBcc: everyone@evil.example",
      body: "x",
    });
    const head = injected.split("\r\n\r\n")[0]!;
    expect(head.split("\r\n").some((line) => line.startsWith("Bcc:"))).toBe(
      false,
    );
    expect(sanitizeHeader("a\r\nb\nc")).toBe("a b c");
  });

  it("rejects malformed or multiple recipients", () => {
    for (const to of [
      "priya@acme.com, other@x.com",
      "not-an-email",
      "a@b.com\r\nCc: x@y.com",
      "<a@b.com>",
    ]) {
      expect(
        () =>
          buildMimeMessage({
            from: "asha@gmail.com",
            to,
            subject: "s",
            body: "b",
          }),
        to,
      ).toThrow();
    }
  });

  it("encodes non-English subjects and produces base64url", () => {
    expect(encodeHeaderWord("Rôle à Paris")).toMatch(/^=\?UTF-8\?B\?.+\?=$/);
    const raw = toBase64Url(message);
    expect(raw).not.toMatch(/[+/=]/);
    expect(decodeRaw(raw)).toBe(message);
  });
});

describe("Google OAuth", () => {
  it("asks for offline Gmail send and read access with a state value", () => {
    const url = new URL(
      buildAuthUrl({
        clientId: "cid",
        redirectUri: "https://app.example/api/gmail/callback",
        state: "s1",
        loginHint: "a@b.com",
      }),
    );
    expect(url.origin + url.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(url.searchParams.get("scope")).toBe(GMAIL_SCOPES.join(" "));
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("s1");
  });

  const tokenFetch = (status: number, body: unknown) =>
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        }),
    ) as unknown as typeof fetch;
  const input = {
    code: "c",
    clientId: "id",
    clientSecret: "secret",
    redirectUri: "https://app/cb",
  };

  it("accepts a grant with send scope and a refresh token", async () => {
    const tokens = await exchangeCode(
      input,
      tokenFetch(200, {
        access_token: "at",
        refresh_token: "rt",
        expires_in: 3600,
        scope: GMAIL_SCOPES.join(" "),
      }),
    );
    expect(tokens.refresh_token).toBe("rt");
  });

  it("refuses a grant without send permission or without offline access", async () => {
    await expect(
      exchangeCode(
        input,
        tokenFetch(200, {
          access_token: "at",
          refresh_token: "rt",
          expires_in: 3600,
          scope: GMAIL_SCOPES[1],
        }),
      ),
    ).rejects.toMatchObject({ code: "missing_scope" });
    await expect(
      exchangeCode(
        input,
        tokenFetch(200, {
          access_token: "at",
          expires_in: 3600,
          scope: GMAIL_SCOPES.join(" "),
        }),
      ),
    ).rejects.toMatchObject({ code: "no_refresh_token" });
    await expect(
      exchangeCode(input, tokenFetch(400, { error: "invalid_grant" })),
    ).rejects.toBeInstanceOf(GmailAuthError);
  });
});

describe("Gmail provider", () => {
  it("sends the raw message in the right thread and reads back the Message-ID", async () => {
    const calls: [string, RequestInit][] = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      if (url.endsWith("/messages/send"))
        return new Response(JSON.stringify({ id: "m1", threadId: "t1" }), {
          status: 200,
        });
      return new Response(
        JSON.stringify({
          payload: {
            headers: [{ name: "Message-ID", value: "<abc@mail.gmail.com>" }],
          },
        }),
        { status: 200 },
      );
    });
    const provider = new GmailProvider(
      "token",
      "asha@gmail.com",
      fetchMock as unknown as typeof fetch,
    );
    const sent = await provider.send({
      to: "priya@acme.com",
      subject: "Hi",
      body: "Hello",
      fromName: "Asha",
      threadId: "t0",
      inReplyTo: "<x@y>",
    });

    expect(sent).toEqual({
      messageId: "m1",
      threadId: "t1",
      rfcMessageId: "<abc@mail.gmail.com>",
    });
    const [, init] = calls[0]!;
    expect((init.headers as Record<string, string>).authorization).toBe(
      "Bearer token",
    );
    const payload = JSON.parse(init.body as string) as {
      raw: string;
      threadId: string;
    };
    expect(payload.threadId).toBe("t0");
    expect(decodeRaw(payload.raw)).toContain("In-Reply-To: <x@y>");
  });

  it("reports an expired connection clearly", async () => {
    const provider = new GmailProvider(
      "token",
      "asha@gmail.com",
      (async () =>
        new Response("{}", { status: 401 })) as unknown as typeof fetch,
    );
    await expect(
      provider.send({
        to: "priya@acme.com",
        subject: "Hi",
        body: "x",
        fromName: null,
      }),
    ).rejects.toMatchObject({ code: "auth" });
  });
});

describe("send refusals", () => {
  it("explains each refusal in plain words", () => {
    expect(refusalMessage("daily_cap_reached", { cap: 20 })).toMatch(
      /limit of 20/,
    );
    expect(refusalMessage("suppressed")).toMatch(/do-not-email/);
    expect(refusalMessage("unverified_email")).toMatch(/Use anyway/);
    expect(refusalMessage("something_new")).toMatch(/could not send/);
  });
});
