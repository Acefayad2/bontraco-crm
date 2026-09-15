-- Repeatable prototype-import audit visibility check. Fixtures always roll back.

begin;

insert into auth.users (id, email, aud, role, created_at, updated_at) values
  ('17000000-0000-0000-0000-000000000001', 'import-owner@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('17000000-0000-0000-0000-000000000002', 'import-admin@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('17000000-0000-0000-0000-000000000003', 'import-sales@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('17000000-0000-0000-0000-000000000004', 'import-outside@example.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.accounts (id, name, slug, trades, created_by) values
  ('27000000-0000-0000-0000-000000000001', 'Import Test One', 'bontraco-import-test-one', array['roofing']::public.bontraco_trade[], '17000000-0000-0000-0000-000000000001'),
  ('27000000-0000-0000-0000-000000000002', 'Import Test Two', 'bontraco-import-test-two', array['general']::public.bontraco_trade[], '17000000-0000-0000-0000-000000000004');

insert into public.memberships (account_id, user_id, role, display_name, email) values
  ('27000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000001', 'owner', 'Import Owner', 'import-owner@example.invalid'),
  ('27000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000002', 'admin', 'Import Admin', 'import-admin@example.invalid'),
  ('27000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000003', 'sales', 'Import Sales', 'import-sales@example.invalid'),
  ('27000000-0000-0000-0000-000000000002', '17000000-0000-0000-0000-000000000004', 'owner', 'Import Outside', 'import-outside@example.invalid');

insert into public.data_import_batches (
  id, account_id, requested_by, source_digest, status, source_counts, imported_counts, completed_at
) values (
  '57000000-0000-0000-0000-000000000001',
  '27000000-0000-0000-0000-000000000001',
  '17000000-0000-0000-0000-000000000001',
  repeat('a', 64),
  'completed',
  '{"clients":1,"jobs":1}',
  '{"contacts":1,"properties":0,"jobs":1}',
  now()
);

insert into public.data_import_records (
  account_id, batch_id, source_type, source_id, target_table, target_id
) values (
  '27000000-0000-0000-0000-000000000001',
  '57000000-0000-0000-0000-000000000001',
  'client',
  'legacy-client-1',
  'contacts',
  '67000000-0000-0000-0000-000000000001'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '17000000-0000-0000-0000-000000000002', true);
do $$
begin
  if (select count(*) from public.data_import_batches) <> 1 then
    raise exception 'Admin cannot read account import batches';
  end if;
  if (select count(*) from public.data_import_records) <> 1 then
    raise exception 'Admin cannot read account import manifest';
  end if;
end
$$;

select set_config('request.jwt.claim.sub', '17000000-0000-0000-0000-000000000003', true);
do $$
declare denied boolean := false;
begin
  if exists (select 1 from public.data_import_batches) then
    raise exception 'Sales user can read import batches';
  end if;
  begin
    insert into public.data_import_batches (account_id, requested_by, source_digest)
    values (
      '27000000-0000-0000-0000-000000000001',
      '17000000-0000-0000-0000-000000000003',
      repeat('b', 64)
    );
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Authenticated user directly inserted an import batch'; end if;
end
$$;

select set_config('request.jwt.claim.sub', '17000000-0000-0000-0000-000000000004', true);
do $$
begin
  if exists (
    select 1 from public.data_import_batches
    where account_id = '27000000-0000-0000-0000-000000000001'
  ) then raise exception 'Outside tenant read import batches'; end if;
end
$$;

reset role;
do $$
declare removed jsonb;
begin
  removed := public.rollback_bontraco_import(
    '27000000-0000-0000-0000-000000000001',
    '57000000-0000-0000-0000-000000000001',
    '17000000-0000-0000-0000-000000000002',
    'rolled_back'
  );
  if removed ->> 'contacts' <> '1' then
    raise exception 'Atomic rollback did not report its manifest';
  end if;
  if exists (
    select 1 from public.data_import_records
    where batch_id = '57000000-0000-0000-0000-000000000001'
  ) then raise exception 'Atomic rollback retained its manifest'; end if;
  if not exists (
    select 1 from public.data_import_batches
    where id = '57000000-0000-0000-0000-000000000001' and status = 'rolled_back'
  ) then raise exception 'Atomic rollback did not finalize the batch'; end if;
  if not exists (
    select 1 from public.activities
    where kind = 'prototype_import_rolled_back'
      and metadata ->> 'batch_id' = '57000000-0000-0000-0000-000000000001'
  ) then raise exception 'Atomic rollback was not audited'; end if;
end
$$;

rollback;
select 'bontraco_prototype_imports_rls_passed' as result;
