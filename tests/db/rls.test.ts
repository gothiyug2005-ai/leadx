import { afterAll, describe, expect, it } from "vitest";

import {
  asAnon,
  asUser,
  closeDb,
  createFixture,
  createUser,
  db,
  expectFailure,
  hasDatabase,
  withRollback,
} from "./helpers";

const INSUFFICIENT_PRIVILEGE = "42501";
const FOREIGN_KEY_VIOLATION = "23503";
const CHECK_VIOLATION = "23514";

/** Tables a user owns outright: full read and write on their own rows only. */
const OWNED_TABLES = [
  "companies",
  "targets",
  "people",
  "research_briefs",
  "sequences",
  "messages",
  "threads",
  "thread_messages",
] as const;

describe.skipIf(!hasDatabase)("database security", () => {
  afterAll(closeDb);

  it("has Row Level Security enabled on every public table", async () => {
    const rows = await db()<{ relname: string }[]>`
      select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
    `;
    expect(rows.map((row) => row.relname)).toEqual([]);
  });

  it("gives the anonymous role no access to any public table", async () => {
    const rows = await db()<{ table_name: string; privilege_type: string }[]>`
      select table_name, privilege_type
      from information_schema.role_table_grants
      where table_schema = 'public' and grantee = 'anon'
    `;
    expect(rows).toEqual([]);
  });

  it("creates a profile with the Google name when a user signs up", async () => {
    await withRollback(async (tx) => {
      const userId = await createUser(tx, {
        name: "Yug Example",
        email: "yug@leadx.test",
      });
      const [profile] =
        await tx`select * from public.profiles where id = ${userId}`;
      expect(profile).toMatchObject({
        email: "yug@leadx.test",
        full_name: "Yug Example",
        tone: "warm",
        daily_send_cap: 20,
        timezone: "UTC",
      });
    });
  });

  it("lets a user read and change only their own profile", async () => {
    await withRollback(async (tx) => {
      const alice = await createUser(tx);
      const bob = await createUser(tx);

      await asUser(tx, alice, async () => {
        const visible = await tx`select id from public.profiles`;
        expect(visible.map((row) => row.id)).toEqual([alice]);

        const updated = await tx`
          update public.profiles set headline = 'hacked' where id = ${bob} returning id
        `;
        expect(updated).toHaveLength(0);

        const own = await tx`
          update public.profiles set headline = 'Engineer' where id = ${alice} returning headline
        `;
        expect(own[0]?.headline).toBe("Engineer");
      });
    });
  });

  it("caps the daily send limit at 40 in the database itself", async () => {
    await withRollback(async (tx) => {
      const userId = await createUser(tx);
      await asUser(tx, userId, async () => {
        const tooHigh = await expectFailure(
          tx,
          (sp) =>
            sp`update public.profiles set daily_send_cap = 41 where id = ${userId}`,
        );
        expect(tooHigh).toBe(CHECK_VIOLATION);

        const tooLow = await expectFailure(
          tx,
          (sp) =>
            sp`update public.profiles set daily_send_cap = 0 where id = ${userId}`,
        );
        expect(tooLow).toBe(CHECK_VIOLATION);

        const ok = await tx`
          update public.profiles set daily_send_cap = 40 where id = ${userId} returning daily_send_cap
        `;
        expect(ok[0]?.daily_send_cap).toBe(40);
      });
    });
  });

  it("hides every owned table from other users and from signed-out visitors", async () => {
    await withRollback(async (tx) => {
      const alice = await createFixture(tx);
      const bob = await createUser(tx);

      const [sequence] = await tx`
        insert into public.sequences (user_id, person_id, target_id)
        values (${alice.userId}, ${alice.personId}, ${alice.targetId}) returning id
      `;
      await tx`
        insert into public.messages (user_id, person_id, target_id, sequence_id, channel, type, body)
        values (${alice.userId}, ${alice.personId}, ${alice.targetId}, ${sequence!.id}, 'email', 'cold_email', 'Hi')
      `;
      const [thread] = await tx`
        insert into public.threads (user_id, person_id, gmail_thread_id)
        values (${alice.userId}, ${alice.personId}, 'thread-1') returning id
      `;
      await tx`
        insert into public.thread_messages (user_id, thread_id, gmail_message_id, direction, sent_at)
        values (${alice.userId}, ${thread!.id}, 'gm-1', 'outbound', now())
      `;
      await tx`
        insert into public.research_briefs (user_id, scope, company_id, content)
        values (${alice.userId}, 'company', ${alice.companyId}, '{}'::jsonb)
      `;

      for (const table of OWNED_TABLES) {
        const own = await asUser(
          tx,
          alice.userId,
          () => tx`select id from public.${tx(table)}`,
        );
        expect(own.length, `${table}: owner sees their rows`).toBeGreaterThan(
          0,
        );

        const other = await asUser(
          tx,
          bob,
          () => tx`select id from public.${tx(table)}`,
        );
        expect(other, `${table}: another user sees nothing`).toHaveLength(0);

        const anonCode = await asAnon(tx, () =>
          expectFailure(tx, (sp) => sp`select id from public.${sp(table)}`),
        );
        expect(anonCode, `${table}: signed-out visitors are refused`).toBe(
          INSUFFICIENT_PRIVILEGE,
        );
      }
    });
  });

  it("stops a user from changing or deleting another user's rows", async () => {
    await withRollback(async (tx) => {
      const alice = await createFixture(tx);
      const bob = await createUser(tx);

      await asUser(tx, bob, async () => {
        const updated = await tx`
          update public.people set full_name = 'Changed' where id = ${alice.personId} returning id
        `;
        expect(updated).toHaveLength(0);

        const deleted =
          await tx`delete from public.targets where id = ${alice.targetId} returning id`;
        expect(deleted).toHaveLength(0);
      });

      const [person] =
        await tx`select full_name from public.people where id = ${alice.personId}`;
      expect(person?.full_name).toBe("Priya Raman");
    });
  });

  it("stops a user from creating rows on behalf of someone else", async () => {
    await withRollback(async (tx) => {
      const alice = await createUser(tx);
      const bob = await createUser(tx);

      await asUser(tx, bob, async () => {
        const code = await expectFailure(
          tx,
          (sp) =>
            sp`insert into public.companies (user_id, name) values (${alice}, 'Planted')`,
        );
        expect(code).toBe(INSUFFICIENT_PRIVILEGE);

        // Leaving user_id out fills it in with the signed-in user.
        const [own] =
          await tx`insert into public.companies (name) values ('Mine') returning user_id`;
        expect(own?.user_id).toBe(bob);
      });
    });
  });

  it("stops a row from pointing at a parent owned by another user", async () => {
    await withRollback(async (tx) => {
      const alice = await createFixture(tx);
      const bob = await createFixture(tx);

      await asUser(tx, bob.userId, async () => {
        const code = await expectFailure(
          tx,
          (sp) =>
            sp`
            insert into public.people (target_id, company_id, full_name)
            values (${alice.targetId}, ${alice.companyId}, 'Smuggled')
          `,
        );
        expect(code).toBe(FOREIGN_KEY_VIOLATION);
      });
    });
  });

  it("keeps the send log and usage records read-only for users", async () => {
    await withRollback(async (tx) => {
      const alice = await createFixture(tx);
      await tx`
        insert into public.send_events (user_id, person_id, to_email, kind, status, provider, local_day)
        values (${alice.userId}, ${alice.personId}, 'priya@acme.example', 'outreach', 'sent', 'gmail', current_date)
      `;
      await tx`
        insert into public.api_usage (user_id, provider, operation) values (${alice.userId}, 'anthropic', 'write')
      `;

      await asUser(tx, alice.userId, async () => {
        expect(await tx`select id from public.send_events`).toHaveLength(1);
        expect(await tx`select id from public.api_usage`).toHaveLength(1);

        for (const statement of [
          (sp: typeof tx) => sp`delete from public.send_events`,
          (sp: typeof tx) =>
            sp`update public.send_events set status = 'failed'`,
          (sp: typeof tx) =>
            sp`insert into public.send_events (user_id, to_email, kind, status, provider, local_day)
               values (${alice.userId}, 'x@acme.example', 'outreach', 'failed', 'gmail', current_date)`,
          (sp: typeof tx) => sp`delete from public.api_usage`,
          (sp: typeof tx) =>
            sp`insert into public.api_usage (user_id, provider, operation) values (${alice.userId}, 'x', 'y')`,
        ]) {
          expect(await expectFailure(tx, statement)).toBe(
            INSUFFICIENT_PRIVILEGE,
          );
        }
      });
    });
  });

  it("lets a user add a suppression but never remove one", async () => {
    await withRollback(async (tx) => {
      const alice = await createUser(tx);
      await asUser(tx, alice, async () => {
        await tx`insert into public.suppressions (email, reason) values ('stop@acme.example', 'manual')`;
        expect(await tx`select email from public.suppressions`).toHaveLength(1);

        const deleteCode = await expectFailure(
          tx,
          (sp) => sp`delete from public.suppressions`,
        );
        expect(deleteCode).toBe(INSUFFICIENT_PRIVILEGE);

        const updateCode = await expectFailure(
          tx,
          (sp) =>
            sp`update public.suppressions set email = 'other@acme.example'`,
        );
        expect(updateCode).toBe(INSUFFICIENT_PRIVILEGE);
      });
    });
  });

  it("keeps Gmail tokens and the provider cache out of reach of users", async () => {
    await withRollback(async (tx) => {
      const alice = await createUser(tx);
      await tx`insert into public.gmail_connections (user_id, email) values (${alice}, 'alice@gmail.test')`;
      await tx`insert into public.gmail_tokens (user_id, refresh_token_enc) values (${alice}, 'ciphertext')`;

      await asUser(tx, alice, async () => {
        const connection = await tx`select email from public.gmail_connections`;
        expect(connection[0]?.email).toBe("alice@gmail.test");

        const writeCode = await expectFailure(
          tx,
          (sp) =>
            sp`update public.gmail_connections set email = 'x@gmail.test'`,
        );
        expect(writeCode).toBe(INSUFFICIENT_PRIVILEGE);

        const tokens = await expectFailure(
          tx,
          (sp) => sp`select * from public.gmail_tokens`,
        );
        expect(tokens).toBe(INSUFFICIENT_PRIVILEGE);

        const cache = await expectFailure(
          tx,
          (sp) => sp`select * from public.provider_cache`,
        );
        expect(cache).toBe(INSUFFICIENT_PRIVILEGE);
      });
    });
  });

  it("refuses to queue a message that the user has not approved", async () => {
    await withRollback(async (tx) => {
      const alice = await createFixture(tx);
      await asUser(tx, alice.userId, async () => {
        const [draft] = await tx`
          insert into public.messages (person_id, target_id, channel, type, body)
          values (${alice.personId}, ${alice.targetId}, 'email', 'cold_email', 'Hi') returning id
        `;

        const code = await expectFailure(
          tx,
          (sp) =>
            sp`update public.messages set status = 'scheduled' where id = ${draft!.id}`,
        );
        expect(code).toBe(CHECK_VIOLATION);

        const ok = await tx`
          update public.messages set status = 'scheduled', approved_at = now(), scheduled_at = now()
          where id = ${draft!.id} returning status
        `;
        expect(ok[0]?.status).toBe("scheduled");
      });
    });
  });

  it("never lets a LinkedIn message enter the send pipeline", async () => {
    await withRollback(async (tx) => {
      const alice = await createFixture(tx);
      await asUser(tx, alice.userId, async () => {
        const code = await expectFailure(
          tx,
          (sp) =>
            sp`
            insert into public.messages (person_id, target_id, channel, type, body, status, approved_at)
            values (${alice.personId}, ${alice.targetId}, 'linkedin', 'linkedin_dm', 'Hi', 'scheduled', now())
          `,
        );
        expect(code).toBe(CHECK_VIOLATION);

        const copied = await tx`
          insert into public.messages (person_id, target_id, channel, type, body, status)
          values (${alice.personId}, ${alice.targetId}, 'linkedin', 'linkedin_note', 'Hi', 'copied')
          returning status
        `;
        expect(copied[0]?.status).toBe("copied");
      });
    });
  });

  it("does not let users call the send gate directly", async () => {
    await withRollback(async (tx) => {
      const alice = await createFixture(tx);
      await asUser(tx, alice.userId, async () => {
        const code = await expectFailure(
          tx,
          (sp) =>
            sp`select public.claim_send_slot(${alice.userId}::uuid, gen_random_uuid(), 'gmail')`,
        );
        expect(code).toBe(INSUFFICIENT_PRIVILEGE);
      });
    });
  });

  it("keeps resumes private to their owner", async () => {
    await withRollback(async (tx) => {
      const alice = await createUser(tx);
      const bob = await createUser(tx);

      await asUser(tx, alice, async () => {
        await tx`
          insert into storage.objects (bucket_id, name, owner_id)
          values ('resumes', ${`${alice}/resume.pdf`}, ${alice})
        `;
        const code = await expectFailure(
          tx,
          (sp) =>
            sp`
            insert into storage.objects (bucket_id, name, owner_id)
            values ('resumes', ${`${bob}/resume.pdf`}, ${alice})
          `,
        );
        expect(code).toBe(INSUFFICIENT_PRIVILEGE);
      });

      const forBob = await asUser(
        tx,
        bob,
        () => tx`select name from storage.objects where bucket_id = 'resumes'`,
      );
      expect(forBob).toHaveLength(0);

      const forAlice = await asUser(
        tx,
        alice,
        () => tx`select name from storage.objects where bucket_id = 'resumes'`,
      );
      expect(forAlice).toHaveLength(1);
    });
  });
});
