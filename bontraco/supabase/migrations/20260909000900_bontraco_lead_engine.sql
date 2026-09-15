-- Tenant-scoped lead-search configuration and observable scan history.

create table public.lead_source_profiles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 80),
  provider text not null check (provider in ('tavily', 'google_places', 'reddit_api', 'public_feed')),
  trades public.bontraco_trade[] not null default array['roofing']::public.bontraco_trade[],
  search_terms text[] not null default '{}'::text[],
  geography jsonb not null default '{}'::jsonb,
  allowed_domains text[] not null default '{}'::text[],
  enabled boolean not null default false,
  cadence_minutes smallint not null default 15 check (cadence_minutes between 15 and 1440),
  max_age_days smallint not null default 7 check (max_age_days between 1 and 30),
  max_results_per_run smallint not null default 20 check (max_results_per_run between 1 and 100),
  daily_result_limit integer not null default 200 check (daily_result_limit between 1 and 10000),
  last_scanned_at timestamptz,
  next_scan_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, name),
  unique (account_id, id)
);

create table public.lead_scan_runs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  source_profile_id uuid,
  provider text not null,
  status text not null default 'running' check (status in ('running', 'succeeded', 'partial', 'failed', 'skipped')),
  found_count integer not null default 0 check (found_count >= 0),
  inserted_count integer not null default 0 check (inserted_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  rejected_count integer not null default 0 check (rejected_count >= 0),
  request_count integer not null default 0 check (request_count >= 0),
  error_code text,
  error_message text,
  metrics jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint lead_scan_runs_profile_fkey
    foreign key (account_id, source_profile_id)
    references public.lead_source_profiles(account_id, id)
    on delete set null (source_profile_id)
);

alter table public.leads
  add column if not exists source_external_id text,
  add column if not exists last_verified_at timestamptz,
  add column if not exists qualification_reason text,
  add column if not exists source_profile_id uuid,
  add constraint leads_source_profile_fkey
    foreign key (account_id, source_profile_id)
    references public.lead_source_profiles(account_id, id)
    on delete set null (source_profile_id);

create index lead_source_profiles_due_idx
  on public.lead_source_profiles (next_scan_at)
  where enabled;
create index lead_source_profiles_account_idx
  on public.lead_source_profiles (account_id, enabled, next_scan_at);
create index lead_scan_runs_account_time_idx
  on public.lead_scan_runs (account_id, started_at desc);
create index lead_scan_runs_account_profile_idx
  on public.lead_scan_runs (account_id, source_profile_id, started_at desc)
  where source_profile_id is not null;
create index leads_account_source_profile_idx
  on public.leads (account_id, source_profile_id, discovered_at desc)
  where source_profile_id is not null;

create trigger lead_source_profiles_touch_updated_at
before update on public.lead_source_profiles
for each row execute function public.touch_updated_at();

alter table public.lead_source_profiles enable row level security;
alter table public.lead_scan_runs enable row level security;

create policy lead_source_profiles_select_manager
on public.lead_source_profiles for select to authenticated
using (
  public.has_account_role(
    account_id,
    array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[]
  )
);

create policy lead_source_profiles_insert_admin
on public.lead_source_profiles for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.has_account_role(
    account_id,
    array['owner', 'admin']::public.bontraco_member_role[]
  )
);

create policy lead_source_profiles_update_admin
on public.lead_source_profiles for update to authenticated
using (
  public.has_account_role(
    account_id,
    array['owner', 'admin']::public.bontraco_member_role[]
  )
)
with check (
  public.has_account_role(
    account_id,
    array['owner', 'admin']::public.bontraco_member_role[]
  )
);

create policy lead_source_profiles_delete_admin
on public.lead_source_profiles for delete to authenticated
using (
  public.has_account_role(
    account_id,
    array['owner', 'admin']::public.bontraco_member_role[]
  )
);

create policy lead_scan_runs_select_manager
on public.lead_scan_runs for select to authenticated
using (
  public.has_account_role(
    account_id,
    array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[]
  )
);

grant select, insert, update, delete on public.lead_source_profiles to authenticated;
grant select on public.lead_scan_runs to authenticated;
