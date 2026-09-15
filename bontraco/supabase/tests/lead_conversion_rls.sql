-- Repeatable integration check for lead conversion and tenant isolation.
-- This script always rolls back its fixtures.

begin;

insert into auth.users (id, email, aud, role, created_at, updated_at) values
  ('10000000-0000-0000-0000-000000000001', 'bontraco-owner-test@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('10000000-0000-0000-0000-000000000002', 'bontraco-sales-test@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('10000000-0000-0000-0000-000000000003', 'bontraco-outsider-test@example.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.accounts (id, name, slug, trades, created_by) values
  ('20000000-0000-0000-0000-000000000001', 'Bontraco Test One', 'bontraco-rls-test-one', array['roofing']::public.bontraco_trade[], '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', 'Bontraco Test Two', 'bontraco-rls-test-two', array['plumbing']::public.bontraco_trade[], '10000000-0000-0000-0000-000000000003');

insert into public.memberships (account_id, user_id, role, display_name, email) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'owner', 'Test Owner', 'bontraco-owner-test@example.invalid'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'sales', 'Test Sales', 'bontraco-sales-test@example.invalid'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', 'owner', 'Test Outsider', 'bontraco-outsider-test@example.invalid');

insert into public.leads (id, account_id, assigned_to, title, trade, source, contact_name, dedup_key) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Assigned test', 'roofing', 'test', 'Taylor Example', 'test:assigned'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', null, 'Unassigned test', 'roofing', 'test', 'Morgan Example', 'test:unassigned');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);

do $$
declare
  first_contact uuid;
  first_job uuid;
  retry_contact uuid;
  retry_job uuid;
  denied boolean := false;
begin
  select contact_id, job_id into first_contact, first_job
  from public.convert_bontraco_lead(
    '20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'Taylor', 'Example', 'Assigned conversion', 12500
  );

  select contact_id, job_id into retry_contact, retry_job
  from public.convert_bontraco_lead(
    '20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'Taylor', 'Example', 'Assigned conversion', 12500
  );

  if first_contact is null or first_job is null then
    raise exception 'Conversion did not create both records';
  end if;
  if retry_contact <> first_contact or retry_job <> first_job then
    raise exception 'Conversion is not idempotent';
  end if;
  if (select count(*) from public.jobs where lead_id = '30000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'Conversion created a duplicate job';
  end if;

  begin
    perform * from public.convert_bontraco_lead(
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000002',
      'Morgan', 'Example', null, null
    );
  exception when others then
    denied := true;
  end;
  if not denied then raise exception 'Salesperson converted an unassigned lead'; end if;
end
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);

do $$
declare denied boolean := false;
begin
  begin
    perform * from public.convert_bontraco_lead(
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001',
      'Taylor', 'Example', null, null
    );
  exception when others then
    denied := true;
  end;
  if not denied then raise exception 'Cross-tenant conversion was allowed'; end if;
end
$$;

reset role;
rollback;

select 'bontraco_lead_conversion_rls_passed' as result;
