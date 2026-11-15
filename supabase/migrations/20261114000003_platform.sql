-- LeadX platform tables: API usage, Gmail connection, provider cache, resume storage.

-- ---------------------------------------------------------------------------
-- api_usage: one row per provider or AI call, per user. Ready for credits and billing later.
-- ---------------------------------------------------------------------------

create table public.api_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  operation text not null,
  units integer not null default 1 check (units >= 0),
  input_tokens integer,
  output_tokens integer,
  model text,
  is_mock boolean not null default false,
  cache_hit boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index api_usage_user_created_idx on public.api_usage (user_id, created_at desc);
create index api_usage_user_provider_idx on public.api_usage (user_id, provider, created_at desc);

alter table public.api_usage enable row level security;

-- Read-only for users: usage records must be trustworthy for future billing.
create policy api_usage_select_own on public.api_usage
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.api_usage from anon, authenticated;
grant select on public.api_usage to authenticated;
grant all on public.api_usage to service_role;

-- ---------------------------------------------------------------------------
-- gmail_connections: what the user may know about their Gmail link
-- gmail_tokens:      the encrypted OAuth tokens, server only
-- ---------------------------------------------------------------------------

create table public.gmail_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  status text not null default 'connected' check (status in ('connected', 'revoked', 'error')),
  scopes text[] not null default '{}',
  -- Gmail's sync cursor for reply detection.
  history_id text,
  last_sync_at timestamptz,
  last_error text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger gmail_connections_set_updated_at
  before update on public.gmail_connections
  for each row execute function private.set_updated_at();

alter table public.gmail_connections enable row level security;

create policy gmail_connections_select_own on public.gmail_connections
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.gmail_connections from anon, authenticated;
grant select on public.gmail_connections to authenticated;
grant all on public.gmail_connections to service_role;

create table public.gmail_tokens (
  user_id uuid primary key references public.gmail_connections (user_id) on delete cascade,
  -- AES-256-GCM ciphertext. The key lives only in the server environment.
  refresh_token_enc text not null,
  access_token_enc text,
  access_token_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create trigger gmail_tokens_set_updated_at
  before update on public.gmail_tokens
  for each row execute function private.set_updated_at();

-- RLS on with no policies: nobody but the service role can read or write tokens.
alter table public.gmail_tokens enable row level security;

revoke all on public.gmail_tokens from anon, authenticated;
grant all on public.gmail_tokens to service_role;

-- ---------------------------------------------------------------------------
-- provider_cache: cached provider responses, shared across users to save credits
-- ---------------------------------------------------------------------------

create table public.provider_cache (
  cache_key text primary key,
  provider text not null,
  operation text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index provider_cache_expires_idx on public.provider_cache (expires_at);

-- RLS on with no policies: server only.
alter table public.provider_cache enable row level security;

revoke all on public.provider_cache from anon, authenticated;
grant all on public.provider_cache to service_role;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for resumes, one folder per user
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 5242880, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy resumes_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy resumes_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy resumes_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy resumes_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);
