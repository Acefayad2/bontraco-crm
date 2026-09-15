-- Repeatable appointment-assignment boundary checks. Fixtures always roll back.
begin;

insert into auth.users (id,email,aud,role,created_at,updated_at) values
('1c000000-0000-0000-0000-000000000001','calendar-owner@example.invalid','authenticated','authenticated',now(),now()),
('1c000000-0000-0000-0000-000000000002','calendar-dispatcher@example.invalid','authenticated','authenticated',now(),now()),
('1c000000-0000-0000-0000-000000000003','calendar-sales@example.invalid','authenticated','authenticated',now(),now()),
('1c000000-0000-0000-0000-000000000004','calendar-field@example.invalid','authenticated','authenticated',now(),now()),
('1c000000-0000-0000-0000-000000000005','calendar-outside@example.invalid','authenticated','authenticated',now(),now());

insert into public.accounts (id,name,slug,trades,created_by) values
('2c000000-0000-0000-0000-000000000001','Calendar Test One','bontraco-calendar-test-one',array['roofing']::public.bontraco_trade[],'1c000000-0000-0000-0000-000000000001'),
('2c000000-0000-0000-0000-000000000002','Calendar Test Two','bontraco-calendar-test-two',array['plumbing']::public.bontraco_trade[],'1c000000-0000-0000-0000-000000000005');

insert into public.memberships (account_id,user_id,role,display_name,email) values
('2c000000-0000-0000-0000-000000000001','1c000000-0000-0000-0000-000000000001','owner','Calendar Owner','calendar-owner@example.invalid'),
('2c000000-0000-0000-0000-000000000001','1c000000-0000-0000-0000-000000000002','dispatcher','Calendar Dispatcher','calendar-dispatcher@example.invalid'),
('2c000000-0000-0000-0000-000000000001','1c000000-0000-0000-0000-000000000003','sales','Calendar Sales','calendar-sales@example.invalid'),
('2c000000-0000-0000-0000-000000000001','1c000000-0000-0000-0000-000000000004','field','Calendar Field','calendar-field@example.invalid'),
('2c000000-0000-0000-0000-000000000002','1c000000-0000-0000-0000-000000000005','owner','Calendar Outside','calendar-outside@example.invalid');

insert into public.appointments (id,account_id,assigned_to,title,starts_at,ends_at,created_by) values
('3c000000-0000-0000-0000-000000000001','2c000000-0000-0000-0000-000000000001',null,'Dispatch inspection',now() + interval '1 day',now() + interval '25 hours','1c000000-0000-0000-0000-000000000001');

set local role authenticated;

select set_config('request.jwt.claim.sub','1c000000-0000-0000-0000-000000000002',true);
update public.appointments
set assigned_to = '1c000000-0000-0000-0000-000000000004'
where id = '3c000000-0000-0000-0000-000000000001';

select set_config('request.jwt.claim.sub','1c000000-0000-0000-0000-000000000004',true);
do $$
declare denied boolean := false; created boolean := false;
begin
  if (select count(*) from public.appointments) <> 1 then raise exception 'Field user cannot see assigned appointment'; end if;
  update public.appointments set status = 'confirmed' where id = '3c000000-0000-0000-0000-000000000001';
  if not found then raise exception 'Field user cannot update assigned appointment status'; end if;
  begin
    update public.appointments
    set assigned_to = '1c000000-0000-0000-0000-000000000003'
    where id = '3c000000-0000-0000-0000-000000000001';
  exception when others then denied := true;
  end;
  begin
    insert into public.appointments (account_id,assigned_to,title,starts_at,ends_at,created_by)
    values ('2c000000-0000-0000-0000-000000000001','1c000000-0000-0000-0000-000000000004','Field-created appointment',now() + interval '2 days',now() + interval '49 hours','1c000000-0000-0000-0000-000000000004');
    created := true;
  exception when others then null;
  end;
  if not denied then raise exception 'Field user reassigned an appointment'; end if;
  if created then raise exception 'Field user created an office-owned appointment'; end if;
end $$;

select set_config('request.jwt.claim.sub','1c000000-0000-0000-0000-000000000003',true);
do $$ begin
  if exists (select 1 from public.appointments) then raise exception 'Sales viewed another teammate appointment'; end if;
end $$;

select set_config('request.jwt.claim.sub','1c000000-0000-0000-0000-000000000005',true);
do $$ begin
  if exists (select 1 from public.appointments where id = '3c000000-0000-0000-0000-000000000001') then raise exception 'Outside tenant viewed appointment'; end if;
end $$;

reset role;
rollback;
select 'bontraco_appointment_assignment_rls_passed' as result;
