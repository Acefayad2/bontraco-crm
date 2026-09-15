-- Repeatable owner/admin/dispatcher/sales/field visibility and creation matrix.

begin;

insert into auth.users (id, email, aud, role, created_at, updated_at) values
  ('19000000-0000-0000-0000-000000000001', 'matrix-owner@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('19000000-0000-0000-0000-000000000002', 'matrix-admin@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('19000000-0000-0000-0000-000000000003', 'matrix-dispatcher@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('19000000-0000-0000-0000-000000000004', 'matrix-sales@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('19000000-0000-0000-0000-000000000005', 'matrix-field@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('19000000-0000-0000-0000-000000000006', 'matrix-outside@example.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.accounts (id, name, slug, trades, created_by) values
  ('29000000-0000-0000-0000-000000000001', 'Matrix Test One', 'bontraco-matrix-test-one', array['roofing']::public.bontraco_trade[], '19000000-0000-0000-0000-000000000001'),
  ('29000000-0000-0000-0000-000000000002', 'Matrix Test Two', 'bontraco-matrix-test-two', array['electrical']::public.bontraco_trade[], '19000000-0000-0000-0000-000000000006');

insert into public.memberships (account_id, user_id, role, display_name, email) values
  ('29000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000001', 'owner', 'Matrix Owner', 'matrix-owner@example.invalid'),
  ('29000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000002', 'admin', 'Matrix Admin', 'matrix-admin@example.invalid'),
  ('29000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000003', 'dispatcher', 'Matrix Dispatcher', 'matrix-dispatcher@example.invalid'),
  ('29000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000004', 'sales', 'Matrix Sales', 'matrix-sales@example.invalid'),
  ('29000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000005', 'field', 'Matrix Field', 'matrix-field@example.invalid'),
  ('29000000-0000-0000-0000-000000000002', '19000000-0000-0000-0000-000000000006', 'owner', 'Matrix Outside', 'matrix-outside@example.invalid');

insert into public.contacts (id, account_id, assigned_to, first_name, created_by) values
  ('39000000-0000-0000-0000-000000000001', '29000000-0000-0000-0000-000000000001', null, 'Unassigned', '19000000-0000-0000-0000-000000000001'),
  ('39000000-0000-0000-0000-000000000002', '29000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000004', 'Sales assigned', '19000000-0000-0000-0000-000000000001'),
  ('39000000-0000-0000-0000-000000000003', '29000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000005', 'Field assigned', '19000000-0000-0000-0000-000000000001');

insert into public.properties (id, account_id, contact_id, label, address_line_1, city, region) values
  ('49000000-0000-0000-0000-000000000001', '29000000-0000-0000-0000-000000000001', '39000000-0000-0000-0000-000000000001', 'Unassigned', '1 Main St', 'Chicago', 'IL'),
  ('49000000-0000-0000-0000-000000000002', '29000000-0000-0000-0000-000000000001', '39000000-0000-0000-0000-000000000002', 'Sales', '2 Main St', 'Chicago', 'IL'),
  ('49000000-0000-0000-0000-000000000003', '29000000-0000-0000-0000-000000000001', '39000000-0000-0000-0000-000000000003', 'Field', '3 Main St', 'Chicago', 'IL');

insert into public.jobs (id, account_id, contact_id, property_id, assigned_to, title, trade, created_by) values
  ('59000000-0000-0000-0000-000000000001', '29000000-0000-0000-0000-000000000001', '39000000-0000-0000-0000-000000000001', '49000000-0000-0000-0000-000000000001', null, 'Unassigned job', 'roofing', '19000000-0000-0000-0000-000000000001'),
  ('59000000-0000-0000-0000-000000000002', '29000000-0000-0000-0000-000000000001', '39000000-0000-0000-0000-000000000002', '49000000-0000-0000-0000-000000000002', '19000000-0000-0000-0000-000000000004', 'Sales job', 'roofing', '19000000-0000-0000-0000-000000000001'),
  ('59000000-0000-0000-0000-000000000003', '29000000-0000-0000-0000-000000000001', '39000000-0000-0000-0000-000000000003', '49000000-0000-0000-0000-000000000003', '19000000-0000-0000-0000-000000000005', 'Field job', 'roofing', '19000000-0000-0000-0000-000000000001');

insert into public.leads (id, account_id, assigned_to, title, trade, source, dedup_key) values
  ('69000000-0000-0000-0000-000000000001', '29000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000005', 'Field-assigned source lead', 'roofing', 'manual', 'matrix-existing-field-lead');

set local role authenticated;

select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-000000000001', true);
do $$ begin
  if (select count(*) from public.contacts) <> 3 or (select count(*) from public.jobs) <> 3 then
    raise exception 'Owner cannot read the full workspace';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-000000000002', true);
do $$ begin
  if (select count(*) from public.contacts) <> 3 or (select count(*) from public.properties) <> 3 then
    raise exception 'Administrator cannot read the full workspace';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-000000000003', true);
do $$ begin
  if (select count(*) from public.contacts) <> 3 or (select count(*) from public.jobs) <> 3 then
    raise exception 'Dispatcher cannot read the full workspace';
  end if;
  insert into public.contacts (account_id, first_name, created_by)
  values ('29000000-0000-0000-0000-000000000001', 'Dispatcher created', '19000000-0000-0000-0000-000000000003');
end $$;

select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-000000000004', true);
do $$
declare denied boolean := false;
begin
  if (select count(*) from public.contacts) <> 1 or (select count(*) from public.jobs) <> 1 then
    raise exception 'Salesperson can read records outside their assignment';
  end if;
  begin
    insert into public.contacts (account_id, first_name, created_by)
    values ('29000000-0000-0000-0000-000000000001', 'Bad unassigned', '19000000-0000-0000-0000-000000000004');
  exception when others then denied := true;
  end;
  if not denied then raise exception 'Salesperson inserted an unassigned customer'; end if;
  insert into public.contacts (account_id, assigned_to, first_name, created_by)
  values ('29000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000004', 'Sales created', '19000000-0000-0000-0000-000000000004');
end
$$;

select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-000000000005', true);
do $$
declare
  contact_denied boolean := false;
  lead_denied boolean := false;
  job_denied boolean := false;
  appointment_denied boolean := false;
  contact_update_denied boolean := false;
  property_update_denied boolean := false;
begin
  if (select count(*) from public.contacts) <> 1
    or (select count(*) from public.properties) <> 1
    or (select count(*) from public.jobs) <> 1 then
    raise exception 'Field user can read records outside their assignment';
  end if;
  if exists (select 1 from public.leads) then
    raise exception 'Field user can read lead inbox records';
  end if;
  begin
    insert into public.contacts (account_id, assigned_to, first_name, created_by)
    values ('29000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000005', 'Field customer', '19000000-0000-0000-0000-000000000005');
  exception when others then contact_denied := true;
  end;
  begin
    insert into public.leads (account_id, assigned_to, title, trade, source, dedup_key)
    values ('29000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000005', 'Field lead', 'roofing', 'manual', 'matrix-field-lead');
  exception when others then lead_denied := true;
  end;
  begin
    insert into public.jobs (account_id, contact_id, assigned_to, title, trade, created_by)
    values ('29000000-0000-0000-0000-000000000001', '39000000-0000-0000-0000-000000000003', '19000000-0000-0000-0000-000000000005', 'Field new job', 'roofing', '19000000-0000-0000-0000-000000000005');
  exception when others then job_denied := true;
  end;
  begin
    insert into public.appointments (account_id, contact_id, assigned_to, title, starts_at, ends_at, created_by)
    values ('29000000-0000-0000-0000-000000000001', '39000000-0000-0000-0000-000000000003', '19000000-0000-0000-0000-000000000005', 'Field appointment', now() + interval '1 day', now() + interval '25 hours', '19000000-0000-0000-0000-000000000005');
  exception when others then appointment_denied := true;
  end;
  begin
    update public.contacts set phone = 'unauthorized' where id = '39000000-0000-0000-0000-000000000003';
    if not found then raise exception 'denied'; end if;
  exception when others then contact_update_denied := true;
  end;
  begin
    update public.properties set label = 'unauthorized' where id = '49000000-0000-0000-0000-000000000003';
    if not found then raise exception 'denied'; end if;
  exception when others then property_update_denied := true;
  end;
  if not (
    contact_denied and lead_denied and job_denied and appointment_denied
    and contact_update_denied and property_update_denied
  ) then
    raise exception 'Field user created or edited an office-owned record';
  end if;
end
$$;

select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-000000000006', true);
do $$ begin
  if exists (select 1 from public.contacts where account_id = '29000000-0000-0000-0000-000000000001')
    or exists (select 1 from public.jobs where account_id = '29000000-0000-0000-0000-000000000001') then
    raise exception 'Outside tenant can read matrix workspace records';
  end if;
end $$;

reset role;
rollback;
select 'bontraco_role_permission_matrix_passed' as result;
