import "server-only";

import { getEnv } from "@/lib/env";

import { MockPeopleProvider } from "./mock";
import type { PeopleProvider } from "./types";

export * from "./types";

/** Real adapters (Apollo first) are registered here in Step 6. */
export function getPeopleProvider(): PeopleProvider {
  if (getEnv().USE_MOCK_PROVIDERS) return new MockPeopleProvider();
  throw new Error("No real people provider is implemented yet (Step 6)");
}
