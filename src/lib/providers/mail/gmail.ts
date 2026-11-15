import { z } from "zod";

import { buildMimeMessage, toBase64Url } from "@/lib/gmail/mime";

import {
  MailError,
  type MailProvider,
  type OutgoingEmail,
  type SentEmail,
} from "./types";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

const sendSchema = z.object({ id: z.string(), threadId: z.string().nullish() });
const metadataSchema = z.object({
  payload: z
    .object({
      headers: z
        .array(z.object({ name: z.string(), value: z.string() }))
        .nullish(),
    })
    .nullish(),
});

export class GmailProvider implements MailProvider {
  readonly name = "gmail" as const;

  constructor(
    private readonly accessToken: string,
    readonly fromAddress: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async request(
    path: string,
    init: RequestInit = {},
  ): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${API}${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${this.accessToken}`,
          "content-type": "application/json",
          ...(init.headers ?? {}),
        },
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new MailError("unavailable", "Gmail did not respond.");
    }
    if (response.status === 401 || response.status === 403) {
      throw new MailError(
        "auth",
        "Gmail refused access. Reconnect Gmail in Settings.",
      );
    }
    if (response.status === 429)
      throw new MailError(
        "rate_limited",
        "Gmail is limiting sends right now. Try again later.",
      );
    if (response.status === 400)
      throw new MailError("rejected", "Gmail rejected this message.");
    if (!response.ok)
      throw new MailError("unavailable", `Gmail returned ${response.status}.`);
    return response;
  }

  async send(email: OutgoingEmail): Promise<SentEmail> {
    const raw = toBase64Url(
      buildMimeMessage({
        from: this.fromAddress,
        fromName: email.fromName,
        to: email.to,
        subject: email.subject,
        body: email.body,
        inReplyTo: email.inReplyTo,
        references: email.inReplyTo,
      }),
    );
    const response = await this.request("/messages/send", {
      method: "POST",
      body: JSON.stringify(
        email.threadId ? { raw, threadId: email.threadId } : { raw },
      ),
    });
    const sent = sendSchema.safeParse(await response.json().catch(() => null));
    if (!sent.success)
      throw new MailError(
        "unavailable",
        "Gmail returned an unexpected response.",
      );

    // The RFC Message-ID lets follow-ups thread correctly in the recipient's mail app.
    let rfcMessageId: string | null = null;
    try {
      const metadata = await this.request(
        `/messages/${sent.data.id}?format=metadata&metadataHeaders=Message-ID`,
      );
      const parsed = metadataSchema.safeParse(await metadata.json());
      rfcMessageId =
        (parsed.success
          ? parsed.data.payload?.headers?.find(
              (header) => header.name.toLowerCase() === "message-id",
            )?.value
          : null) ?? null;
    } catch {
      // Sent already; a missing Message-ID only affects threading of later follow-ups.
    }
    return {
      messageId: sent.data.id,
      threadId: sent.data.threadId ?? null,
      rfcMessageId,
    };
  }
}
