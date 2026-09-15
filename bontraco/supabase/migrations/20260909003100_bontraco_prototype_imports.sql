-- Auditable, recoverable imports from the original Abundant Solutions CRM payload.

create table public.data_import_batches (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  requested_by uuid not null,
  source_format text not null default 'abundant_crm_v1'
    check (source_format in ('abundant_crm_v1')),
  source_digest text not null check (source_digest ~ '^[a-f0-9]{64}$'),
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed', 'rolled_back')),
  source_counts jsonb not null default '{}'::jsonb,
  imported_counts jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  failure_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  rolled_back_at timestamptz,
  constraint data_import_batches_requester_fkey
    foreign key (account_id, requested_by)
    references public.memberships(account_id, user_id),
  constraint data_import_batches_account_id_id_key unique (account_id, id)
);

create unique index data_import_batches_completed_digest_idx
  on public.data_import_batches (account_id, source_digest)
  where status = 'completed';
create index data_import_batches_account_time_idx
  on public.data_import_batches (account_id, created_at desc);
create index data_import_batches_requester_idx
  on public.data_import_batches (account_id, requested_by);

create table public.data_import_records (
  id bigint generated always as identity primary key,
  account_id uuid not null references public.accounts(id) on delete cascade,
  batch_id uuid not null,
  source_type text not null check (source_type in ('client', 'job')),
  source_id text not null check (char_length(source_id) between 1 and 200),
  target_table text not null check (target_table in ('contacts', 'properties', 'jobs')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  constraint data_import_records_batch_fkey
    foreign key (account_id, batch_id)
    references public.data_import_batches(account_id, id)
    on delete cascade,
  unique (batch_id, target_table, target_id),
  unique (account_id, source_type, source_id, target_table)
);

create index data_import_records_batch_idx
  on public.data_import_records (account_id, batch_id, target_table);

alter table public.data_import_batches enable row level security;
alter table public.data_import_records enable row level security;

create policy data_import_batches_select_admin
on public.data_import_batches for select to authenticated
using (
  public.has_account_role(
    account_id,
    array['owner', 'admin']::public.bontraco_member_role[]
  )
);

create policy data_import_records_select_admin
on public.data_import_records for select to authenticated
using (
  public.has_account_role(
    account_id,
    array['owner', 'admin']::public.bontraco_member_role[]
  )
);

revoke all on public.data_import_batches, public.data_import_records from anon, authenticated;
grant select on public.data_import_batches, public.data_import_records to authenticated;
