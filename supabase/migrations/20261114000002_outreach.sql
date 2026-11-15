-- LeadX outreach schema: sequences, messages, threads, suppressions, send log,
-- and the single database function every real send must pass through.

-- ---------------------------------------------------------------------------
-- sequences: initial email + up to two follow-ups for one person
-- ---------------------------------------------------------------------------

create table public.sequences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  person_id uuid not null,
  target_id uuid not null,

  status text not null default 'active' check (status in ('active', 'completed', 'stopped')),
  stop_reason text
    check (stop_reason in ('replied', 'opted_out', 'bounced', 'manual', 'suppressed', 'failed')),
  -- Days after the initial email on which follow-ups go out.
  follow_up_days integer[] not null default '{3,7}'
    check (coalesce(array_length(follow_up_days, 1), 0) <= 2),

  gmail_thread_id text,
  started_at timestamptz,
  stopped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (id, user_id),
  foreign key (person_id, user_id) references public.people (id, user_id) on delete cascade,
  foreign key (target_id, user_id) references public.targets (id, user_id) on delete cascade
);

-- A person can only be in one live sequence at a time.
create unique index sequences_one_active_per_person
  on public.sequences (person_id)
  where status = 'active';
create index sequences_user_status_idx on public.sequences (user_id, status);

create trigger sequences_set_updated_at
  before update on public.sequences
  for each row execute function private.set_updated_at();

alter table public.sequences enable row level security;

create policy sequences_owner_all on public.sequences
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.sequences from anon, authenticated;
grant select, insert, update, delete on public.sequences to authenticated;
grant all on public.sequences to service_role;

-- ---------------------------------------------------------------------------
-- messages: email and LinkedIn drafts, tied to a person
-- ---------------------------------------------------------------------------

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  person_id uuid not null,
  target_id uuid not null,
  sequence_id uuid,

  channel text not null check (channel in ('email', 'linkedin')),
  type text not null
    check (type in ('cold_email', 'referral_request', 'linkedin_note', 'linkedin_dm', 'follow_up', 'reply')),
  -- The angle the AI took, e.g. 'skills_match', 'shared_background', 'company_news'.
  angle text,
  -- Variants generated together share a group; the user picks one.
  variant_group uuid,
  is_selected boolean not null default false,

  subject text,
  body text not null default '',

  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled', 'copied')),
  -- 0 = initial email, 1 and 2 = follow-ups.
  sequence_step integer not null default 0 check (sequence_step between 0 and 2),

  -- Set only when the user explicitly approves this message for sending.
  approved_at timestamptz,
  scheduled_at timestamptz,
  sent_at timestamptz,

  gmail_message_id text,
  gmail_thread_id text,
  rfc_message_id text,
  error text,

  quality jsonb,
  model text,
  prompt_id text,
  prompt_version integer,
  is_sample boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (id, user_id),
  foreign key (person_id, user_id) references public.people (id, user_id) on delete cascade,
  foreign key (target_id, user_id) references public.targets (id, user_id) on delete cascade,
  foreign key (sequence_id, user_id) references public.sequences (id, user_id)
    on delete set null (sequence_id),

  -- LinkedIn messages are copy-to-clipboard only: they can never enter the send pipeline.
  check (channel = 'email' or status in ('draft', 'copied', 'cancelled')),
  -- A message cannot be queued or sent without the user's approval.
  check (status not in ('scheduled', 'sending', 'sent') or approved_at is not null)
);

create index messages_person_idx on public.messages (person_id, created_at desc);
create index messages_user_status_idx on public.messages (user_id, status);
create index messages_due_idx on public.messages (scheduled_at) where status = 'scheduled';
create index messages_sequence_idx on public.messages (sequence_id) where sequence_id is not null;
create index messages_variant_group_idx on public.messages (variant_group) where variant_group is not null;

create trigger messages_set_updated_at
  before update on public.messages
  for each row execute function private.set_updated_at();

alter table public.messages enable row level security;

create policy messages_owner_all on public.messages
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.messages from anon, authenticated;
grant select, insert, update, delete on public.messages to authenticated;
grant all on public.messages to service_role;

-- ---------------------------------------------------------------------------
-- threads + thread_messages: synced Gmail conversations
-- ---------------------------------------------------------------------------

create table public.threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  person_id uuid not null,
  sequence_id uuid,
  gmail_thread_id text not null,

  subject text,
  snippet text,
  last_message_at timestamptz,
  last_inbound_at timestamptz,

  classification text
    check (classification in ('interested', 'referral_offered', 'not_now', 'not_relevant', 'opt_out')),
  classification_reason text,
  suggested_reply text,
  classified_at timestamptz,
  is_sample boolean not null default false,

  -- True while there is a reply the user has not dealt with yet.
  needs_attention boolean not null default false,
  handled_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (id, user_id),
  unique (user_id, gmail_thread_id),
  foreign key (person_id, user_id) references public.people (id, user_id) on delete cascade,
  foreign key (sequence_id, user_id) references public.sequences (id, user_id)
    on delete set null (sequence_id)
);

create index threads_user_attention_idx on public.threads (user_id, needs_attention, last_message_at desc);
create index threads_person_idx on public.threads (person_id);

create trigger threads_set_updated_at
  before update on public.threads
  for each row execute function private.set_updated_at();

alter table public.threads enable row level security;

create policy threads_owner_all on public.threads
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.threads from anon, authenticated;
grant select, insert, update, delete on public.threads to authenticated;
grant all on public.threads to service_role;

create table public.thread_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  thread_id uuid not null,
  message_id uuid,
  gmail_message_id text not null,

  direction text not null check (direction in ('outbound', 'inbound')),
  -- 'auto_reply' (out of office) and 'bounce' are not treated as a real reply.
  kind text not null default 'human' check (kind in ('human', 'auto_reply', 'bounce')),
  from_email text,
  from_name text,
  to_email text,
  subject text,
  body_text text,
  snippet text,
  sent_at timestamptz not null,
  created_at timestamptz not null default now(),

  unique (user_id, gmail_message_id),
  foreign key (thread_id, user_id) references public.threads (id, user_id) on delete cascade,
  foreign key (message_id, user_id) references public.messages (id, user_id)
    on delete set null (message_id)
);

create index thread_messages_thread_idx on public.thread_messages (thread_id, sent_at);

alter table public.thread_messages enable row level security;

create policy thread_messages_owner_all on public.thread_messages
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.thread_messages from anon, authenticated;
grant select, insert, update, delete on public.thread_messages to authenticated;
grant all on public.thread_messages to service_role;

-- ---------------------------------------------------------------------------
-- suppressions: addresses that must never be emailed again
-- ---------------------------------------------------------------------------

create table public.suppressions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  email text not null check (email = lower(email) and position('@' in email) > 1),
  reason text not null check (reason in ('opt_out', 'manual', 'bounce')),
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, email)
);

alter table public.suppressions enable row level security;

create policy suppressions_select_own on public.suppressions
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Users can add a suppression directly, but only the server can lift one.
create policy suppressions_insert_own on public.suppressions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

revoke all on public.suppressions from anon, authenticated;
grant select, insert on public.suppressions to authenticated;
grant all on public.suppressions to service_role;

-- ---------------------------------------------------------------------------
-- send_events: tamper-proof send log, also the source of truth for the daily cap
-- ---------------------------------------------------------------------------

create table public.send_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  message_id uuid,
  person_id uuid,
  to_email text not null,

  -- 'outreach' counts towards the daily cap; 'reply' (answering someone who wrote back) does not.
  kind text not null check (kind in ('outreach', 'reply')),
  status text not null check (status in ('reserved', 'sent', 'failed')),
  provider text not null,
  error text,

  -- The calendar day in the user's own timezone that this send counts against.
  local_day date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  foreign key (message_id, user_id) references public.messages (id, user_id)
    on delete set null (message_id),
  foreign key (person_id, user_id) references public.people (id, user_id)
    on delete set null (person_id)
);

create index send_events_cap_idx on public.send_events (user_id, local_day, kind, status);
create index send_events_message_idx on public.send_events (message_id);

create trigger send_events_set_updated_at
  before update on public.send_events
  for each row execute function private.set_updated_at();

alter table public.send_events enable row level security;

-- Read-only for users: if they could delete rows they could reset their own cap.
create policy send_events_select_own on public.send_events
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.send_events from anon, authenticated;
grant select on public.send_events to authenticated;
grant all on public.send_events to service_role;

-- ---------------------------------------------------------------------------
-- claim_send_slot: the gate every real email passes through
-- ---------------------------------------------------------------------------
--
-- Called by the server (service role only) immediately before handing a message
-- to the mail provider. In one transaction it:
--   1. takes a per-user lock so two sends cannot race past the cap,
--   2. checks the message is an approved, queued email that has not gone out,
--   3. checks the recipient: has an address, is not sample data, is not marked
--      do-not-contact, is not suppressed, and the address is safe to send to,
--   4. checks the daily cap for outreach emails,
--   5. marks the message 'sending' and records a reserved send_events row.
--
-- It returns {"allowed": true, "event_id": ...} or {"allowed": false, "reason": ...}.
-- Keeping these rules in the database means no code path can skip them.

create function public.claim_send_slot(
  p_user_id uuid,
  p_message_id uuid,
  p_provider text,
  p_now timestamptz default now(),
  -- Only honoured for replies, where the person may have written from a different address.
  p_reply_to_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_message public.messages%rowtype;
  v_person public.people%rowtype;
  v_kind text;
  v_to_email text;
  v_day date;
  v_used integer := 0;
  v_event_id uuid;
  v_now timestamptz := coalesce(p_now, now());
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 7001));

  select * into v_profile from public.profiles where id = p_user_id;
  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'profile_not_found');
  end if;

  select * into v_message
  from public.messages
  where id = p_message_id and user_id = p_user_id
  for update;
  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'message_not_found');
  end if;

  if v_message.channel <> 'email' then
    return jsonb_build_object('allowed', false, 'reason', 'not_email');
  end if;
  if v_message.status = 'sent' or v_message.status = 'sending' then
    return jsonb_build_object('allowed', false, 'reason', 'already_sent');
  end if;
  if v_message.status <> 'scheduled' then
    return jsonb_build_object('allowed', false, 'reason', 'not_queued');
  end if;
  if v_message.approved_at is null then
    return jsonb_build_object('allowed', false, 'reason', 'not_approved');
  end if;
  if coalesce(btrim(v_message.body), '') = '' then
    return jsonb_build_object('allowed', false, 'reason', 'empty_body');
  end if;

  select * into v_person
  from public.people
  where id = v_message.person_id and user_id = p_user_id;
  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'person_not_found');
  end if;

  v_kind := case when v_message.type = 'reply' then 'reply' else 'outreach' end;

  -- Outreach always goes to the address on file. A reply may go to the address the person wrote from.
  v_to_email := lower(btrim(coalesce(
    case when v_kind = 'reply' then nullif(btrim(p_reply_to_email), '') end,
    v_person.email,
    ''
  )));

  if v_to_email = '' then
    return jsonb_build_object('allowed', false, 'reason', 'missing_email');
  end if;
  -- Sample people come from the mock provider and are not real: only the mock mail provider may "send" to them.
  if v_person.is_sample and p_provider <> 'mock' then
    return jsonb_build_object('allowed', false, 'reason', 'sample_data');
  end if;
  if v_person.do_not_contact then
    return jsonb_build_object('allowed', false, 'reason', 'do_not_contact');
  end if;
  if exists (
    select 1 from public.suppressions s
    where s.user_id = p_user_id
      and s.email in (v_to_email, lower(coalesce(v_person.email, '')))
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'suppressed');
  end if;

  -- Verification rules apply to outreach. A reply goes to an address that just wrote to the user.
  if v_kind = 'outreach' then
    if v_person.email_status in ('invalid', 'not_found') then
      return jsonb_build_object('allowed', false, 'reason', 'invalid_email');
    end if;
    if v_person.email_status <> 'valid' and v_person.email_risk_accepted_at is null then
      return jsonb_build_object('allowed', false, 'reason', 'unverified_email');
    end if;
  end if;

  begin
    v_day := (v_now at time zone v_profile.timezone)::date;
  exception when others then
    v_day := (v_now at time zone 'UTC')::date;
  end;

  if v_kind = 'outreach' then
    -- A reservation that never completed stops counting after 15 minutes.
    select count(*) into v_used
    from public.send_events e
    where e.user_id = p_user_id
      and e.kind = 'outreach'
      and e.local_day = v_day
      and (e.status = 'sent' or (e.status = 'reserved' and e.created_at > v_now - interval '15 minutes'));

    if v_used >= v_profile.daily_send_cap then
      return jsonb_build_object(
        'allowed', false,
        'reason', 'daily_cap_reached',
        'used', v_used,
        'cap', v_profile.daily_send_cap,
        'local_day', v_day
      );
    end if;
  end if;

  update public.messages set status = 'sending' where id = p_message_id;

  insert into public.send_events (user_id, message_id, person_id, to_email, kind, status, provider, local_day, created_at)
  values (p_user_id, p_message_id, v_person.id, v_to_email, v_kind, 'reserved', p_provider, v_day, v_now)
  returning id into v_event_id;

  return jsonb_build_object(
    'allowed', true,
    'event_id', v_event_id,
    'kind', v_kind,
    'to_email', v_to_email,
    'used', case when v_kind = 'outreach' then v_used + 1 else v_used end,
    'cap', v_profile.daily_send_cap,
    'local_day', v_day
  );
end;
$$;

revoke all on function public.claim_send_slot(uuid, uuid, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.claim_send_slot(uuid, uuid, text, timestamptz, text) to service_role;

-- How many outreach emails the signed-in user has left today. Safe for users to call.
create function public.sends_remaining_today()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_profile public.profiles%rowtype;
  v_day date;
  v_used integer;
begin
  if v_user_id is null then
    return null;
  end if;

  select * into v_profile from public.profiles where id = v_user_id;
  if not found then
    return null;
  end if;

  begin
    v_day := (now() at time zone v_profile.timezone)::date;
  exception when others then
    v_day := (now() at time zone 'UTC')::date;
  end;

  select count(*) into v_used
  from public.send_events e
  where e.user_id = v_user_id
    and e.kind = 'outreach'
    and e.local_day = v_day
    and (e.status = 'sent' or (e.status = 'reserved' and e.created_at > now() - interval '15 minutes'));

  return jsonb_build_object(
    'used', v_used,
    'cap', v_profile.daily_send_cap,
    'remaining', greatest(v_profile.daily_send_cap - v_used, 0),
    'local_day', v_day
  );
end;
$$;

revoke all on function public.sends_remaining_today() from public, anon;
grant execute on function public.sends_remaining_today() to authenticated, service_role;
