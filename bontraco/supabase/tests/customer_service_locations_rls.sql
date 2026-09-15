-- Repeatable atomic customer/location creation and assigned-record isolation check.

begin;

insert into auth.users (id, email, aud, role, created_at, updated_at) values
  ('14000000-0000-0000-0000-000000000001', 'location-owner@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('14000000-0000-0000-0000-000000000002', 'location-sales@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('14000000-0000-0000-0000-000000000003', 'location-field@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('14000000-0000-0000-0000-000000000004', 'location-outside@example.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.accounts (id, name, slug, trades, created_by) values
  ('24000000-0000-0000-0000-000000000001', 'Location Test One', 'bontraco-location-test-one', array['roofing']::public.bontraco_trade[], '14000000-0000-0000-0000-000000000001'),
  ('24000000-0000-0000-0000-000000000002', 'Location Test Two', 'bontraco-location-test-two', array['plumbing']::public.bontraco_trade[], '14000000-0000-0000-0000-000000000004');

insert into public.memberships (account_id, user_id, role, display_name, email) values
  ('24000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000001', 'owner', 'Location Owner', 'location-owner@example.invalid'),
  ('24000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000002', 'sales', 'Location Sales', 'location-sales@example.invalid'),
  ('24000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000003', 'field', 'Location Field', 'location-field@example.invalid'),
  ('24000000-0000-0000-0000-000000000002', '14000000-0000-0000-0000-000000000004', 'owner', 'Location Outside', 'location-outside@example.invalid');

set local role authenticated;
select set_config('request.jwt.claim.sub', '14000000-0000-0000-0000-000000000001', true);
do $$
declare new_contact_id uuid;
  new_property_id uuid;
  oversized_denied boolean := false;
begin
  new_contact_id := public.create_bontraco_contact(
    '24000000-0000-0000-0000-000000000001',
    'Owner-created', null, null, '6305550101', null, 'manual',
    '100 Main Street', 'Naperville', 'IL', '60540'
  );
  if not exists (
    select 1 from public.contacts c where c.id = new_contact_id and c.assigned_to is null
  ) then raise exception 'Owner customer was not created'; end if;
  if not exists (
    select 1 from public.properties p
    where p.contact_id = new_contact_id and p.address_line_1 = '100 Main Street'
  ) then raise exception 'Owner initial service location was not created atomically'; end if;
  select id into new_property_id from public.properties where contact_id = new_contact_id;
  insert into public.jobs (
    account_id, contact_id, property_id, title, trade, created_by
  ) values (
    '24000000-0000-0000-0000-000000000001', new_contact_id, new_property_id,
    'Location lifecycle test job', 'roofing', '14000000-0000-0000-0000-000000000001'
  );
  perform public.set_bontraco_property_active(
    '24000000-0000-0000-0000-000000000001', new_property_id, false
  );
  if not exists (
    select 1 from public.properties
    where id = new_property_id and not active and archived_at is not null
  ) then raise exception 'Owner could not archive a service location'; end if;
  if not exists (
    select 1 from public.jobs where property_id = new_property_id
  ) then raise exception 'Archiving a service location broke its linked job'; end if;
  if not exists (
    select 1 from public.activities
    where contact_id = new_contact_id and kind = 'service_location_archived'
  ) then raise exception 'Service location archive was not audited'; end if;
  perform public.set_bontraco_property_active(
    '24000000-0000-0000-0000-000000000001', new_property_id, true
  );
  if not exists (
    select 1 from public.properties
    where id = new_property_id and active and archived_at is null and archived_by is null
  ) then raise exception 'Owner could not reactivate a service location'; end if;
  begin
    perform public.create_bontraco_contact(
      '24000000-0000-0000-0000-000000000001', repeat('x', 81)
    );
  exception when others then oversized_denied := true;
  end;
  if not oversized_denied then raise exception 'Oversized customer input was accepted'; end if;
end
$$;

select set_config('request.jwt.claim.sub', '14000000-0000-0000-0000-000000000002', true);
do $$
declare new_contact_id uuid;
  new_property_id uuid;
  archive_denied boolean := false;
begin
  if exists (select 1 from public.contacts where first_name = 'Owner-created') then
    raise exception 'Sales user can see unassigned owner customer';
  end if;
  new_contact_id := public.create_bontraco_contact(
    '24000000-0000-0000-0000-000000000001',
    'Sales-created'
  );
  if not exists (
    select 1 from public.contacts
    where id = new_contact_id and assigned_to = '14000000-0000-0000-0000-000000000002'
  ) then raise exception 'Sales-created customer was not assigned to its creator'; end if;
  insert into public.properties (account_id, contact_id, label, address_line_1, city, region)
  values (
    '24000000-0000-0000-0000-000000000001', new_contact_id,
    'Second location', '200 Main Street', 'Naperville', 'IL'
  );
  if not exists (select 1 from public.properties p where p.contact_id = new_contact_id) then
    raise exception 'Sales user could not add a visible service location';
  end if;
  select id into new_property_id from public.properties where contact_id = new_contact_id;
  begin
    perform public.set_bontraco_property_active(
      '24000000-0000-0000-0000-000000000001', new_property_id, false
    );
  exception when others then archive_denied := true;
  end;
  if not archive_denied then raise exception 'Sales user archived a service location'; end if;
end
$$;

select set_config('request.jwt.claim.sub', '14000000-0000-0000-0000-000000000003', true);
do $$
declare denied boolean := false;
begin
  begin
    perform public.create_bontraco_contact(
      '24000000-0000-0000-0000-000000000001',
      'Field-created'
    );
  exception when others then denied := true;
  end;
  if not denied then raise exception 'Field user created a customer'; end if;
end
$$;

select set_config('request.jwt.claim.sub', '14000000-0000-0000-0000-000000000004', true);
do $$
begin
  if exists (
    select 1 from public.properties
    where account_id = '24000000-0000-0000-0000-000000000001'
  ) then raise exception 'Outside tenant read service locations'; end if;
end
$$;

reset role;
rollback;
select 'bontraco_customer_service_locations_rls_passed' as result;
