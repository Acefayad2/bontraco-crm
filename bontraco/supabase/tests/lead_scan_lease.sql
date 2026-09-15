-- Repeatable serialization checks for manual and scheduled lead scans. Fixtures always roll back.

begin;

insert into auth.users (id, email, aud, role, created_at, updated_at)
values (
  '8c000000-0000-4000-8000-000000000001',
  'lead-lease-owner@example.invalid',
  'authenticated',
  'authenticated',
  now(),
  now()
);

insert into public.accounts (id, name, slug, trades, created_by)
values (
  '8d000000-0000-4000-8000-000000000001',
  'Lead Lease Test',
  'bontraco-lead-lease-test',
  array['roofing']::public.bontraco_trade[],
  '8c000000-0000-4000-8000-000000000001'
);

insert into public.memberships (account_id, user_id, role, display_name, email)
values (
  '8d000000-0000-4000-8000-000000000001',
  '8c000000-0000-4000-8000-000000000001',
  'owner',
  'Lead Lease Owner',
  'lead-lease-owner@example.invalid'
);

insert into public.lead_source_profiles (
  id, account_id, name, provider, trades, search_terms, geography, allowed_domains, created_by
) values (
  '8e000000-0000-4000-8000-000000000001',
  '8d000000-0000-4000-8000-000000000001',
  'Serialized public search',
  'tavily',
  array['roofing']::public.bontraco_trade[],
  array['roof leak'],
  '{"city":"Chicago","region":"IL"}'::jsonb,
  array['reddit.com'],
  '8c000000-0000-4000-8000-000000000001'
);

do $$
declare
  first_token uuid;
  second_token uuid;
  third_token uuid;
begin
  if has_function_privilege('authenticated', 'public.acquire_lead_scan_lease(uuid, integer)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.release_lead_scan_lease(uuid, uuid)', 'EXECUTE')
  then
    raise exception 'Authenticated clients can execute server-only scan lease functions';
  end if;
  if not has_function_privilege('service_role', 'public.acquire_lead_scan_lease(uuid, integer)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.release_lead_scan_lease(uuid, uuid)', 'EXECUTE')
  then
    raise exception 'Service role cannot execute scan lease functions';
  end if;
  if has_table_privilege('authenticated', 'private.lead_scan_leases', 'SELECT')
    or has_table_privilege('authenticated', 'private.lead_scan_leases', 'INSERT')
    or has_table_privilege('authenticated', 'private.lead_scan_leases', 'UPDATE')
    or has_table_privilege('authenticated', 'private.lead_scan_leases', 'DELETE')
  then
    raise exception 'Authenticated clients can access private scan leases';
  end if;

  first_token := public.acquire_lead_scan_lease('8e000000-0000-4000-8000-000000000001', 120);
  if first_token is null then
    raise exception 'First worker did not acquire the scan lease';
  end if;
  second_token := public.acquire_lead_scan_lease('8e000000-0000-4000-8000-000000000001', 120);
  if second_token is not null then
    raise exception 'Overlapping worker acquired an active scan lease';
  end if;
  if public.release_lead_scan_lease(
    '8e000000-0000-4000-8000-000000000001',
    'ffffffff-ffff-4fff-8fff-ffffffffffff'
  ) then
    raise exception 'A mismatched token released another worker scan lease';
  end if;
  if not public.release_lead_scan_lease('8e000000-0000-4000-8000-000000000001', first_token) then
    raise exception 'The lease owner could not release its scan lease';
  end if;

  third_token := public.acquire_lead_scan_lease('8e000000-0000-4000-8000-000000000001', 120);
  if third_token is null or third_token = first_token then
    raise exception 'A released scan lease was not safely reacquired';
  end if;

  update private.lead_scan_leases
  set lease_until = now() - interval '1 second'
  where profile_id = '8e000000-0000-4000-8000-000000000001';
  second_token := public.acquire_lead_scan_lease('8e000000-0000-4000-8000-000000000001', 120);
  if second_token is null or second_token = third_token then
    raise exception 'An expired scan lease was not safely replaced';
  end if;
  if public.release_lead_scan_lease('8e000000-0000-4000-8000-000000000001', third_token) then
    raise exception 'An expired worker released the replacement scan lease';
  end if;
end $$;

rollback;
select 'bontraco_lead_scan_lease_passed' as result;
