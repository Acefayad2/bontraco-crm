-- Preserve the pre-Bontraco prototype records outside the exposed API schema.
-- These tables are intentionally not deleted until an owner accepts or rejects their import.
create schema if not exists bontraco_legacy;

alter table public.crm_accounts set schema bontraco_legacy;
alter table public.crm_members set schema bontraco_legacy;
alter table public.crm_clients set schema bontraco_legacy;
alter table public.crm_jobs set schema bontraco_legacy;
alter table public.crm_leads set schema bontraco_legacy;
alter table public.crm_scan_runs set schema bontraco_legacy;

revoke all on schema bontraco_legacy from public, anon, authenticated;
revoke all on all tables in schema bontraco_legacy from public, anon, authenticated;
revoke all on all sequences in schema bontraco_legacy from public, anon, authenticated;
alter default privileges in schema bontraco_legacy revoke all on tables from public, anon, authenticated;
alter default privileges in schema bontraco_legacy revoke all on sequences from public, anon, authenticated;

create table bontraco_legacy.archive_manifest (
  id bigint generated always as identity primary key,
  archived_at timestamptz not null default now(),
  source_schema text not null default 'public',
  row_counts jsonb not null check (jsonb_typeof(row_counts) = 'object'),
  note text not null
);

alter table bontraco_legacy.archive_manifest enable row level security;
revoke all on bontraco_legacy.archive_manifest from public, anon, authenticated;
revoke all on sequence bontraco_legacy.archive_manifest_id_seq from public, anon, authenticated;

insert into bontraco_legacy.archive_manifest (row_counts, note)
select jsonb_build_object(
  'crm_accounts', (select count(*) from bontraco_legacy.crm_accounts),
  'crm_members', (select count(*) from bontraco_legacy.crm_members),
  'crm_clients', (select count(*) from bontraco_legacy.crm_clients),
  'crm_jobs', (select count(*) from bontraco_legacy.crm_jobs),
  'crm_leads', (select count(*) from bontraco_legacy.crm_leads),
  'crm_scan_runs', (select count(*) from bontraco_legacy.crm_scan_runs)
), 'Pre-Bontraco prototype archive; retain until controlled owner import or written disposal approval.';

create or replace function private.crm_has_role(target_account uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from bontraco_legacy.crm_members member
      where member.account_id = target_account
        and member.user_id = (select auth.uid())
        and member.active
        and member.role = any(allowed_roles)
    );
$$;

revoke execute on function private.crm_has_role(uuid, text[]) from public, anon, authenticated;

comment on schema bontraco_legacy is
  'Server-only archive of the pre-Bontraco prototype schema. Not exposed through the product API.';
