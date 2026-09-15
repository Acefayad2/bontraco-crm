create table private.lead_scan_leases (
  profile_id uuid primary key references public.lead_source_profiles(id) on delete cascade,
  lease_token uuid not null,
  lease_until timestamptz not null
);

revoke all on table private.lead_scan_leases from public, anon, authenticated;
grant select, insert, update, delete on table private.lead_scan_leases to service_role;

create or replace function public.acquire_lead_scan_lease(
  target_profile_id uuid,
  lease_seconds integer default 120
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_token uuid := gen_random_uuid();
  acquired_token uuid;
begin
  if target_profile_id is null then
    raise exception 'A lead source profile is required';
  end if;
  if lease_seconds < 30 or lease_seconds > 300 then
    raise exception 'Lead scan lease must be between 30 and 300 seconds';
  end if;

  insert into private.lead_scan_leases (profile_id, lease_token, lease_until)
  values (
    target_profile_id,
    candidate_token,
    now() + make_interval(secs => lease_seconds)
  )
  on conflict (profile_id) do update
  set
    lease_token = excluded.lease_token,
    lease_until = excluded.lease_until
  where private.lead_scan_leases.lease_until <= now()
  returning lease_token into acquired_token;

  return acquired_token;
end;
$$;

create or replace function public.release_lead_scan_lease(
  target_profile_id uuid,
  lease_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_token uuid := lease_token;
begin
  if target_profile_id is null or lease_token is null then
    return false;
  end if;

  delete from private.lead_scan_leases
  where profile_id = target_profile_id
    and lead_scan_leases.lease_token = requested_token;

  return found;
end;
$$;

alter table public.lead_source_profiles
  drop column scan_lease_token,
  drop column scan_lease_until;
