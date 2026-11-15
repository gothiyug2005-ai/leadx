import postgres from "postgres";

export const databaseUrl = process.env.TEST_DATABASE_URL ?? "";
export const hasDatabase = databaseUrl !== "";

type Sql = postgres.Sql;
type Tx = postgres.TransactionSql;

let client: Sql | undefined;

export function db(): Sql {
  client ??= postgres(databaseUrl, { max: 4, onnotice: () => {} });
  return client;
}

export async function closeDb(): Promise<void> {
  await client?.end({ timeout: 5 });
  client = undefined;
}

class Rollback extends Error {}

/** Run a test inside a transaction that is always rolled back, so tests leave no trace. */
export async function withRollback<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  let result: T | undefined;
  try {
    await db().begin(async (tx) => {
      result = await fn(tx);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
  return result as T;
}

let counter = 0;

/** Insert an auth user the way Supabase Auth does. The signup trigger creates the profile. */
export async function createUser(
  sql: Sql | Tx,
  options: { name?: string; email?: string } = {},
): Promise<string> {
  counter += 1;
  const email =
    options.email ??
    `user-${Date.now()}-${counter}-${Math.random().toString(36).slice(2, 8)}@leadx.test`;
  const metadata = { full_name: options.name ?? "Test User" };
  const rows = await sql<{ id: string }[]>`
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_user_meta_data, raw_app_meta_data, created_at, updated_at
    )
    values (
      gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      ${email}, '', now(), ${sql.json(metadata)}, '{}'::jsonb, now(), now()
    )
    returning id
  `;
  return rows[0]!.id;
}

/** Run queries exactly as the Data API would for a signed-in user. */
export async function asUser<T>(
  tx: Tx,
  userId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const claims = JSON.stringify({ sub: userId, role: "authenticated" });
  await tx`select set_config('request.jwt.claims', ${claims}, true)`;
  await tx`set local role authenticated`;
  try {
    return await fn();
  } finally {
    await tx`reset role`;
    await tx`select set_config('request.jwt.claims', '', true)`;
  }
}

/** Run queries as a visitor who is not signed in. */
export async function asAnon<T>(tx: Tx, fn: () => Promise<T>): Promise<T> {
  await tx`select set_config('request.jwt.claims', '', true)`;
  await tx`set local role anon`;
  try {
    return await fn();
  } finally {
    await tx`reset role`;
  }
}

/**
 * Expect a statement to fail without poisoning the surrounding transaction.
 * Returns the Postgres error code (for example '42501' = insufficient privilege).
 */
export async function expectFailure(
  tx: Tx,
  fn: (sp: Tx) => Promise<unknown>,
): Promise<string> {
  try {
    await tx.savepoint(async (sp) => {
      await fn(sp);
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    return code ?? "unknown";
  }
  throw new Error("Expected the statement to fail, but it succeeded");
}

export interface Fixture {
  userId: string;
  companyId: string;
  targetId: string;
  personId: string;
}

/** A user with one company, one target and one person with a verified email. */
export async function createFixture(
  sql: Sql | Tx,
  overrides: { email?: string; isSample?: boolean; emailStatus?: string } = {},
): Promise<Fixture> {
  const userId = await createUser(sql);
  const [company] = await sql<{ id: string }[]>`
    insert into public.companies (user_id, name, domain)
    values (${userId}, 'Acme', 'acme.example') returning id
  `;
  const [target] = await sql<{ id: string }[]>`
    insert into public.targets (user_id, company_id, kind, role_title)
    values (${userId}, ${company!.id}, 'company', 'Engineer') returning id
  `;
  const [person] = await sql<{ id: string }[]>`
    insert into public.people (user_id, target_id, company_id, full_name, email, email_status, is_sample)
    values (
      ${userId}, ${target!.id}, ${company!.id}, 'Priya Raman',
      ${overrides.email ?? "priya@acme.example"}, ${overrides.emailStatus ?? "valid"}, ${overrides.isSample ?? false}
    )
    returning id
  `;
  return {
    userId,
    companyId: company!.id,
    targetId: target!.id,
    personId: person!.id,
  };
}

/** An approved, queued email for the fixture's person. */
export async function createQueuedMessage(
  sql: Sql | Tx,
  fixture: Fixture,
  overrides: {
    type?: string;
    approved?: boolean;
    status?: string;
    body?: string;
  } = {},
): Promise<string> {
  const approved = overrides.approved ?? true;
  const [message] = await sql<{ id: string }[]>`
    insert into public.messages (user_id, person_id, target_id, channel, type, subject, body, status, approved_at, scheduled_at)
    values (
      ${fixture.userId}, ${fixture.personId}, ${fixture.targetId}, 'email', ${overrides.type ?? "cold_email"},
      'Quick question', ${overrides.body ?? "Hello there."}, ${overrides.status ?? (approved ? "scheduled" : "draft")},
      ${approved ? sql`now()` : null}, now()
    )
    returning id
  `;
  return message!.id;
}

export interface ClaimResult {
  allowed: boolean;
  reason?: string;
  event_id?: string;
  kind?: string;
  to_email?: string;
  used?: number;
  cap?: number;
  local_day?: string;
}

export async function claim(
  sql: Sql | Tx,
  userId: string,
  messageId: string,
  options: { provider?: string; now?: string; replyTo?: string } = {},
): Promise<ClaimResult> {
  const rows = await sql<{ result: ClaimResult }[]>`
    select public.claim_send_slot(
      ${userId}::uuid, ${messageId}::uuid, ${options.provider ?? "gmail"},
      ${options.now ?? null}::timestamptz, ${options.replyTo ?? null}
    ) as result
  `;
  return rows[0]!.result;
}
