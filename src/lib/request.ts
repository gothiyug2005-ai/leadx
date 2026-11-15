import "server-only";

import { headers } from "next/headers";

/**
 * The public origin of the current request, e.g. "https://leadx.vercel.app".
 * Works behind Vercel's proxy and on preview deployments, where the app URL is
 * not known ahead of time.
 */
export async function getRequestOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) {
    return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  }
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const protocol =
    headerList.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    (isLocal ? "http" : "https");
  return `${protocol}://${host}`;
}
