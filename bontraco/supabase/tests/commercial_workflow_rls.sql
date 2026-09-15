-- Repeatable job-to-cash workflow and tenant-isolation check. Fixtures always roll back.

begin;

insert into auth.users (id, email, aud, role, created_at, updated_at) values
  ('12000000-0000-0000-0000-000000000001', 'commercial-owner@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('12000000-0000-0000-0000-000000000002', 'commercial-sales@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('12000000-0000-0000-0000-000000000003', 'commercial-field@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('12000000-0000-0000-0000-000000000004', 'commercial-outsider@example.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.accounts (id, name, slug, trades, created_by) values
  ('22000000-0000-0000-0000-000000000001', 'Commercial Test One', 'bontraco-commercial-one', array['roofing']::public.bontraco_trade[], '12000000-0000-0000-0000-000000000001'),
  ('22000000-0000-0000-0000-000000000002', 'Commercial Test Two', 'bontraco-commercial-two', array['plumbing']::public.bontraco_trade[], '12000000-0000-0000-0000-000000000004');

insert into public.memberships (account_id, user_id, role, display_name, email) values
  ('22000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', 'owner', 'Commercial Owner', 'commercial-owner@example.invalid'),
  ('22000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000002', 'sales', 'Commercial Sales', 'commercial-sales@example.invalid'),
  ('22000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000003', 'field', 'Commercial Field', 'commercial-field@example.invalid'),
  ('22000000-0000-0000-0000-000000000002', '12000000-0000-0000-0000-000000000004', 'owner', 'Outside Owner', 'commercial-outsider@example.invalid');

insert into public.contacts (id, account_id, assigned_to, first_name, created_by) values
  ('32000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000002', 'Assigned', '12000000-0000-0000-0000-000000000001'),
  ('32000000-0000-0000-0000-000000000002', '22000000-0000-0000-0000-000000000001', null, 'Unassigned', '12000000-0000-0000-0000-000000000001');

insert into public.jobs (id, account_id, contact_id, assigned_to, title, trade, created_by) values
  ('42000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000002', 'Assigned commercial job', 'roofing', '12000000-0000-0000-0000-000000000001'),
  ('42000000-0000-0000-0000-000000000002', '22000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000002', null, 'Unassigned commercial job', 'roofing', '12000000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000002', true);

select public.create_bontraco_estimate(
  '22000000-0000-0000-0000-000000000001',
  '42000000-0000-0000-0000-000000000001',
  'EST-RLS-1',
  0.1,
  current_date + 30,
  'Thank you for the opportunity.',
  'Due according to the accepted scope.',
  '[{"description":"Roof squares","quantity":2,"unit":"square","unit_price":100,"taxable":true},{"description":"Permit","quantity":1,"unit":"each","unit_price":50,"taxable":false}]'::jsonb
);

do $$
declare denied boolean := false;
begin
  if (select total from public.estimates where estimate_number = 'EST-RLS-1') <> 270 then
    raise exception 'Multi-line estimate totals were not recalculated';
  end if;
  if (
    select count(*)
    from public.estimate_items i
    join public.estimates e on e.id = i.estimate_id
    where e.estimate_number = 'EST-RLS-1'
  ) <> 2 then
    raise exception 'Atomic estimate did not create every line item';
  end if;
  begin
    insert into public.estimates (account_id, job_id, estimate_number, created_by)
    values ('22000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000002', 'EST-FORBIDDEN', '12000000-0000-0000-0000-000000000002');
  exception when others then denied := true;
  end;
  if not denied then raise exception 'Salesperson estimated an unassigned job'; end if;
end
$$;

do $$
declare denied boolean := false;
begin
  begin
    perform public.create_bontraco_estimate(
      '22000000-0000-0000-0000-000000000001',
      '42000000-0000-0000-0000-000000000001',
      'EST-INVALID',
      0.1,
      null,
      null,
      null,
      '[]'::jsonb
    );
  exception when others then denied := true;
  end;
  if not denied then raise exception 'Atomic estimate accepted an empty scope'; end if;
  if exists (select 1 from public.estimates where estimate_number = 'EST-INVALID') then
    raise exception 'Failed estimate left a partial header behind';
  end if;
end
$$;

do $$
declare denied boolean := false;
begin
  begin
    insert into public.estimates (account_id, job_id, estimate_number, created_by)
    values (
      '22000000-0000-0000-0000-000000000001',
      '42000000-0000-0000-0000-000000000001',
      'EST-DIRECT-EMPTY',
      '12000000-0000-0000-0000-000000000002'
    );
    set constraints estimates_require_line_items immediate;
  exception when check_violation then
    denied := true;
  end;
  if not denied then raise exception 'Direct insert saved an estimate without scope lines'; end if;
end
$$;
set constraints estimates_require_line_items deferred;

do $$
declare denied boolean := false;
begin
  begin
    delete from public.estimate_items
    where estimate_id = (select id from public.estimates where estimate_number = 'EST-RLS-1');
    set constraints estimate_items_preserve_scope immediate;
  exception when check_violation then
    denied := true;
  end;
  if not denied then raise exception 'Estimate scope allowed every line item to be deleted'; end if;
end
$$;
set constraints estimate_items_preserve_scope deferred;

update public.estimates set status = 'accepted', accepted_at = now()
where estimate_number = 'EST-RLS-1';

select public.create_invoice_from_estimate(
  (select id from public.estimates where estimate_number = 'EST-RLS-1'),
  'INV-RLS-1',
  current_date + 14
);
select public.create_invoice_from_estimate(
  (select id from public.estimates where estimate_number = 'EST-RLS-1'),
  'INV-RLS-1',
  current_date + 14
);

do $$
declare denied_payment boolean := false;
begin
  if (select count(*) from public.invoices where invoice_number = 'INV-RLS-1') <> 1 then
    raise exception 'Invoice conversion was not idempotent';
  end if;
  if (select total from public.invoices where invoice_number = 'INV-RLS-1') <> 270 then
    raise exception 'Invoice totals were not copied and recalculated';
  end if;
  begin
    insert into public.payments (account_id, invoice_id, amount, method, created_by)
    select account_id, id, 50, 'card', '12000000-0000-0000-0000-000000000002' from public.invoices limit 1;
  exception when others then denied_payment := true;
  end;
  if not denied_payment then raise exception 'Salesperson recorded a payment'; end if;
end
$$;

select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000001', true);
insert into public.payments (account_id, invoice_id, amount, method, created_by)
select account_id, id, 50, 'card', '12000000-0000-0000-0000-000000000001' from public.invoices limit 1;

do $$ begin
  if (select balance_due from public.invoices where invoice_number = 'INV-RLS-1') <> 220 then
    raise exception 'Payment did not update the invoice balance';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000003', true);
do $$ begin
  if (select count(*) from public.estimates) <> 0 or (select count(*) from public.invoices) <> 0 then
    raise exception 'Field role could see commercial records';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000004', true);
do $$ begin
  if (select count(*) from public.estimates) <> 0 or (select count(*) from public.invoices) <> 0 then
    raise exception 'Outside tenant could see commercial records';
  end if;
end $$;

reset role;
rollback;
select 'bontraco_commercial_workflow_rls_passed' as result;
