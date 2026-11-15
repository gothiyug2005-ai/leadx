import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { defineConfig } from "vitest/config";

// Database tests need a local Postgres (see docs/SETUP.md). When no URL is
// configured they are skipped, so `pnpm test` always works.
const localEnvPath = fileURLToPath(new URL("./.env.local", import.meta.url));
const localEnv = existsSync(localEnvPath)
  ? parseEnv(readFileSync(localEnvPath, "utf8"))
  : {};
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? localEnv.TEST_DATABASE_URL ?? "";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    env: {
      TEST_DATABASE_URL: testDatabaseUrl,
      // Server-side database tests (sequences, replies) talk to the same local stack.
      ...(testDatabaseUrl
        ? {
            NEXT_PUBLIC_SUPABASE_URL: localEnv.NEXT_PUBLIC_SUPABASE_URL ?? "",
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
              localEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
            SUPABASE_SECRET_KEY: localEnv.SUPABASE_SECRET_KEY ?? "",
          }
        : {}),
    },
    // Database tests share one database; run files one at a time.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws outside a React Server environment; tests run in plain Node.
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
});
