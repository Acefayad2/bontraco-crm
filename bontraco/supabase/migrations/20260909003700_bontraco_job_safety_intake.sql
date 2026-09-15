alter table public.jobs
  add column safety_intake jsonb not null default '{}'::jsonb;

create or replace function public.is_valid_bontraco_safety_intake(
  target_trade public.bontraco_trade,
  intake jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  allowed_keys text[] := array['site_occupied', 'access_notes'];
  current_key text;
  current_value jsonb;
begin
  if intake is null or jsonb_typeof(intake) <> 'object' or pg_column_size(intake) > 4096 then
    return false;
  end if;

  if target_trade = 'roofing' then
    allowed_keys := allowed_keys || array['active_leak', 'stories', 'roof_access_notes'];
  elsif target_trade = 'plumbing' then
    allowed_keys := allowed_keys || array[
      'active_leak', 'water_shutoff_known', 'sewage_backup', 'gas_odor', 'shutoff_notes'
    ];
  elsif target_trade = 'electrical' then
    allowed_keys := allowed_keys || array[
      'power_isolated', 'burning_smell', 'sparks_or_arcing', 'panel_location'
    ];
  end if;

  for current_key, current_value in select key, value from jsonb_each(intake)
  loop
    if not current_key = any(allowed_keys) then
      return false;
    end if;
    if current_key in (
      'site_occupied', 'active_leak', 'water_shutoff_known', 'sewage_backup', 'gas_odor',
      'power_isolated', 'burning_smell', 'sparks_or_arcing'
    ) and jsonb_typeof(current_value) <> 'boolean' then
      return false;
    end if;
    if current_key = 'stories' and (
      jsonb_typeof(current_value) <> 'number'
      or (current_value #>> '{}')::numeric < 1
      or (current_value #>> '{}')::numeric > 99
      or trunc((current_value #>> '{}')::numeric) <> (current_value #>> '{}')::numeric
    ) then
      return false;
    end if;
    if current_key in ('access_notes', 'roof_access_notes', 'shutoff_notes', 'panel_location') and (
      jsonb_typeof(current_value) <> 'string'
      or length(current_value #>> '{}') > 1000
    ) then
      return false;
    end if;
  end loop;

  return true;
exception
  when others then
    return false;
end;
$$;

alter table public.jobs
  add constraint jobs_safety_intake_valid
  check (public.is_valid_bontraco_safety_intake(trade, safety_intake));

alter table public.jobs
  add constraint jobs_safety_intake_valid
  check (public.is_valid_bontraco_safety_intake(trade, safety_intake));

comment on column public.jobs.safety_intake is
  'Bounded trade-specific intake answers used to surface site hazards before dispatch.';

revoke all on function public.is_valid_bontraco_safety_intake(public.bontraco_trade, jsonb)
  from public, anon, authenticated;
