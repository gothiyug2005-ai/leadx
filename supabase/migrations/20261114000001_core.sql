-- LeadX core schema: profiles, companies, targets, people, research briefs.
--
-- Conventions used in every migration:
--   * Every table has Row Level Security enabled.
--   * Rows are owned by `user_id`; a user can only ever touch their own rows.
--   * Child tables use composite foreign keys (id, user_id) so a row can never
--     point at a parent owned by a different user.
--   * Enumerations are text + CHECK so they are easy to extend later.
--   * Privileges are granted explicitly; the anonymous role gets nothing.

create schema if not exists private;
comment on schema private is 'Internal helpers. Not exposed through the Data API.';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: the job seeker
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  headline text,
  location text,
  timezone text not null default 'UTC',

  resume_path text,
  resume_file_name text,
  resume_parsed jsonb,
  resume_parsed_at timestamptz,

  story_answers jsonb not null default '[]'::jsonb,
  positioning_statement text,
  target_roles text[] not null default '{}',
  preferences jsonb not null default '{}'::jsonb,

  tone text not null default 'warm' check (tone in ('formal', 'warm', 'concise')),
  writing_sample text,

  -- Hard ceiling of 40 lives here so no code path can exceed it.
  daily_send_cap integer not null default 20 check (daily_send_cap between 1 and 40),

  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per user: parsed resume, story, target roles, tone, sending limits.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

revoke all on public.profiles from anon, authenticated;
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

-- Create the profile automatically when someone signs up.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  domain text check (domain = lower(domain)),
  website text,
  linkedin_url text,
  industry text,
  size text,
  location text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create unique index companies_user_domain_key
  on public.companies (user_id, domain)
  where domain is not null;
create index companies_user_id_idx on public.companies (user_id);

create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function private.set_updated_at();

alter table public.companies enable row level security;

create policy companies_owner_all on public.companies
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.companies from anon, authenticated;
grant select, insert, update, delete on public.companies to authenticated;
grant all on public.companies to service_role;

-- ---------------------------------------------------------------------------
-- targets: what the user is going after
-- ---------------------------------------------------------------------------

create table public.targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id uuid not null,
  kind text not null check (kind in ('job_posting', 'company', 'person')),

  role_title text,
  team text,
  seniority text,
  location text,
  must_have_skills text[] not null default '{}',
  nice_to_have_skills text[] not null default '{}',

  job_url text,
  job_text text,
  job_summary text,

  status text not null default 'active' check (status in ('active', 'paused', 'archived')),

  discovery_status text not null default 'idle'
    check (discovery_status in ('idle', 'running', 'done', 'failed')),
  discovery_error text,
  discovered_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (id, user_id),
  foreign key (company_id, user_id) references public.companies (id, user_id) on delete cascade
);

create index targets_user_id_idx on public.targets (user_id, created_at desc);
create index targets_company_id_idx on public.targets (company_id);

create trigger targets_set_updated_at
  before update on public.targets
  for each row execute function private.set_updated_at();

alter table public.targets enable row level security;

create policy targets_owner_all on public.targets
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.targets from anon, authenticated;
grant select, insert, update, delete on public.targets to authenticated;
grant all on public.targets to service_role;

-- ---------------------------------------------------------------------------
-- people: someone at a target company
-- ---------------------------------------------------------------------------

create table public.people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_id uuid not null,
  company_id uuid not null,

  full_name text not null check (char_length(full_name) between 1 and 200),
  first_name text,
  last_name text,
  title text,
  location text,
  timezone text,
  linkedin_url text,

  -- Where this person came from: 'manual' or a provider name such as 'apollo'.
  source text not null default 'manual',
  provider_person_id text,
  -- True for made-up people from the mock provider. Sample people can never be emailed for real.
  is_sample boolean not null default false,

  role_type text
    check (role_type in ('hiring_manager', 'recruiter', 'team_member', 'alumni', 'leadership')),
  relevance_score integer check (relevance_score between 0 and 100),
  relevance_reason text,
  connection_angles jsonb not null default '[]'::jsonb,
  is_recommended boolean not null default false,

  stage text not null default 'to_contact'
    check (stage in ('to_contact', 'contacted', 'followed_up', 'replied', 'interview', 'offer', 'closed')),
  stage_changed_at timestamptz not null default now(),

  email text check (email = lower(email)),
  email_status text not null default 'unknown'
    check (email_status in ('unknown', 'valid', 'risky', 'invalid', 'not_found')),
  email_source text,
  email_confidence integer check (email_confidence between 0 and 100),
  email_checked_at timestamptz,
  -- Set when the user explicitly confirms they want to email a risky or unverified address.
  email_risk_accepted_at timestamptz,

  enrichment_status text not null default 'idle'
    check (enrichment_status in ('idle', 'queued', 'running', 'done', 'failed')),
  enrichment_error text,

  -- "Never email again" for this person, set by the user.
  do_not_contact boolean not null default false,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (id, user_id),
  foreign key (target_id, user_id) references public.targets (id, user_id) on delete cascade,
  foreign key (company_id, user_id) references public.companies (id, user_id) on delete cascade
);

create unique index people_target_provider_key
  on public.people (target_id, source, provider_person_id)
  where provider_person_id is not null;
create index people_user_stage_idx on public.people (user_id, stage);
create index people_target_id_idx on public.people (target_id);
create index people_company_id_idx on public.people (company_id);
create index people_user_email_idx on public.people (user_id, email) where email is not null;

create trigger people_set_updated_at
  before update on public.people
  for each row execute function private.set_updated_at();

-- Keep stage_changed_at honest whenever the stage moves.
create function private.touch_stage_changed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.stage is distinct from old.stage then
    new.stage_changed_at := now();
  end if;
  return new;
end;
$$;

create trigger people_touch_stage_changed_at
  before update on public.people
  for each row execute function private.touch_stage_changed_at();

alter table public.people enable row level security;

create policy people_owner_all on public.people
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.people from anon, authenticated;
grant select, insert, update, delete on public.people to authenticated;
grant all on public.people to service_role;

-- ---------------------------------------------------------------------------
-- research_briefs: cached AI notes per company and per person
-- ---------------------------------------------------------------------------

create table public.research_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  scope text not null check (scope in ('company', 'person')),
  company_id uuid not null,
  person_id uuid,

  content jsonb not null,
  sources jsonb not null default '[]'::jsonb,

  model text,
  prompt_id text,
  prompt_version integer,
  is_sample boolean not null default false,

  created_at timestamptz not null default now(),
  expires_at timestamptz,

  unique (id, user_id),
  foreign key (company_id, user_id) references public.companies (id, user_id) on delete cascade,
  foreign key (person_id, user_id) references public.people (id, user_id) on delete cascade,
  check ((scope = 'person') = (person_id is not null))
);

-- One cached brief per company and per person; refreshing replaces it.
create unique index research_briefs_company_key
  on public.research_briefs (company_id)
  where scope = 'company';
create unique index research_briefs_person_key
  on public.research_briefs (person_id)
  where scope = 'person';
create index research_briefs_user_id_idx on public.research_briefs (user_id);

alter table public.research_briefs enable row level security;

create policy research_briefs_owner_all on public.research_briefs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.research_briefs from anon, authenticated;
grant select, insert, update, delete on public.research_briefs to authenticated;
grant all on public.research_briefs to service_role;
