import "server-only";

import { getGmailSession } from "@/lib/gmail/connection";

import { GmailProvider } from "./gmail";
import { MockMailProvider } from "./mock";
import type { MailProvider } from "./types";

export * from "./types";

/**
 * Gmail when the user has connected it. Otherwise the simulated provider,
 * which the send gate restricts to sample people.
 */
export async function getMailProvider(userId: string): Promise<MailProvider> {
  const session = await getGmailSession(userId);
  if (session) return new GmailProvider(session.accessToken, session.email);
  return new MockMailProvider();
}
