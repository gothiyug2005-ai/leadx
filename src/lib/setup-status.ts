import "server-only";

import { getSupabaseConfig } from "@/lib/supabase/config";

export interface SetupItem {
  /** Environment variable name. Values are never exposed. */
  key: string;
  label: string;
  isSet: boolean;
}

export interface SetupGroup {
  id: string;
  title: string;
  description: string;
  /** Required groups block the app; optional ones fall back to sample data. */
  required: boolean;
  items: SetupItem[];
}

function isSet(name: string): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.trim() !== "";
}

function item(key: string, label: string): SetupItem {
  return { key, label, isSet: isSet(key) };
}

/** Which settings are in place. Used by the setup screen and by Settings. */
export function getSetupStatus(): SetupGroup[] {
  const research =
    process.env.RESEARCH_PROVIDER === "exa" ? "EXA_API_KEY" : "TAVILY_API_KEY";

  return [
    {
      id: "supabase",
      title: "Supabase",
      description: "Your database, sign-in and resume storage.",
      required: true,
      items: [
        item("NEXT_PUBLIC_SUPABASE_URL", "Project URL"),
        item("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "Publishable key"),
        item("SUPABASE_SECRET_KEY", "Secret key"),
      ],
    },
    {
      id: "ai",
      title: "Anthropic",
      description: "The AI that parses, ranks, researches and writes.",
      required: false,
      items: [item("ANTHROPIC_API_KEY", "API key")],
    },
    {
      id: "people",
      title: "People and email data",
      description: "Finds real people and their email addresses.",
      required: false,
      items: [
        item("APOLLO_API_KEY", "Apollo API key"),
        item("HUNTER_API_KEY", "Hunter API key"),
      ],
    },
    {
      id: "research",
      title: "Web research",
      description: "Recent company news for research briefs.",
      required: false,
      items: [item(research, "Search API key")],
    },
    {
      id: "gmail",
      title: "Gmail",
      description: "Send from your own address and detect replies.",
      required: false,
      items: [
        item("GOOGLE_CLIENT_ID", "Google client ID"),
        item("GOOGLE_CLIENT_SECRET", "Google client secret"),
        item("TOKEN_ENCRYPTION_KEY", "Token encryption key"),
      ],
    },
    {
      id: "jobs",
      title: "Inngest",
      description: "Scheduled follow-ups and reply checks.",
      required: false,
      items: [
        item("INNGEST_EVENT_KEY", "Event key"),
        item("INNGEST_SIGNING_KEY", "Signing key"),
      ],
    },
  ];
}

export function isCoreSetupComplete(): boolean {
  return getSupabaseConfig() !== null && isSet("SUPABASE_SECRET_KEY");
}
