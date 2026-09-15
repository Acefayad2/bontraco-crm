-- Complete the tenant business profile required by onboarding and call handling.
alter table public.accounts
  add column legal_name text,
  add column timezone text not null default 'America/Chicago',
  add column service_area text,
  add column business_hours text,
  add column emergency_rules text;

update public.accounts
set legal_name = name
where legal_name is null;

alter table public.accounts
  alter column legal_name set not null,
  add constraint accounts_legal_name_length check (
    char_length(btrim(legal_name)) between 2 and 160
  ),
  add constraint accounts_timezone_format check (
    char_length(timezone) between 3 and 64
    and timezone ~ '^[A-Za-z_+-]+(?:/[A-Za-z0-9_+-]+)*$'
  ),
  add constraint accounts_service_area_length check (
    service_area is null or char_length(btrim(service_area)) between 2 and 300
  ),
  add constraint accounts_business_hours_length check (
    business_hours is null or char_length(btrim(business_hours)) between 2 and 500
  ),
  add constraint accounts_emergency_rules_length check (
    emergency_rules is null or char_length(btrim(emergency_rules)) between 2 and 1000
  );

comment on column public.accounts.timezone is
  'IANA timezone used for scheduling, reminders, business hours, and receptionist routing.';
comment on column public.accounts.emergency_rules is
  'Customer-authored routing/escalation rules; never autonomous repair or emergency advice.';

create or replace function private.normalize_bontraco_account_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := btrim(new.name);
  new.legal_name := coalesce(nullif(btrim(new.legal_name), ''), new.name);
  new.timezone := btrim(new.timezone);
  if not exists (
    select 1 from pg_catalog.pg_timezone_names timezone_name
    where timezone_name.name = new.timezone
  ) then
    raise check_violation using message = 'Timezone must be a recognized IANA timezone';
  end if;
  new.service_area := nullif(btrim(new.service_area), '');
  new.business_hours := nullif(btrim(new.business_hours), '');
  new.emergency_rules := nullif(btrim(new.emergency_rules), '');
  return new;
end;
$$;

create trigger accounts_normalize_business_profile
before insert or update of name, legal_name, timezone, service_area, business_hours, emergency_rules
on public.accounts
for each row execute function private.normalize_bontraco_account_profile();

revoke all on function private.normalize_bontraco_account_profile()
from public, anon, authenticated;
