import { randomUUID } from "node:crypto";

import type { MailProvider, OutgoingEmail, SentEmail } from "./types";

/**
 * Simulated sending for sample people while Gmail is not connected. Nothing
 * leaves the app; the send gate only lets this provider "send" to sample people.
 */
export class MockMailProvider implements MailProvider {
  readonly name = "mock" as const;
  readonly fromAddress = "you@sample.leadx";

  async send(email: OutgoingEmail): Promise<SentEmail> {
    const id = randomUUID();
    return {
      messageId: `mock-${id}`,
      threadId: email.threadId ?? `mock-thread-${id}`,
      rfcMessageId: `<${id}@sample.leadx>`,
    };
  }
}
