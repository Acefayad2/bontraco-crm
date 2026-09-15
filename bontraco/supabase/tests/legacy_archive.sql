-- Verify legacy prototype records remain preserved and inaccessible through product roles.

begin;

do $$
declare
  expected jsonb;
  actual jsonb;
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
      and table_name like 'crm\_%' escape '\'
  ) then
    raise exception 'Legacy CRM base tables remain in the public API schema';
  end if;

  if has_schema_privilege('anon', 'bontraco_legacy', 'usage')
    or has_schema_privilege('authenticated', 'bontraco_legacy', 'usage') then
    raise exception 'Product roles can access the legacy archive schema';
  end if;

  if has_table_privilege('anon', 'public.crm_leads', 'select')
    or has_table_privilege('authenticated', 'public.crm_leads', 'select') then
    raise exception 'Browser roles can read the legacy compatibility views';
  end if;

  select row_counts into expected
  from bontraco_legacy.archive_manifest
  order by archived_at desc
  limit 1;

  actual := jsonb_build_object(
    'crm_accounts', (select count(*) from bontraco_legacy.snapshot_crm_accounts),
    'crm_members', (select count(*) from bontraco_legacy.snapshot_crm_members),
    'crm_clients', (select count(*) from bontraco_legacy.snapshot_crm_clients),
    'crm_jobs', (select count(*) from bontraco_legacy.snapshot_crm_jobs),
    'crm_leads', (select count(*) from bontraco_legacy.snapshot_crm_leads),
    'crm_scan_runs', (select count(*) from bontraco_legacy.snapshot_crm_scan_runs)
  );

  if expected is null or actual <> expected then
    raise exception 'Legacy archive counts do not match the preservation manifest';
  end if;
end $$;

insert into auth.users (id, email, aud, role, created_at, updated_at) values
  ('1a000000-0000-0000-0000-000000000001', 'legacy-owner@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('1a000000-0000-0000-0000-000000000002', 'legacy-admin@example.invalid', 'authenticated', 'authenticated', now(), now());
insert into public.accounts (id, name, slug, trades, created_by) values
  ('2a000000-0000-0000-0000-000000000001', 'Legacy Import Test', 'bontraco-legacy-import-test', array['roofing']::public.bontraco_trade[], '1a000000-0000-0000-0000-000000000001');
insert into public.memberships (account_id, user_id, role, display_name, email) values
  ('2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000001', 'owner', 'Legacy Owner', 'legacy-owner@example.invalid'),
  ('2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000002', 'admin', 'Legacy Admin', 'legacy-admin@example.invalid');

set local role service_role;
do $$
declare
  expected integer;
  first_count integer;
  first_result jsonb;
  second_result jsonb;
begin
  select public.import_bontraco_legacy_leads(
    '2a000000-0000-0000-0000-000000000001',
    '1a000000-0000-0000-0000-000000000001'
  ) into first_result;
  expected := (first_result ->> 'available')::integer;
  select count(*) into first_count from public.leads
  where account_id = '2a000000-0000-0000-0000-000000000001';
  if first_count <> expected then
    raise exception 'Legacy lead import did not preserve every snapshot lead';
  end if;

  select public.import_bontraco_legacy_leads(
    '2a000000-0000-0000-0000-000000000001',
    '1a000000-0000-0000-0000-000000000001'
  ) into second_result;
  if (second_result ->> 'inserted')::integer <> 0
    or (select count(*) from public.leads where account_id = '2a000000-0000-0000-0000-000000000001') <> expected then
    raise exception 'Legacy lead import is not idempotent';
  end if;
end $$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '1a000000-0000-0000-0000-000000000002', true);

do $$
declare denied boolean := false;
begin
  begin
    perform public.import_bontraco_legacy_leads(
      '2a000000-0000-0000-0000-000000000001',
      '1a000000-0000-0000-0000-000000000002'
    );
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then
    raise exception 'Browser roles can execute the service-only legacy import';
  end if;
end $$;

reset role;
rollback;

select 'bontraco_legacy_archive_passed' as result;
