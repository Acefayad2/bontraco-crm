-- Repeatable customer-assignment visibility and mutation checks. Fixtures always roll back.
begin;

insert into auth.users (id,email,aud,role,created_at,updated_at) values
('1d000000-0000-0000-0000-000000000001','customer-owner@example.invalid','authenticated','authenticated',now(),now()),
('1d000000-0000-0000-0000-000000000002','customer-dispatcher@example.invalid','authenticated','authenticated',now(),now()),
('1d000000-0000-0000-0000-000000000003','customer-sales@example.invalid','authenticated','authenticated',now(),now()),
('1d000000-0000-0000-0000-000000000004','customer-other@example.invalid','authenticated','authenticated',now(),now()),
('1d000000-0000-0000-0000-000000000005','customer-outside@example.invalid','authenticated','authenticated',now(),now());

insert into public.accounts (id,name,slug,trades,created_by) values
('2d000000-0000-0000-0000-000000000001','Customer Assignment One','bontraco-customer-assignment-one',array['roofing']::public.bontraco_trade[],'1d000000-0000-0000-0000-000000000001'),
('2d000000-0000-0000-0000-000000000002','Customer Assignment Two','bontraco-customer-assignment-two',array['plumbing']::public.bontraco_trade[],'1d000000-0000-0000-0000-000000000005');

insert into public.memberships (account_id,user_id,role,display_name,email) values
('2d000000-0000-0000-0000-000000000001','1d000000-0000-0000-0000-000000000001','owner','Customer Owner','customer-owner@example.invalid'),
('2d000000-0000-0000-0000-000000000001','1d000000-0000-0000-0000-000000000002','dispatcher','Customer Dispatcher','customer-dispatcher@example.invalid'),
('2d000000-0000-0000-0000-000000000001','1d000000-0000-0000-0000-000000000003','sales','Customer Sales','customer-sales@example.invalid'),
('2d000000-0000-0000-0000-000000000001','1d000000-0000-0000-0000-000000000004','sales','Other Sales','customer-other@example.invalid'),
('2d000000-0000-0000-0000-000000000002','1d000000-0000-0000-0000-000000000005','owner','Customer Outside','customer-outside@example.invalid');

insert into public.contacts (id,account_id,assigned_to,first_name,created_by) values
('3d000000-0000-0000-0000-000000000001','2d000000-0000-0000-0000-000000000001',null,'Assignable Customer','1d000000-0000-0000-0000-000000000001');

set local role authenticated;

select set_config('request.jwt.claim.sub','1d000000-0000-0000-0000-000000000002',true);
update public.contacts
set assigned_to = '1d000000-0000-0000-0000-000000000003'
where id = '3d000000-0000-0000-0000-000000000001';

select set_config('request.jwt.claim.sub','1d000000-0000-0000-0000-000000000003',true);
do $$
declare denied boolean := false;
begin
  if (select count(*) from public.contacts) <> 1 then raise exception 'Sales cannot see assigned customer'; end if;
  begin
    update public.contacts
    set assigned_to = '1d000000-0000-0000-0000-000000000004'
    where id = '3d000000-0000-0000-0000-000000000001';
  exception when others then denied := true;
  end;
  if not denied then raise exception 'Sales reassigned customer to another teammate'; end if;
end $$;

select set_config('request.jwt.claim.sub','1d000000-0000-0000-0000-000000000004',true);
do $$ begin
  if exists (select 1 from public.contacts) then raise exception 'Unassigned sales viewed another rep customer'; end if;
end $$;

select set_config('request.jwt.claim.sub','1d000000-0000-0000-0000-000000000005',true);
do $$ begin
  if exists (select 1 from public.contacts where id = '3d000000-0000-0000-0000-000000000001') then raise exception 'Outside tenant viewed customer'; end if;
end $$;

reset role;
rollback;
select 'bontraco_customer_assignment_rls_passed' as result;
