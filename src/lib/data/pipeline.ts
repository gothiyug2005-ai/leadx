import "server-only";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function getPipeline() {
  await requireUser();
  const supabase = await createClient();
  const [people, targets] = await Promise.all([
    supabase
      .from("people")
      .select(
        "id, full_name, title, stage, role_type, is_recommended, do_not_contact, is_sample, email_status, stage_changed_at, relevance_score, target_id, company:companies(name)",
      )
      .order("stage_changed_at", { ascending: false })
      .limit(2000),
    supabase
      .from("targets")
      .select("id, role_title, company:companies(name)")
      .neq("status", "archived")
      .order("created_at", { ascending: false }),
  ]);

  return {
    error: Boolean(people.error || targets.error),
    // Never-contacted people who were marked do-not-contact are noise on the board.
    people: (people.data ?? []).filter(
      (person) => !(person.do_not_contact && person.stage === "to_contact"),
    ),
    targets: (targets.data ?? []).map((target) => ({
      id: target.id,
      label:
        [target.role_title, target.company?.name].filter(Boolean).join(" · ") ||
        "Untitled target",
    })),
  };
}

export type PipelinePerson = Awaited<
  ReturnType<typeof getPipeline>
>["people"][number];
