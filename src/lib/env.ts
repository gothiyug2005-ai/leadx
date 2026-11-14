import { z } from "zod";

/**
 * Server-side environment variables, validated once on first use.
 *
 * Keys for real providers are only required when USE_MOCK_PROVIDERS=false,
 * so the app runs end to end without any accounts during development.
 */
const booleanFlag = z
  .enum(["true", "false"])
  .default("true")
  .transform((value) => value === "true");

const optionalKey = z
  .string()
  .optional()
  .transform((value) =>
    value && value.trim() !== "" ? value.trim() : undefined,
  );

const envSchema = z
  .object({
    NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
    USE_MOCK_PROVIDERS: booleanFlag,

    // Supabase (Step 2)
    NEXT_PUBLIC_SUPABASE_URL: optionalKey,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalKey,
    SUPABASE_SERVICE_ROLE_KEY: optionalKey,

    // AI (Step 4 onward)
    ANTHROPIC_API_KEY: optionalKey,
    ANTHROPIC_MODEL: z.string().default("claude-fable-5-2"),

    // People and email data (Steps 6-7)
    APOLLO_API_KEY: optionalKey,
    HUNTER_API_KEY: optionalKey,

    // Web research (Step 7)
    RESEARCH_PROVIDER: z.enum(["tavily", "exa"]).default("tavily"),
    TAVILY_API_KEY: optionalKey,
    EXA_API_KEY: optionalKey,

    // Gmail OAuth (Step 9)
    GOOGLE_CLIENT_ID: optionalKey,
    GOOGLE_CLIENT_SECRET: optionalKey,
    TOKEN_ENCRYPTION_KEY: optionalKey,

    // Background jobs (Step 10)
    INNGEST_EVENT_KEY: optionalKey,
    INNGEST_SIGNING_KEY: optionalKey,

    // Sending limits (Step 9)
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
