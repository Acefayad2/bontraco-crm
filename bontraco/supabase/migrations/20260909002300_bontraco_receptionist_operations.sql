-- Idempotent receptionist booking references and auditable call usage.
alter table public.appointments add column external_source text;
alter table public.appointments add column external_id text;
alter table public.appointments add constraint appointments_external_reference_unique unique (account_id, external_source, external_id);

create table public.call_usage (
  id bigint generated always as identity primary key,
  account_id uuid not null references public.accounts(id) on delete cascade,
  call_id uuid not null,
  provider text not null,
  external_usage_id text not null,
  billable_seconds integer not null check (billable_seconds >= 0),
  billable_minutes integer generated always as ((billable_seconds + 59) / 60) stored,
  provider_cost_cents integer check (provider_cost_cents is null or provider_cost_cents >= 0),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  recorded_at timestamptz not null default now(),
  billed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (provider, external_usage_id),
  constraint call_usage_account_call_fkey foreign key (account_id, call_id) references public.calls(account_id, id) on delete cascade
);

create index call_usage_account_period_idx on public.call_usage (account_id, recorded_at desc);
create index call_usage_unbilled_idx on public.call_usage (account_id, recorded_at) where billed_at is null;

alter table public.call_usage enable row level security;
create policy call_usage_select_admin on public.call_usage for select to authenticated
using (public.has_account_role(account_id, array['owner','admin']::public.bontraco_member_role[]));
grant select on public.call_usage to authenticated;
revoke all on public.call_usage from anon;
