import { processDueMessages } from "@/lib/sequences/process";
import { syncAllReplies } from "@/lib/replies/sync";

import { inngest } from "./client";

/** Every 5 minutes: send follow-ups (and anything else) that are due. */
export const sendDueMessages = inngest.createFunction(
  {
    id: "send-due-messages",
    triggers: [{ cron: "*/5 * * * *" }],
    concurrency: { limit: 1 },
  },
  async ({ step }) =>
    step.run("process due messages", () => processDueMessages()),
);

/** Every 10 minutes: look for replies in Gmail, stop follow-ups, classify. */
export const syncReplies = inngest.createFunction(
  {
    id: "sync-replies",
    triggers: [{ cron: "*/10 * * * *" }],
    concurrency: { limit: 1 },
  },
  async ({ step }) => step.run("sync replies", () => syncAllReplies()),
);

export const functions = [sendDueMessages, syncReplies];
