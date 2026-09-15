-- Provider-neutral AI receptionist configuration and private call records.

create table public.receptionist_settings (
  account_id uuid primary key references public.accounts(id) on delete cascade,
  enabled boolean not null default false,
  provider text not null default 'unconfigured' check (provider in ('unconfigured', 'retell', 'vapi', 'twilio')),
  phone_number text,
  transfer_number text,
  greeting text not null default 'Thank you for calling. How can we help today?',
  timezone text not null default 'America/Chicago',
  business_hours jsonb not null default '{}'::jsonb,
  recording_enabled boolean not null default false,
  recording_disclosure text,
  emergency_instructions text not null default 'If anyone is in immediate danger, hang up and call 911.',
  appointment_duration_minutes integer not null default 60 check (appointment_duration_minutes between 15 and 480),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.calls (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  contact_id uuid,
  lead_id uuid,
  job_id uuid,
  assigned_to uuid references auth.users(id) on delete set null,
  provider text not null,
  provider_call_id text not null,
  direction text not null default 'inbound' check (direction in ('inbound', 'outbound')),
  status text not null default 'ringing' check (status in ('ringing', 'in_progress', 'completed', 'missed', 'voicemail', 'failed')),
  from_number text,
  to_number text,
  caller_name text,
  emergency_flag boolean not null default false,
  consent_recorded boolean not null default false,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  disposition text,
  summary text,
  transcript text,
  recording_url text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_call_id),
  unique (account_id, id),
  constraint calls_account_contact_fkey foreign key (account_id, contact_id) references public.contacts(account_id, id) on delete set null (contact_id),
  constraint calls_account_lead_fkey foreign key (account_id, lead_id) references public.leads(account_id, id) on delete set null (lead_id),
  constraint calls_account_job_fkey foreign key (account_id, job_id) references public.jobs(account_id, id) on delete set null (job_id),
  constraint calls_account_assignee_fkey foreign key (account_id, assigned_to) references public.memberships(account_id, user_id) on delete set null (assigned_to)
);

create table public.call_events (
  id bigint generated always as identity primary key,
  account_id uuid not null references public.accounts(id) on delete cascade,
  call_id uuid not null,
  provider_event_id text,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (provider_event_id),
  constraint call_events_account_call_fkey foreign key (account_id, call_id) references public.calls(account_id, id) on delete cascade
);

create index receptionist_settings_created_by_idx on public.receptionist_settings (created_by);
create index calls_account_started_idx on public.calls (account_id, started_at desc);
create index calls_account_assignee_idx on public.calls (account_id, assigned_to, started_at desc);
create index calls_contact_idx on public.calls (account_id, contact_id) where contact_id is not null;
create index calls_lead_idx on public.calls (account_id, lead_id) where lead_id is not null;
create index calls_job_idx on public.calls (account_id, job_id) where job_id is not null;
create index call_events_call_time_idx on public.call_events (account_id, call_id, occurred_at);

create trigger receptionist_settings_touch_updated_at before update on public.receptionist_settings for each row execute function public.touch_updated_at();
create trigger receptionist_settings_preserve_created_by before update on public.receptionist_settings for each row execute function public.preserve_created_by();
create trigger calls_touch_updated_at before update on public.calls for each row execute function public.touch_updated_at();

alter table public.receptionist_settings enable row level security;
alter table public.calls enable row level security;
alter table public.call_events enable row level security;

create policy receptionist_settings_select_admin on public.receptionist_settings for select to authenticated
using (public.has_account_role(account_id, array['owner','admin']::public.bontraco_member_role[]));
create policy receptionist_settings_insert_admin on public.receptionist_settings for insert to authenticated
with check (created_by = (select auth.uid()) and public.has_account_role(account_id, array['owner','admin']::public.bontraco_member_role[]));
create policy receptionist_settings_update_admin on public.receptionist_settings for update to authenticated
using (public.has_account_role(account_id, array['owner','admin']::public.bontraco_member_role[]))
with check (public.has_account_role(account_id, array['owner','admin']::public.bontraco_member_role[]));

create policy calls_select_visible on public.calls for select to authenticated
using (
  public.has_account_role(account_id, array['owner','admin','dispatcher','sales']::public.bontraco_member_role[])
  and public.can_access_assigned_record(account_id, assigned_to)
);
create policy call_events_select_visible on public.call_events for select to authenticated
using (exists (
  select 1 from public.calls c where c.id = call_id and c.account_id = account_id
    and public.has_account_role(c.account_id, array['owner','admin','dispatcher','sales']::public.bontraco_member_role[])
    and public.can_access_assigned_record(c.account_id, c.assigned_to)
));

grant select, insert, update on public.receptionist_settings to authenticated;
grant select on public.calls, public.call_events to authenticated;
revoke all on public.receptionist_settings, public.calls, public.call_events from anon;
