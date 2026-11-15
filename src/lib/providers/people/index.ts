import "server-only";

import { getEnv } from "@/lib/env";

import { ApolloPeopleProvider } from "./apollo";
import { MockPeopleProvider } from "./mock";
import type { PeopleProvider } from "./types";

export * from "./types";

/** Apollo when a key is set; otherwise clearly labelled sample people. */
export function getPeopleProvider(): PeopleProvider {
  const { APOLLO_API_KEY } = getEnv();
  if (APOLLO_API_KEY) return new ApolloPeopleProvider(APOLLO_API_KEY);
  return new MockPeopleProvider();
}
