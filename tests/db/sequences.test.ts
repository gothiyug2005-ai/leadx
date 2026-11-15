import { afterAll, describe, expect, it } from "vitest";

import { handleInbound } from "@/lib/replies/handle";
import { processDueMessages } from "@/lib/sequences/process";

import {
  closeDb,
  createFixture,
  db,
  hasDatabase,
  type Fixture,
} from "./helpers";

const hasServer = hasDatabase && Boolean(process.env.SUPABASE_SECRET_KEY);

/**
 * These tests drive the real server code (follow-up sender, reply handler)
 * against the local database, so they commit rows and clean up afterwards.
 */
describe.skipIf(!hasServer)("sequences and replies", () => {
  const created: string[] = [];
  afterAll(async () => {
    for (const userId of created)
      await db()`delete from auth.users where id = ${userId}`;
    await closeDb();
  });

  async function setup(): Promise<
    Fixture & { sequenceId: string; threadId: string; followUps: string[] }
  > {
    const sql = db();
    const fixture = await createFixture(sql, { isSample: true });
    created.push(fixture.userId);
    const gmailThreadId = `mock-thread-${fixture.personId}`;
    const [sequence] = await sql<{ id: string }[]>`
      insert into public.sequences (user_id, person_id, target_id, status, started_at, gmail_thread_id)
      values (${fixture.userId}, ${fixture.personId}, ${fixture.targetId}, 'active', now() - interval '8 days', ${gmailThreadId})
      returning id`;
    await sql`
      insert into public.messages (user_id, person_id, target_id, sequence_id, channel, type, subject, body, status, approved_at, sent_at, gmail_thread_id)
      values (${fixture.userId}, ${fixture.personId}, ${fixture.targetId}, ${sequence!.id}, 'email', 'cold_email', 'Hello', 'First email', 'sent', now(), now() - interval '8 days', ${gmailThreadId})`;
    const [thread] = await sql<{ id: string }[]>`
      insert into public.threads (user_id, person_id, sequence_id, gmail_thread_id, subject, is_sample)
      values (${fixture.userId}, ${fixture.personId}, ${sequence!.id}, ${gmailThreadId}, 'Hello', true) returning id`;
    const followUps: string[] = [];
    for (const step of [1, 2]) {
      const [row] = await sql<{ id: string }[]>`
        insert into public.messages (user_id, person_id, target_id, sequence_id, channel, type, sequence_step, subject, body, status, approved_at, scheduled_at)
        values (${fixture.userId}, ${fixture.personId}, ${fixture.targetId}, ${sequence!.id}, 'email', 'follow_up', ${step},
                'Re: Hello', 'Just following up. Would a quick chat work? If now isn''t a good time, no worries.', 'scheduled', now(), now() - interval '1 hour')
        returning id`;
      followUps.push(row!.id);
    }
    return {
      ...fixture,
      sequenceId: sequence!.id,
      threadId: thread!.id,
      followUps,
    };
  }

  const statusOf = async (id: string) =>
    (await db()`select status from public.messages where id = ${id}`)[0]
      ?.status;

  it("sends one due follow-up per run and spaces out the rest", async () => {
    const fixture = await setup();
    await processDueMessages(new Date());
    const statuses = await Promise.all(fixture.followUps.map(statusOf));
    expect(statuses.filter((status) => status === "sent")).toHaveLength(1);
    expect(statuses.filter((status) => status === "scheduled")).toHaveLength(1);
    const [later] =
      await db()`select scheduled_at from public.messages where id = any(${fixture.followUps}) and status = 'scheduled'`;
    expect(new Date(later!.scheduled_at).getTime()).toBeGreaterThan(Date.now());
    const [person] =
      await db()`select stage from public.people where id = ${fixture.personId}`;
    expect(person?.stage).toBe("contacted");
  });

  it("stops the sequence on a reply and cancels what was left", async () => {
    const fixture = await setup();
    const result = await handleInbound({
      userId: fixture.userId,
      threadId: fixture.threadId,
      gmailMessageId: `test-${fixture.threadId}`,
      fromEmail: "priya@acme.example",
      fromName: "Priya",
      subject: "Re: Hello",
      text: "Thanks! Happy to chat on Thursday.",
      sentAt: new Date(),
      kind: "human",
    });
    expect(result).toMatchObject({
      recorded: true,
      classification: "interested",
    });
    expect(await Promise.all(fixture.followUps.map(statusOf))).toEqual([
      "cancelled",
      "cancelled",
    ]);
    const [sequence] =
      await db()`select status, stop_reason from public.sequences where id = ${fixture.sequenceId}`;
    expect(sequence).toMatchObject({
      status: "stopped",
      stop_reason: "replied",
    });
    const [thread] =
      await db()`select needs_attention, classification, suggested_reply from public.threads where id = ${fixture.threadId}`;
    expect(thread).toMatchObject({
      needs_attention: true,
      classification: "interested",
    });
    expect(thread?.suggested_reply).toContain("Priya");
    const [person] =
      await db()`select stage from public.people where id = ${fixture.personId}`;
    expect(person?.stage).toBe("replied");

    // The same Gmail message arriving again changes nothing.
    const again = await handleInbound({
      userId: fixture.userId,
      threadId: fixture.threadId,
      gmailMessageId: `test-${fixture.threadId}`,
      fromEmail: null,
      fromName: null,
      subject: null,
      text: "x",
      sentAt: new Date(),
      kind: "human",
    });
    expect(again.recorded).toBe(false);

    // Nothing more goes out after the reply.
    await processDueMessages(new Date(Date.now() + 86_400_000));
    expect(await Promise.all(fixture.followUps.map(statusOf))).toEqual([
      "cancelled",
      "cancelled",
    ]);
  });

  it("treats an opt-out as never email again", async () => {
    const fixture = await setup();
    await handleInbound({
      userId: fixture.userId,
      threadId: fixture.threadId,
      gmailMessageId: `optout-${fixture.threadId}`,
      fromEmail: "Priya@Acme.example",
      fromName: "Priya",
      subject: null,
      text: "Please remove me from your list.",
      sentAt: new Date(),
      kind: "human",
    });
    const [person] =
      await db()`select do_not_contact from public.people where id = ${fixture.personId}`;
    expect(person?.do_not_contact).toBe(true);
    const suppressions =
      await db()`select email, reason from public.suppressions where user_id = ${fixture.userId} order by email`;
    expect(suppressions).toEqual([
      { email: "priya@acme.example", reason: "opt_out" },
    ]);
    const [thread] =
      await db()`select needs_attention, classification from public.threads where id = ${fixture.threadId}`;
    expect(thread).toMatchObject({
      needs_attention: false,
      classification: "opt_out",
    });
  });

  it("keeps following up after an out-of-office reply, but stops on a bounce", async () => {
    const fixture = await setup();
    await handleInbound({
      userId: fixture.userId,
      threadId: fixture.threadId,
      gmailMessageId: `ooo-${fixture.threadId}`,
      fromEmail: "priya@acme.example",
      fromName: null,
      subject: "Out of office",
      text: "Back Monday.",
      sentAt: new Date(),
      kind: "auto_reply",
    });
    expect(await Promise.all(fixture.followUps.map(statusOf))).toEqual([
      "scheduled",
      "scheduled",
    ]);

    await handleInbound({
      userId: fixture.userId,
      threadId: fixture.threadId,
      gmailMessageId: `bounce-${fixture.threadId}`,
      fromEmail: "mailer-daemon@googlemail.com",
      fromName: null,
      subject: "Delivery Status Notification",
      text: "",
      sentAt: new Date(),
      kind: "bounce",
      bouncedEmail: "priya@acme.example",
    });
    expect(await Promise.all(fixture.followUps.map(statusOf))).toEqual([
      "cancelled",
      "cancelled",
    ]);
    const [person] =
      await db()`select email_status from public.people where id = ${fixture.personId}`;
    expect(person?.email_status).toBe("invalid");
    const [suppression] =
      await db()`select reason from public.suppressions where user_id = ${fixture.userId}`;
    expect(suppression?.reason).toBe("bounce");
  });
});
