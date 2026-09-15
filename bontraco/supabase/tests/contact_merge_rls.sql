-- Repeatable atomic customer merge, relationship preservation, and authorization check.

begin;

insert into auth.users (id, email, aud, role, created_at, updated_at) values
  ('1b000000-0000-0000-0000-000000000001', 'merge-owner@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('1b000000-0000-0000-0000-000000000002', 'merge-admin@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('1b000000-0000-0000-0000-000000000003', 'merge-sales@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('1b000000-0000-0000-0000-000000000004', 'merge-outside@example.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.accounts (id, name, slug, trades, created_by) values
  ('2b000000-0000-0000-0000-000000000001', 'Merge Test One', 'bontraco-merge-test-one', array['roofing']::public.bontraco_trade[], '1b000000-0000-0000-0000-000000000001'),
  ('2b000000-0000-0000-0000-000000000002', 'Merge Test Two', 'bontraco-merge-test-two', array['plumbing']::public.bontraco_trade[], '1b000000-0000-0000-0000-000000000004');

insert into public.memberships (account_id, user_id, role, display_name, email) values
  ('2b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000001', 'owner', 'Merge Owner', 'merge-owner@example.invalid'),
  ('2b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000002', 'admin', 'Merge Admin', 'merge-admin@example.invalid'),
  ('2b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000003', 'sales', 'Merge Sales', 'merge-sales@example.invalid'),
  ('2b000000-0000-0000-0000-000000000002', '1b000000-0000-0000-0000-000000000004', 'owner', 'Merge Outside', 'merge-outside@example.invalid');

insert into public.contacts (
  id, account_id, assigned_to, first_name, last_name, company_name, email, phone, source, created_by
) values
  ('3b000000-0000-0000-0000-000000000001', '2b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000003', 'Duplicate', 'Customer', 'Source Company', 'duplicate@example.invalid', '+16305550101', 'import', '1b000000-0000-0000-0000-000000000001'),
  ('3b000000-0000-0000-0000-000000000002', '2b000000-0000-0000-0000-000000000001', null, 'Primary', null, null, null, null, 'manual', '1b000000-0000-0000-0000-000000000001'),
  ('3b000000-0000-0000-0000-000000000003', '2b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000003', 'Sales', 'Duplicate', null, null, null, 'manual', '1b000000-0000-0000-0000-000000000003'),
  ('3b000000-0000-0000-0000-000000000004', '2b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000003', 'Sales', 'Primary', null, null, null, 'manual', '1b000000-0000-0000-0000-000000000003'),
  ('3b000000-0000-0000-0000-000000000005', '2b000000-0000-0000-0000-000000000002', null, 'Outside', 'Customer', null, null, null, 'manual', '1b000000-0000-0000-0000-000000000004');

insert into public.properties (
  id, account_id, contact_id, label, address_line_1, city, region
) values (
  '4b000000-0000-0000-0000-000000000001', '2b000000-0000-0000-0000-000000000001',
  '3b000000-0000-0000-0000-000000000001', 'Home', '100 Merge Street', 'Naperville', 'IL'
);
insert into public.leads (
  id, account_id, assigned_to, contact_id, title, trade, source, dedup_key
) values (
  '5b000000-0000-0000-0000-000000000001', '2b000000-0000-0000-0000-000000000001',
  '1b000000-0000-0000-0000-000000000003', '3b000000-0000-0000-0000-000000000001',
  'Merged customer lead', 'roofing', 'manual', 'merge:test:lead'
);
insert into public.jobs (
  id, account_id, contact_id, property_id, lead_id, assigned_to, title, trade, created_by
) values (
  '6b000000-0000-0000-0000-000000000001', '2b000000-0000-0000-0000-000000000001',
  '3b000000-0000-0000-0000-000000000001', '4b000000-0000-0000-0000-000000000001',
  '5b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000003',
  'Merged customer job', 'roofing', '1b000000-0000-0000-0000-000000000001'
);
insert into public.appointments (
  id, account_id, job_id, contact_id, assigned_to, title, starts_at, ends_at, created_by
) values (
  '7b000000-0000-0000-0000-000000000001', '2b000000-0000-0000-0000-000000000001',
  '6b000000-0000-0000-0000-000000000001', '3b000000-0000-0000-0000-000000000001',
  '1b000000-0000-0000-0000-000000000003', 'Merge appointment', now() + interval '1 day',
  now() + interval '1 day 1 hour', '1b000000-0000-0000-0000-000000000001'
);
insert into public.notes (id, account_id, contact_id, body, created_by) values (
  '8b000000-0000-0000-0000-000000000001', '2b000000-0000-0000-0000-000000000001',
  '3b000000-0000-0000-0000-000000000001', 'Preserve this customer note',
  '1b000000-0000-0000-0000-000000000001'
);
insert into public.files (
  id, account_id, contact_id, storage_path, original_name, content_type, byte_size, created_by
) values (
  '9b000000-0000-0000-0000-000000000001', '2b000000-0000-0000-0000-000000000001',
  '3b000000-0000-0000-0000-000000000001',
  '2b000000-0000-0000-0000-000000000001/merge-test/file.pdf', 'file.pdf', 'application/pdf', 10,
  '1b000000-0000-0000-0000-000000000001'
);
insert into public.calls (
  id, account_id, contact_id, assigned_to, provider, provider_call_id, status, from_number
) values (
  'ab000000-0000-0000-0000-000000000001', '2b000000-0000-0000-0000-000000000001',
  '3b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000003',
  'retell', 'merge-test-call', 'completed', '+16305550101'
);
insert into public.communication_suppressions (
  id, account_id, contact_id, channel, destination, reason, source, created_by
) values (
  'bb000000-0000-0000-0000-000000000001', '2b000000-0000-0000-0000-000000000001',
  '3b000000-0000-0000-0000-000000000001', 'voice', '+16305550101', 'Recipient request',
  'recipient_request', '1b000000-0000-0000-0000-000000000001'
);
insert into public.communication_consents (
  id, account_id, contact_id, channel, purpose, destination, status, source,
  disclosure_version, evidence, created_by
) values (
  'cb000000-0000-0000-0000-000000000001', '2b000000-0000-0000-0000-000000000001',
  '3b000000-0000-0000-0000-000000000001', 'voice', 'transactional', '+16305550101',
  'granted', 'written', 'merge-test-v1', '{"note":"signed"}'::jsonb,
  '1b000000-0000-0000-0000-000000000001'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '1b000000-0000-0000-0000-000000000001', true);

do $$
declare result jsonb;
begin
  result := public.merge_bontraco_contacts(
    '2b000000-0000-0000-0000-000000000001',
    '3b000000-0000-0000-0000-000000000001',
    '3b000000-0000-0000-0000-000000000002'
  );
  if result->>'contact_id' <> '3b000000-0000-0000-0000-000000000002' then
    raise exception 'Merge returned the wrong surviving customer';
  end if;
  if exists (
    select 1 from public.contacts where id = '3b000000-0000-0000-0000-000000000001'
  ) then raise exception 'Duplicate customer was not removed'; end if;
  if not exists (
    select 1 from public.contacts
    where id = '3b000000-0000-0000-0000-000000000002'
      and last_name = 'Customer'
      and company_name = 'Source Company'
      and email = 'duplicate@example.invalid'
      and phone = '+16305550101'
      and assigned_to = '1b000000-0000-0000-0000-000000000003'
  ) then raise exception 'Surviving customer did not inherit missing details'; end if;
  if exists (
    select 1 from public.properties where contact_id = '3b000000-0000-0000-0000-000000000001'
    union all select 1 from public.leads where contact_id = '3b000000-0000-0000-0000-000000000001'
    union all select 1 from public.jobs where contact_id = '3b000000-0000-0000-0000-000000000001'
    union all select 1 from public.appointments where contact_id = '3b000000-0000-0000-0000-000000000001'
    union all select 1 from public.activities where contact_id = '3b000000-0000-0000-0000-000000000001'
    union all select 1 from public.notes where contact_id = '3b000000-0000-0000-0000-000000000001'
    union all select 1 from public.files where contact_id = '3b000000-0000-0000-0000-000000000001'
    union all select 1 from public.calls where contact_id = '3b000000-0000-0000-0000-000000000001'
    union all select 1 from public.communication_suppressions where contact_id = '3b000000-0000-0000-0000-000000000001'
    union all select 1 from public.communication_consents where contact_id = '3b000000-0000-0000-0000-000000000001'
  ) then raise exception 'A customer relationship was left on the duplicate'; end if;
  if not exists (
    select 1 from public.activities
    where contact_id = '3b000000-0000-0000-0000-000000000002'
      and kind = 'customer_merged'
      and metadata->>'source_contact_id' = '3b000000-0000-0000-0000-000000000001'
  ) then raise exception 'Customer merge was not audited'; end if;
  if not exists (
    select 1 from public.jobs
    where id = '6b000000-0000-0000-0000-000000000001'
      and contact_id = '3b000000-0000-0000-0000-000000000002'
      and property_id = '4b000000-0000-0000-0000-000000000001'
  ) then raise exception 'Merged job lost its service location'; end if;
end
$$;

select set_config('request.jwt.claim.sub', '1b000000-0000-0000-0000-000000000003', true);
do $$
declare denied boolean := false;
begin
  begin
    perform public.merge_bontraco_contacts(
      '2b000000-0000-0000-0000-000000000001',
      '3b000000-0000-0000-0000-000000000003',
      '3b000000-0000-0000-0000-000000000004'
    );
  exception when others then denied := true;
  end;
  if not denied then raise exception 'Sales user merged customers'; end if;
end
$$;

select set_config('request.jwt.claim.sub', '1b000000-0000-0000-0000-000000000004', true);
do $$
declare denied boolean := false;
begin
  begin
    perform public.merge_bontraco_contacts(
      '2b000000-0000-0000-0000-000000000001',
      '3b000000-0000-0000-0000-000000000003',
      '3b000000-0000-0000-0000-000000000004'
    );
  exception when others then denied := true;
  end;
  if not denied then raise exception 'Outside owner merged another workspace customers'; end if;
end
$$;

reset role;
set local role anon;
do $$
declare denied boolean := false;
begin
  begin
    perform public.merge_bontraco_contacts(
      '2b000000-0000-0000-0000-000000000001',
      '3b000000-0000-0000-0000-000000000003',
      '3b000000-0000-0000-0000-000000000004'
    );
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Anonymous role executed customer merge'; end if;
end
$$;

reset role;
rollback;
select 'bontraco_contact_merge_rls_passed' as result;
