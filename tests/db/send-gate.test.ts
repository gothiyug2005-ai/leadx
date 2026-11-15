import { afterAll, describe, expect, it } from "vitest";

import {
  claim,
  closeDb,
  createFixture,
  createQueuedMessage,
  db,
  hasDatabase,
  withRollback,
} from "./helpers";

describe.skipIf(!hasDatabase)("send gate (claim_send_slot)", () => {
  afterAll(closeDb);

  it("lets an approved, queued email through and reserves a slot", async () => {
    await withRollback(async (tx) => {
      const fixture = await createFixture(tx);
      const messageId = await createQueuedMessage(tx, fixture);

      const result = await claim(tx, fixture.userId, messageId);

      expect(result).toMatchObject({
        allowed: true,
        kind: "outreach",
        to_email: "priya@acme.example",
        used: 1,
        cap: 20,
      });
      const [message] =
        await tx`select status from public.messages where id = ${messageId}`;
      expect(message?.status).toBe("sending");
      const [event] =
        await tx`select status, kind from public.send_events where id = ${result.event_id!}`;
      expect(event).toMatchObject({ status: "reserved", kind: "outreach" });
    });
  });

  it("refuses a message the user never approved", async () => {
    await withRollback(async (tx) => {
      const fixture = await createFixture(tx);
      const draftId = await createQueuedMessage(tx, fixture, {
        approved: false,
      });

      expect(await claim(tx, fixture.userId, draftId)).toMatchObject({
        allowed: false,
        reason: "not_queued",
      });
      expect(
        await tx`select id from public.send_events where user_id = ${fixture.userId}`,
      ).toHaveLength(0);
    });
  });

  it("refuses to send the same message twice", async () => {
    await withRollback(async (tx) => {
      const fixture = await createFixture(tx);
      const messageId = await createQueuedMessage(tx, fixture);

      expect((await claim(tx, fixture.userId, messageId)).allowed).toBe(true);
      expect(await claim(tx, fixture.userId, messageId)).toMatchObject({
        allowed: false,
        reason: "already_sent",
      });
    });
  });

  it("refuses to act on another user's message", async () => {
    await withRollback(async (tx) => {
      const alice = await createFixture(tx);
      const bob = await createFixture(tx);
      const aliceMessage = await createQueuedMessage(tx, alice);

      expect(await claim(tx, bob.userId, aliceMessage)).toMatchObject({
        allowed: false,
        reason: "message_not_found",
      });
    });
  });

  it("enforces the daily cap", async () => {
    await withRollback(async (tx) => {
      const fixture = await createFixture(tx);
      await tx`update public.profiles set daily_send_cap = 2 where id = ${fixture.userId}`;

      const first = await createQueuedMessage(tx, fixture);
      const second = await createQueuedMessage(tx, fixture);
      const third = await createQueuedMessage(tx, fixture);

      expect((await claim(tx, fixture.userId, first)).allowed).toBe(true);
      expect((await claim(tx, fixture.userId, second)).allowed).toBe(true);

      const blocked = await claim(tx, fixture.userId, third);
      expect(blocked).toMatchObject({
        allowed: false,
        reason: "daily_cap_reached",
        used: 2,
        cap: 2,
      });

      // The blocked message stays queued so it can go out on a later day.
      const [message] =
        await tx`select status from public.messages where id = ${third}`;
      expect(message?.status).toBe("scheduled");
    });
  });

  it("counts the cap per calendar day in the user's own timezone", async () => {
    await withRollback(async (tx) => {
      const fixture = await createFixture(tx);
      await tx`
        update public.profiles set daily_send_cap = 1, timezone = 'Asia/Kolkata' where id = ${fixture.userId}
      `;
      const first = await createQueuedMessage(tx, fixture);
      const second = await createQueuedMessage(tx, fixture);
      const third = await createQueuedMessage(tx, fixture);

      // 18:00 UTC on 1 March is 23:30 on 1 March in India.
      const lateEvening = await claim(tx, fixture.userId, first, {
        now: "2026-03-01T18:00:00Z",
      });
      expect(lateEvening).toMatchObject({
        allowed: true,
        local_day: "2026-03-01",
      });
      await tx`update public.send_events set status = 'sent' where id = ${lateEvening.event_id!}`;

      // 18:20 UTC is still 1 March in India: the cap of 1 is used up.
      const sameDay = await claim(tx, fixture.userId, second, {
        now: "2026-03-01T18:20:00Z",
      });
      expect(sameDay).toMatchObject({
        allowed: false,
        reason: "daily_cap_reached",
      });

      // 18:40 UTC is 00:10 on 2 March in India: a new day, even though UTC has not rolled over.
      const nextDay = await claim(tx, fixture.userId, third, {
        now: "2026-03-01T18:40:00Z",
      });
      expect(nextDay).toMatchObject({ allowed: true, local_day: "2026-03-02" });
    });
  });

  it("stops counting a reservation that never completed after 15 minutes", async () => {
    await withRollback(async (tx) => {
      const fixture = await createFixture(tx);
      await tx`update public.profiles set daily_send_cap = 1 where id = ${fixture.userId}`;
      const first = await createQueuedMessage(tx, fixture);
      const second = await createQueuedMessage(tx, fixture);

      expect(
        (
          await claim(tx, fixture.userId, first, {
            now: "2026-03-01T09:00:00Z",
          })
        ).allowed,
      ).toBe(true);
      // The first send crashed and was never marked sent. Five minutes later the slot is still held...
      expect(
        (
          await claim(tx, fixture.userId, second, {
            now: "2026-03-01T09:05:00Z",
          })
        ).reason,
      ).toBe("daily_cap_reached");
      // ...but after 15 minutes it is released.
      expect(
        (
          await claim(tx, fixture.userId, second, {
            now: "2026-03-01T09:16:00Z",
          })
        ).allowed,
      ).toBe(true);
    });
  });

  it("does not count failed sends against the cap", async () => {
    await withRollback(async (tx) => {
      const fixture = await createFixture(tx);
      await tx`update public.profiles set daily_send_cap = 1 where id = ${fixture.userId}`;
      const first = await createQueuedMessage(tx, fixture);
      const second = await createQueuedMessage(tx, fixture);

      const result = await claim(tx, fixture.userId, first);
      await tx`update public.send_events set status = 'failed' where id = ${result.event_id!}`;

      expect((await claim(tx, fixture.userId, second)).allowed).toBe(true);
    });
  });

  it("refuses a suppressed address (opt-out or never email again)", async () => {
    await withRollback(async (tx) => {
      const fixture = await createFixture(tx);
      const messageId = await createQueuedMessage(tx, fixture);
      await tx`
        insert into public.suppressions (user_id, email, reason)
        values (${fixture.userId}, 'priya@acme.example', 'opt_out')
      `;

      expect(await claim(tx, fixture.userId, messageId)).toMatchObject({
        allowed: false,
        reason: "suppressed",
      });
    });
  });

  it("only applies a suppression to the user who owns it", async () => {
    await withRollback(async (tx) => {
      const alice = await createFixture(tx);
      const bob = await createFixture(tx);
      await tx`
        insert into public.suppressions (user_id, email, reason)
        values (${bob.userId}, 'priya@acme.example', 'opt_out')
      `;
      const aliceMessage = await createQueuedMessage(tx, alice);

      expect((await claim(tx, alice.userId, aliceMessage)).allowed).toBe(true);
    });
  });

  it("refuses a person marked do-not-contact", async () => {
    await withRollback(async (tx) => {
      const fixture = await createFixture(tx);
      const messageId = await createQueuedMessage(tx, fixture);
      await tx`update public.people set do_not_contact = true where id = ${fixture.personId}`;

      expect(await claim(tx, fixture.userId, messageId)).toMatchObject({
        allowed: false,
        reason: "do_not_contact",
      });
    });
  });

  it("never sends real email to sample people, but lets the mock provider simulate it", async () => {
    await withRollback(async (tx) => {
      const fixture = await createFixture(tx, { isSample: true });
      const messageId = await createQueuedMessage(tx, fixture);

      expect(
        await claim(tx, fixture.userId, messageId, { provider: "gmail" }),
      ).toMatchObject({
        allowed: false,
        reason: "sample_data",
      });
      expect(
        (await claim(tx, fixture.userId, messageId, { provider: "mock" }))
          .allowed,
      ).toBe(true);
    });
  });

  it("refuses invalid addresses and people with no address", async () => {
    await withRollback(async (tx) => {
      const invalid = await createFixture(tx, { emailStatus: "invalid" });
      const invalidMessage = await createQueuedMessage(tx, invalid);
      expect((await claim(tx, invalid.userId, invalidMessage)).reason).toBe(
        "invalid_email",
      );

      const missing = await createFixture(tx);
      await tx`update public.people set email = null where id = ${missing.personId}`;
      const missingMessage = await createQueuedMessage(tx, missing);
      expect((await claim(tx, missing.userId, missingMessage)).reason).toBe(
        "missing_email",
      );
    });
  });

  it("needs explicit confirmation before sending to a risky address", async () => {
    await withRollback(async (tx) => {
      const fixture = await createFixture(tx, { emailStatus: "risky" });
      const messageId = await createQueuedMessage(tx, fixture);

      expect(await claim(tx, fixture.userId, messageId)).toMatchObject({
        allowed: false,
        reason: "unverified_email",
      });

      await tx`update public.people set email_risk_accepted_at = now() where id = ${fixture.personId}`;
      expect((await claim(tx, fixture.userId, messageId)).allowed).toBe(true);
    });
  });

  it("lets a reply through when the cap is used up, but still honours opt-outs", async () => {
    await withRollback(async (tx) => {
      const fixture = await createFixture(tx);
      await tx`update public.profiles set daily_send_cap = 1 where id = ${fixture.userId}`;

      const outreach = await createQueuedMessage(tx, fixture);
      expect((await claim(tx, fixture.userId, outreach)).allowed).toBe(true);

      const reply = await createQueuedMessage(tx, fixture, { type: "reply" });
      const result = await claim(tx, fixture.userId, reply, {
        replyTo: "Priya.Personal@Example.com",
      });
      expect(result).toMatchObject({
        allowed: true,
        kind: "reply",
        to_email: "priya.personal@example.com",
      });

      await tx`
        insert into public.suppressions (user_id, email, reason)
        values (${fixture.userId}, 'priya@acme.example', 'opt_out')
      `;
      const secondReply = await createQueuedMessage(tx, fixture, {
        type: "reply",
      });
      expect((await claim(tx, fixture.userId, secondReply)).reason).toBe(
        "suppressed",
      );
    });
  });

  it("ignores a recipient override on outreach email", async () => {
    await withRollback(async (tx) => {
      const fixture = await createFixture(tx);
      const messageId = await createQueuedMessage(tx, fixture);

      const result = await claim(tx, fixture.userId, messageId, {
        replyTo: "someone.else@example.com",
      });
      expect(result).toMatchObject({
        allowed: true,
        to_email: "priya@acme.example",
      });
    });
  });

  it("cannot be raced past the cap by simultaneous sends", async () => {
    // This test commits real rows so that separate connections can see them, then cleans up.
    const sql = db();
    const fixture = await createFixture(sql);
    try {
      await sql`update public.profiles set daily_send_cap = 3 where id = ${fixture.userId}`;
      const messageIds = await Promise.all(
        Array.from({ length: 8 }, () => createQueuedMessage(sql, fixture)),
      );

      const results = await Promise.all(
        messageIds.map((messageId) => claim(sql, fixture.userId, messageId)),
      );

      expect(results.filter((result) => result.allowed)).toHaveLength(3);
      expect(
        results
          .filter((result) => !result.allowed)
          .every((result) => result.reason === "daily_cap_reached"),
      ).toBe(true);
    } finally {
      await sql`delete from auth.users where id = ${fixture.userId}`;
    }
  });

  it("reports sends remaining today to the signed-in user", async () => {
    await withRollback(async (tx) => {
      const fixture = await createFixture(tx);
      await tx`update public.profiles set daily_send_cap = 5 where id = ${fixture.userId}`;
      const messageId = await createQueuedMessage(tx, fixture);
      const result = await claim(tx, fixture.userId, messageId);
      await tx`update public.send_events set status = 'sent' where id = ${result.event_id!}`;

      const claims = JSON.stringify({
        sub: fixture.userId,
        role: "authenticated",
      });
      await tx`select set_config('request.jwt.claims', ${claims}, true)`;
      await tx`set local role authenticated`;
      const [row] = await tx<
        { result: { used: number; cap: number; remaining: number } }[]
      >`
        select public.sends_remaining_today() as result
      `;
      await tx`reset role`;

      expect(row?.result).toMatchObject({ used: 1, cap: 5, remaining: 4 });
    });
  });
});
