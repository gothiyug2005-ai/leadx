import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { getEnv } from "@/lib/env";
import { syncAllReplies } from "@/lib/replies/sync";
import { processDueMessages } from "@/lib/sequences/process";

/**
 * Alternative to Inngest for hosts with a plain cron (e.g. Vercel Cron):
 * call GET /api/cron/run with "Authorization: Bearer <CRON_SECRET>".
 */
export async function GET(request: NextRequest) {
  const secret = getEnv().CRON_SECRET;
  const given =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const ok =
    Boolean(secret) &&
    given.length === secret!.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(secret!));
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sends = await processDueMessages();
  const replies = await syncAllReplies();
  return NextResponse.json({ sends, replies });
}
