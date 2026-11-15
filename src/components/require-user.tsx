import type { ReactNode } from "react";

import { requireUser } from "@/lib/auth";

/**
 * Renders its children only for a signed-in user; everyone else is redirected
 * to sign in. Wrap it in <Suspense>, because it reads the session.
 */
export async function RequireUser({ children }: { children: ReactNode }) {
  await requireUser();
  return children;
}
