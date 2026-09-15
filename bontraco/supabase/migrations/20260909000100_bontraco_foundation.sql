-- Bontraco multi-tenant foundation.
-- New tables live alongside the prototype crm_* schema so existing data remains recoverable.

create extension if not exists pgcrypto with schema extensions;

create type public.bontraco_member_role as enum ('owner', 'admin', 'sales', 'dispatcher', 'field');
create type public.bontraco_trade as enum ('roofing', 'plumbing', 'electrical', 'general');

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  trades public.bontraco_trade[] not null default array['roofing']::public.bontraco_trade[],
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.bontraco_member_role not null,
  display_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (account_id, user_id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  email text not null check (email = lower(email)),
  role public.bontraco_member_role not null check (role <> 'owner'),
  token_digest text not null unique,
  invited_by uuid not null references auth.users(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (account_id, email)
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  assigned_to uuid references auth.users(id) on delete set null,
  first_name text not null,
  last_name text,
  company_name text,
  email text,
  phone text,
  source text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  label text,
  address_line_1 text not null,
  address_line_2 text,
  city text not null,
  region text not null default 'IL',
  postal_code text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  assigned_to uuid references auth.users(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  title text not null,
  status text not null default 'new' check (status in ('new', 'qualified', 'contacted', 'appointment', 'won', 'lost', 'archived')),
  trade public.bontraco_trade not null default 'roofing',
  source text not null,
  source_url text,
  source_posted_at timestamptz,
  discovered_at timestamptz not null default now(),
  contact_name text,
  contact_phone text,
  contact_email text,
  location_text text,
  score smallint check (score between 0 and 100),
  evidence jsonb not null default '{}'::jsonb,
  dedup_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, dedup_key)
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete restrict,
  property_id uuid references public.properties(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  title text not null,
  trade public.bontraco_trade not null,
  stage text not null default 'new',
  status text not null default 'open' check (status in ('open', 'on_hold', 'won', 'lost', 'cancelled', 'completed')),
  estimated_value numeric(12,2) check (estimated_value is null or estimated_value >= 0),
  scheduled_start timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  assigned_to uuid references auth.users(id) on delete set null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  status text not null default 'scheduled' check (status in ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  assigned_to uuid references auth.users(id) on delete set null,
  title text not null,
  due_at timestamptz,
  completed_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activities (
  id bigint generated always as identity primary key,
  account_id uuid not null references public.accounts(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  kind text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index memberships_user_active_idx on public.memberships (user_id, account_id) where active;
create index invitations_account_email_idx on public.invitations (account_id, email);
create index contacts_account_assignee_idx on public.contacts (account_id, assigned_to, updated_at desc);
create index properties_account_contact_idx on public.properties (account_id, contact_id);
create index leads_account_status_idx on public.leads (account_id, status, discovered_at desc);
create index leads_account_assignee_idx on public.leads (account_id, assigned_to, discovered_at desc);
create index jobs_account_stage_idx on public.jobs (account_id, stage, updated_at desc);
create index jobs_account_assignee_idx on public.jobs (account_id, assigned_to, updated_at desc);
create index appointments_account_time_idx on public.appointments (account_id, starts_at);
create index appointments_assignee_time_idx on public.appointments (assigned_to, starts_at);
create index tasks_account_due_idx on public.tasks (account_id, due_at) where completed_at is null;
create index activities_account_time_idx on public.activities (account_id, occurred_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger accounts_touch_updated_at before update on public.accounts for each row execute function public.touch_updated_at();
create trigger memberships_touch_updated_at before update on public.memberships for each row execute function public.touch_updated_at();
create trigger contacts_touch_updated_at before update on public.contacts for each row execute function public.touch_updated_at();
create trigger properties_touch_updated_at before update on public.properties for each row execute function public.touch_updated_at();
create trigger leads_touch_updated_at before update on public.leads for each row execute function public.touch_updated_at();
create trigger jobs_touch_updated_at before update on public.jobs for each row execute function public.touch_updated_at();
create trigger appointments_touch_updated_at before update on public.appointments for each row execute function public.touch_updated_at();
create trigger tasks_touch_updated_at before update on public.tasks for each row execute function public.touch_updated_at();

create or replace function public.is_account_member(target_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.account_id = target_account_id
      and m.user_id = (select auth.uid())
      and m.active
  );
$$;

create or replace function public.has_account_role(target_account_id uuid, allowed_roles public.bontraco_member_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.account_id = target_account_id
      and m.user_id = (select auth.uid())
      and m.role = any(allowed_roles)
      and m.active
  );
$$;

create or replace function public.can_access_assigned_record(target_account_id uuid, record_assignee uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_account_role(
    target_account_id,
    array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[]
  ) or (
    record_assignee = (select auth.uid())
    and public.is_account_member(target_account_id)
  );
$$;

create or replace function public.create_bontraco_account(account_name text, account_slug text, primary_trade public.bontraco_trade default 'roofing')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_account_id uuid;
  normalized_slug text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if exists (
    select 1 from public.memberships
    where user_id = (select auth.uid()) and active
  ) then
    raise exception 'User already belongs to an active Bontraco account';
  end if;

  normalized_slug := lower(trim(account_slug));
  if normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Invalid account slug';
  end if;

  insert into public.accounts (name, slug, trades, created_by)
  values (trim(account_name), normalized_slug, array[primary_trade], (select auth.uid()))
  returning id into new_account_id;

  insert into public.memberships (account_id, user_id, role, display_name)
  values (
    new_account_id,
    (select auth.uid()),
    'owner',
    nullif(trim(coalesce((select auth.jwt() -> 'user_metadata' ->> 'full_name'), '')), '')
  );

  return new_account_id;
end;
$$;

revoke all on function public.is_account_member(uuid) from public;
revoke all on function public.has_account_role(uuid, public.bontraco_member_role[]) from public;
revoke all on function public.can_access_assigned_record(uuid, uuid) from public;
revoke all on function public.create_bontraco_account(text, text, public.bontraco_trade) from public;
grant execute on function public.is_account_member(uuid) to authenticated;
grant execute on function public.has_account_role(uuid, public.bontraco_member_role[]) to authenticated;
grant execute on function public.can_access_assigned_record(uuid, uuid) to authenticated;
grant execute on function public.create_bontraco_account(text, text, public.bontraco_trade) to authenticated;

alter table public.accounts enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.contacts enable row level security;
alter table public.properties enable row level security;
alter table public.leads enable row level security;
alter table public.jobs enable row level security;
alter table public.appointments enable row level security;
alter table public.tasks enable row level security;
alter table public.activities enable row level security;

create policy accounts_select_member on public.accounts for select to authenticated
using (public.is_account_member(id));
create policy accounts_update_admin on public.accounts for update to authenticated
using (public.has_account_role(id, array['owner', 'admin']::public.bontraco_member_role[]))
with check (public.has_account_role(id, array['owner', 'admin']::public.bontraco_member_role[]));

create policy memberships_select_same_account on public.memberships for select to authenticated
using (public.is_account_member(account_id));
create policy memberships_insert_admin on public.memberships for insert to authenticated
with check (public.has_account_role(account_id, array['owner', 'admin']::public.bontraco_member_role[]));
create policy memberships_update_admin on public.memberships for update to authenticated
using (public.has_account_role(account_id, array['owner', 'admin']::public.bontraco_member_role[]))
with check (public.has_account_role(account_id, array['owner', 'admin']::public.bontraco_member_role[]));
create policy memberships_delete_owner on public.memberships for delete to authenticated
using (public.has_account_role(account_id, array['owner']::public.bontraco_member_role[]) and role <> 'owner');

create policy invitations_admin_all on public.invitations for all to authenticated
using (public.has_account_role(account_id, array['owner', 'admin']::public.bontraco_member_role[]))
with check (public.has_account_role(account_id, array['owner', 'admin']::public.bontraco_member_role[]));

create policy contacts_select_assigned on public.contacts for select to authenticated
using (public.can_access_assigned_record(account_id, assigned_to));
create policy contacts_insert_member on public.contacts for insert to authenticated
with check (public.is_account_member(account_id) and created_by = (select auth.uid()) and (assigned_to is null or assigned_to = (select auth.uid()) or public.has_account_role(account_id, array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[])));
create policy contacts_update_assigned on public.contacts for update to authenticated
using (public.can_access_assigned_record(account_id, assigned_to))
with check (public.can_access_assigned_record(account_id, assigned_to));
create policy contacts_delete_admin on public.contacts for delete to authenticated
using (public.has_account_role(account_id, array['owner', 'admin']::public.bontraco_member_role[]));

create policy properties_select_visible_contact on public.properties for select to authenticated
using (exists (select 1 from public.contacts c where c.id = contact_id and public.can_access_assigned_record(c.account_id, c.assigned_to)));
create policy properties_insert_visible_contact on public.properties for insert to authenticated
with check (public.is_account_member(account_id) and exists (select 1 from public.contacts c where c.id = contact_id and c.account_id = account_id and public.can_access_assigned_record(c.account_id, c.assigned_to)));
create policy properties_update_visible_contact on public.properties for update to authenticated
using (exists (select 1 from public.contacts c where c.id = contact_id and public.can_access_assigned_record(c.account_id, c.assigned_to)))
with check (exists (select 1 from public.contacts c where c.id = contact_id and c.account_id = account_id and public.can_access_assigned_record(c.account_id, c.assigned_to)));
create policy properties_delete_admin on public.properties for delete to authenticated
using (public.has_account_role(account_id, array['owner', 'admin']::public.bontraco_member_role[]));

create policy leads_select_assigned on public.leads for select to authenticated
using (public.can_access_assigned_record(account_id, assigned_to));
create policy leads_insert_member on public.leads for insert to authenticated
with check (public.is_account_member(account_id) and (assigned_to is null or assigned_to = (select auth.uid()) or public.has_account_role(account_id, array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[])));
create policy leads_update_assigned on public.leads for update to authenticated
using (public.can_access_assigned_record(account_id, assigned_to))
with check (public.can_access_assigned_record(account_id, assigned_to));
create policy leads_delete_admin on public.leads for delete to authenticated
using (public.has_account_role(account_id, array['owner', 'admin']::public.bontraco_member_role[]));

create policy jobs_select_assigned on public.jobs for select to authenticated
using (public.can_access_assigned_record(account_id, assigned_to));
create policy jobs_insert_member on public.jobs for insert to authenticated
with check (public.is_account_member(account_id) and created_by = (select auth.uid()) and (assigned_to is null or assigned_to = (select auth.uid()) or public.has_account_role(account_id, array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[])));
create policy jobs_update_assigned on public.jobs for update to authenticated
using (public.can_access_assigned_record(account_id, assigned_to))
with check (public.can_access_assigned_record(account_id, assigned_to));
create policy jobs_delete_admin on public.jobs for delete to authenticated
using (public.has_account_role(account_id, array['owner', 'admin']::public.bontraco_member_role[]));

create policy appointments_select_assigned on public.appointments for select to authenticated
using (public.can_access_assigned_record(account_id, assigned_to));
create policy appointments_insert_member on public.appointments for insert to authenticated
with check (public.is_account_member(account_id) and created_by = (select auth.uid()) and (assigned_to = (select auth.uid()) or public.has_account_role(account_id, array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[])));
create policy appointments_update_assigned on public.appointments for update to authenticated
using (public.can_access_assigned_record(account_id, assigned_to))
with check (public.can_access_assigned_record(account_id, assigned_to));
create policy appointments_delete_admin on public.appointments for delete to authenticated
using (public.has_account_role(account_id, array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[]));

create policy tasks_select_assigned on public.tasks for select to authenticated
using (public.can_access_assigned_record(account_id, assigned_to));
create policy tasks_insert_member on public.tasks for insert to authenticated
with check (public.is_account_member(account_id) and created_by = (select auth.uid()) and (assigned_to = (select auth.uid()) or public.has_account_role(account_id, array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[])));
create policy tasks_update_assigned on public.tasks for update to authenticated
using (public.can_access_assigned_record(account_id, assigned_to))
with check (public.can_access_assigned_record(account_id, assigned_to));
create policy tasks_delete_admin on public.tasks for delete to authenticated
using (public.has_account_role(account_id, array['owner', 'admin']::public.bontraco_member_role[]));

create policy activities_select_member on public.activities for select to authenticated
using (public.is_account_member(account_id));
create policy activities_insert_actor on public.activities for insert to authenticated
with check (public.is_account_member(account_id) and actor_id = (select auth.uid()));

revoke all on public.accounts, public.memberships, public.invitations, public.contacts, public.properties,
  public.leads, public.jobs, public.appointments, public.tasks, public.activities from anon;
grant select, insert, update, delete on public.accounts, public.memberships, public.invitations, public.contacts,
  public.properties, public.leads, public.jobs, public.appointments, public.tasks, public.activities to authenticated;
grant usage, select on sequence public.activities_id_seq to authenticated;
