import { z } from "zod";

/**
 * Server-side environment variables, validated once on first use.
 *
 * Mock rule: each external provider (AI, people, email, research, mail) uses
 * its real adapter when its key is present. When a key is missing the provider
 * falls back to a mock, unless USE_MOCK_PROVIDERS=false, in which case a
 * missing key is a configuration error. This keeps development unblocked and
 * lets real providers be switched on one at a time.
 */
function booleanFlag(defaultValue: "true" | "false") {
  return z
    .enum(["true", "false"])
    .default(defaultValue)
    .transform((value) => value === "true");
}

const optionalKey = z
  .string()
  .optional()
  .transform((value) =>
    value && value.trim() !== "" ? value.trim() : undefined,
  );

const envSchema = z
  .object({
    NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
    USE_MOCK_PROVIDERS: booleanFlag("true"),

    // Supabase (database, auth, storage)
    NEXT_PUBLIC_SUPABASE_URL: optionalKey,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalKey,
    SUPABASE_SECRET_KEY: optionalKey,

    // Local development only: sign in without Google. Ignored in production builds.
    ENABLE_DEV_LOGIN: booleanFlag("false"),

    // AI
    ANTHROPIC_API_KEY: optionalKey,
    ANTHROPIC_MODEL: z.string().default("claude-opus-5-5"),

    // People and email data
    APOLLO_API_KEY: optionalKey,
    HUNTER_API_KEY: optionalKey,

    // Web research
    RESEARCH_PROVIDER: z.enum(["tavily", "exa"]).default("tavily"),
    TAVILY_API_KEY: optionalKey,
    EXA_API_KEY: optionalKey,

    // Gmail OAuth
    GOOGLE_CLIENT_ID: optionalKey,
    GOOGLE_CLIENT_SECRET: optionalKey,
    TOKEN_ENCRYPTION_KEY: optionalKey,

    // Background jobs
    INNGEST_EVENT_KEY: optionalKey,
    INNGEST_SIGNING_KEY: optionalKey,
    // Protects /api/cron/run for hosts that use a plain cron instead of Inngest.
    CRON_SECRET: optionalKey,

    // Sending limits. The database enforces the same hard maximum of 40.
    DAILY_SEND_CAP_DEFAULT: z.coerce.number().int().min(1).max(40).default(20),
    DAILY_SEND_CAP_MAX: z.coerce.number().int().min(1).max(40).default(40),
  })
  .superRefine((env, ctx) => {
    if (env.USE_MOCK_PROVIDERS) return;

    const required = [
      "ANTHROPIC_API_KEY",
      "APOLLO_API_KEY",
      "HUNTER_API_KEY",
      env.RESEARCH_PROVIDER === "exa" ? "EXA_API_KEY" : "TAVILY_API_KEY",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "TOKEN_ENCRYPTION_KEY",
    ] as const;

    for (const key of required) {
      if (!env[key]) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: `${key} is required when USE_MOCK_PROVIDERS=false`,
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map(
        (issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`,
      )
      .join("\n");
    throw new Error(`Invalid environment variables:\n${problems}`);
  }
  return result.data;
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

/** Test helper: forget the cached environment. */
export function resetEnvCache(): void {
  cached = undefined;
}
