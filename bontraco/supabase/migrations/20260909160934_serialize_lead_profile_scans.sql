alter table public.lead_source_profiles
  add column scan_lease_token uuid,
  add column scan_lease_until timestamptz;

comment on column public.lead_source_profiles.scan_lease_token is
  'Opaque worker token for the current lead scan lease. Server-only.';
comment on column public.lead_source_profiles.scan_lease_until is
  'Expiry for the current lead scan lease. Server-only and self-recovering.';

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

  update public.lead_source_profiles
  set
    scan_lease_token = candidate_token,
    scan_lease_until = now() + make_interval(secs => lease_seconds)
  where id = target_profile_id
    and (scan_lease_until is null or scan_lease_until <= now())
  returning scan_lease_token into acquired_token;

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
begin
  if target_profile_id is null or lease_token is null then
    return false;
  end if;

  update public.lead_source_profiles
  set scan_lease_token = null, scan_lease_until = null
  where id = target_profile_id
    and scan_lease_token = lease_token;

  return found;
end;
$$;

revoke all on function public.acquire_lead_scan_lease(uuid, integer) from public, anon, authenticated;
revoke all on function public.release_lead_scan_lease(uuid, uuid) from public, anon, authenticated;
grant execute on function public.acquire_lead_scan_lease(uuid, integer) to service_role;
grant execute on function public.release_lead_scan_lease(uuid, uuid) to service_role;
