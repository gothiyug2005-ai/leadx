import "server-only";

import { z } from "zod";

import { getGmailSession } from "@/lib/gmail/connection";
import { createServiceClient } from "@/lib/supabase/server";

import { handleInbound } from "./handle";
import {
  bodyText,
  bouncedAddress,
  classifyKind,
  header,
  parseAddress,
  sentAt,
  stripQuoted,
  type GmailMessage,
} from "./parse";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const MAX_THREADS_PER_RUN = 25;

const historySchema = z.object({
  historyId: z.string().nullish(),
  nextPageToken: z.string().nullish(),
  history: z
    .array(
      z.object({
        messagesAdded: z
          .array(
            z.object({
              message: z.object({ id: z.string(), threadId: z.string() }),
            }),
          )
          .nullish(),
      }),
    )
    .nullish(),
});

async function gmail(
  token: string,
  path: string,
  fetchImpl: typeof fetch,
): Promise<Response> {
  return fetchImpl(`${API}${path}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000),
  });
}

export interface SyncResult {
  checkedThreads: number;
  newReplies: number;
}

/**
 * Look for new messages in the threads LeadX started. Uses Gmail's history
 * cursor so each run only reads what changed; falls back to checking recent
 * threads directly when the cursor is missing or too old.
 */
export async function syncReplies(
  userId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SyncResult> {
  const service = createServiceClient();
  const session = await getGmailSession(userId);
  if (!session) return { checkedThreads: 0, newReplies: 0 };

  const { data: connection } = await service
    .from("gmail_connections")
    .select("history_id")
    .eq("user_id", userId)
    .single();
  const { data: known } = await service
    .from("threads")
    .select("id, gmail_thread_id, last_message_at")
    .eq("user_id", userId)
    .not("gmail_thread_id", "like", "mock-%")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(500);
  const byGmailId = new Map(
    (known ?? []).map((thread) => [thread.gmail_thread_id, thread.id]),
  );

  let toCheck = new Set<string>();
  let nextHistoryId: string | null = null;
  let fallback = !connection?.history_id;

  if (connection?.history_id) {
    let pageToken: string | null = null;
    for (let page = 0; page < 5; page += 1) {
      const params = new URLSearchParams({
        startHistoryId: connection.history_id,
        historyTypes: "messageAdded",
      });
      if (pageToken) params.set("pageToken", pageToken);
      const response = await gmail(
        session.accessToken,
        `/history?${params.toString()}`,
        fetchImpl,
      );
      if (response.status === 404) {
        fallback = true;
        break;
      }
      if (!response.ok)
        throw new Error(`Gmail history returned ${response.status}`);
      const parsed = historySchema.safeParse(await response.json());
      if (!parsed.success) break;
      nextHistoryId = parsed.data.historyId ?? nextHistoryId;
      for (const entry of parsed.data.history ?? []) {
        for (const added of entry.messagesAdded ?? []) {
          if (byGmailId.has(added.message.threadId))
            toCheck.add(added.message.threadId);
        }
      }
      pageToken = parsed.data.nextPageToken ?? null;
      if (!pageToken) break;
    }
  }

  if (fallback) {
    const profile = await gmail(session.accessToken, "/profile", fetchImpl);
    const parsed = z
      .object({ historyId: z.string() })
      .safeParse(await profile.json().catch(() => null));
    nextHistoryId = parsed.success ? parsed.data.historyId : null;
    // Check the most recently active threads directly.
    toCheck = new Set(
      (known ?? [])
        .slice(0, MAX_THREADS_PER_RUN)
        .map((thread) => thread.gmail_thread_id),
    );
  }

  let newReplies = 0;
  const threads = [...toCheck].slice(0, MAX_THREADS_PER_RUN);
  for (const gmailThreadId of threads) {
    const threadId = byGmailId.get(gmailThreadId);
    if (!threadId) continue;
    const response = await gmail(
      session.accessToken,
      `/threads/${encodeURIComponent(gmailThreadId)}?format=full`,
      fetchImpl,
    );
    if (!response.ok) continue;
    const thread = (await response.json().catch(() => null)) as {
      messages?: GmailMessage[];
    } | null;

    const { data: seen } = await service
      .from("thread_messages")
      .select("gmail_message_id")
      .eq("thread_id", threadId);
    const seenIds = new Set((seen ?? []).map((row) => row.gmail_message_id));

    for (const message of thread?.messages ?? []) {
      if (seenIds.has(message.id)) continue;
      const from = parseAddress(header(message, "From"));
      // Messages the user sent from Gmail directly are not replies.
      if (
        from.email === session.email.toLowerCase() ||
        message.labelIds?.includes("SENT")
      )
        continue;
      const kind = classifyKind(message);
      const text = stripQuoted(bodyText(message));
      const result = await handleInbound({
        userId,
        threadId,
        gmailMessageId: message.id,
        fromEmail: from.email,
        fromName: from.name,
        subject: header(message, "Subject"),
        text: text || message.snippet || "",
        sentAt: sentAt(message),
        kind,
        bouncedEmail:
          kind === "bounce" ? bouncedAddress(message, bodyText(message)) : null,
      });
      if (result.recorded && kind === "human") newReplies += 1;
    }
  }

  await service
    .from("gmail_connections")
    .update({
      last_sync_at: new Date().toISOString(),
      ...(nextHistoryId ? { history_id: nextHistoryId } : {}),
      last_error: null,
    })
    .eq("user_id", userId);
  return { checkedThreads: threads.length, newReplies };
}

/** Sync every connected user. Used by the scheduler. */
export async function syncAllReplies(
  maxUsers = 100,
): Promise<{ users: number; newReplies: number }> {
  const service = createServiceClient();
  const { data: connections } = await service
    .from("gmail_connections")
    .select("user_id")
    .eq("status", "connected")
    .order("last_sync_at", { ascending: true, nullsFirst: true })
    .limit(maxUsers);
  let newReplies = 0;
  for (const connection of connections ?? []) {
    try {
      newReplies += (await syncReplies(connection.user_id)).newReplies;
    } catch (error) {
      console.error("Reply sync failed for a user", error);
      await service
        .from("gmail_connections")
        .update({ last_error: "Could not check for replies. Will retry." })
        .eq("user_id", connection.user_id);
    }
  }
  return { users: connections?.length ?? 0, newReplies };
}
