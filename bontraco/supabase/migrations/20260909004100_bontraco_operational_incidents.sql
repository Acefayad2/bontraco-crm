create table public.operational_incidents (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique check (char_length(fingerprint) between 8 and 240),
  kind text not null check (kind in ('lead_scan_failed', 'billing_webhook_failed', 'urgent_call')),
  severity text not null check (severity in ('warning', 'critical')),
  source_record_id text not null check (char_length(source_record_id) between 1 and 240),
  payload jsonb not null default '{}'::jsonb check (
    jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 4096
  ),
  detected_at timestamptz not null,
  attempts integer not null default 0 check (attempts between 0 and 10),
  delivered_at timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 800),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index operational_incidents_pending_idx
  on public.operational_incidents (detected_at, attempts)
  where delivered_at is null and attempts < 10;

create trigger operational_incidents_touch_updated_at
before update on public.operational_incidents
for each row execute function public.touch_updated_at();

alter table public.operational_incidents enable row level security;
revoke all on public.operational_incidents from anon, authenticated;
