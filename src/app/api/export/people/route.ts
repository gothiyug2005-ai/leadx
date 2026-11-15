import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { readAngles } from "@/lib/discovery/view";
import { toCsv } from "@/lib/export/csv";
import {
  CLASSIFICATION_LABELS,
  ROLE_TYPE_LABELS,
  STAGE_LABELS,
  labelFor,
} from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

/** Everyone the user has found, with their stage and outreach history, as CSV. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const supabase = await createClient();
  const { data: people, error } = await supabase
    .from("people")
    .select(
      "full_name, title, email, email_status, linkedin_url, location, stage, role_type, relevance_score, connection_angles, do_not_contact, notes, is_sample, created_at, company:companies(name, domain), target:targets(role_title), messages(status, sent_at, type), threads(classification, last_inbound_at)",
    )
    .order("created_at", { ascending: true })
    .limit(10000);
  if (error)
    return NextResponse.json(
      { error: "Could not export right now." },
      { status: 500 },
    );

  const headers = [
    "Name",
    "Title",
    "Company",
    "Company website",
    "Role",
    "Stage",
    "Contact type",
    "Match score",
    "Email",
    "Email status",
    "First emailed",
    "Emails sent",
    "Last reply",
    "Reply type",
    "Shared background",
    "Do not contact",
    "Sample",
    "LinkedIn",
    "Location",
    "Notes",
    "Added",
  ];
  const rows = (people ?? []).map((person) => {
    const sent = (person.messages ?? []).filter(
      (message) => message.status === "sent" && message.type !== "reply",
    );
    const firstSent =
      sent
        .map((message) => message.sent_at)
        .filter(Boolean)
        .sort()[0] ?? null;
    const thread = [...(person.threads ?? [])].sort((a, b) =>
      (b.last_inbound_at ?? "").localeCompare(a.last_inbound_at ?? ""),
    )[0];
    return [
      person.full_name,
      person.title,
      person.company?.name,
      person.company?.domain,
      person.target?.role_title,
      labelFor(STAGE_LABELS, person.stage),
      labelFor(ROLE_TYPE_LABELS, person.role_type),
      person.relevance_score,
      person.email,
      person.email_status,
      firstSent,
      sent.length,
      thread?.last_inbound_at ?? null,
      labelFor(CLASSIFICATION_LABELS, thread?.classification),
      readAngles(person.connection_angles).map((angle) => angle.detail),
      person.do_not_contact ? "yes" : "no",
      person.is_sample ? "yes" : "no",
      person.linkedin_url,
      person.location,
      person.notes,
      person.created_at,
    ];
  });

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(toCsv(headers, rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="leadx-people-${date}.csv"`,
      "cache-control": "no-store",
    },
  });
}
