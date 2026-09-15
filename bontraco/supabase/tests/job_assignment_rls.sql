-- Repeatable job-assignment visibility and mutation checks. Fixtures always roll back.
begin;

insert into auth.users (id,email,aud,role,created_at,updated_at) values
('1b000000-0000-0000-0000-000000000001','assignment-owner@example.invalid','authenticated','authenticated',now(),now()),
('1b000000-0000-0000-0000-000000000002','assignment-dispatcher@example.invalid','authenticated','authenticated',now(),now()),
('1b000000-0000-0000-0000-000000000003','assignment-sales@example.invalid','authenticated','authenticated',now(),now()),
('1b000000-0000-0000-0000-000000000004','assignment-field@example.invalid','authenticated','authenticated',now(),now()),
('1b000000-0000-0000-0000-000000000005','assignment-outside@example.invalid','authenticated','authenticated',now(),now());

insert into public.accounts (id,name,slug,trades,created_by) values
('2b000000-0000-0000-0000-000000000001','Assignment Test One','bontraco-assignment-test-one',array['roofing']::public.bontraco_trade[],'1b000000-0000-0000-0000-000000000001'),
('2b000000-0000-0000-0000-000000000002','Assignment Test Two','bontraco-assignment-test-two',array['plumbing']::public.bontraco_trade[],'1b000000-0000-0000-0000-000000000005');

insert into public.memberships (account_id,user_id,role,display_name,email) values
('2b000000-0000-0000-0000-000000000001','1b000000-0000-0000-0000-000000000001','owner','Assignment Owner','assignment-owner@example.invalid'),
('2b000000-0000-0000-0000-000000000001','1b000000-0000-0000-0000-000000000002','dispatcher','Assignment Dispatcher','assignment-dispatcher@example.invalid'),
('2b000000-0000-0000-0000-000000000001','1b000000-0000-0000-0000-000000000003','sales','Assignment Sales','assignment-sales@example.invalid'),
('2b000000-0000-0000-0000-000000000001','1b000000-0000-0000-0000-000000000004','field','Assignment Field','assignment-field@example.invalid'),
('2b000000-0000-0000-0000-000000000002','1b000000-0000-0000-0000-000000000005','owner','Assignment Outside','assignment-outside@example.invalid');

insert into public.contacts (id,account_id,first_name,created_by) values
('3b000000-0000-0000-0000-000000000001','2b000000-0000-0000-0000-000000000001','Assignment Customer','1b000000-0000-0000-0000-000000000001');

insert into public.jobs (id,account_id,contact_id,assigned_to,title,trade,created_by) values
('4b000000-0000-0000-0000-000000000001','2b000000-0000-0000-0000-000000000001','3b000000-0000-0000-0000-000000000001',null,'Assignable job','roofing','1b000000-0000-0000-0000-000000000001');

set local role authenticated;

select set_config('request.jwt.claim.sub','1b000000-0000-0000-0000-000000000002',true);
update public.jobs
set assigned_to = '1b000000-0000-0000-0000-000000000004'
where id = '4b000000-0000-0000-0000-000000000001';
do $$ begin
  if (select assigned_to from public.jobs where id = '4b000000-0000-0000-0000-000000000001') <> '1b000000-0000-0000-0000-000000000004' then
    raise exception 'Dispatcher could not assign an active field teammate';
  end if;
end $$;

select set_config('request.jwt.claim.sub','1b000000-0000-0000-0000-000000000004',true);
do $$
declare denied boolean := false;
begin
  if (select count(*) from public.jobs) <> 1 then raise exception 'Field user cannot see their assigned job'; end if;
  begin
    update public.jobs
    set assigned_to = '1b000000-0000-0000-0000-000000000003'
    where id = '4b000000-0000-0000-0000-000000000001';
  exception when others then denied := true;
  end;
  if not denied then raise exception 'Field user reassigned a job to another teammate'; end if;
end $$;

select set_config('request.jwt.claim.sub','1b000000-0000-0000-0000-000000000003',true);
do $$ begin
  if exists (select 1 from public.jobs) then raise exception 'Sales user viewed another teammate job'; end if;
end $$;

select set_config('request.jwt.claim.sub','1b000000-0000-0000-0000-000000000005',true);
do $$ begin
  if exists (select 1 from public.jobs where id = '4b000000-0000-0000-0000-000000000001') then raise exception 'Outside tenant viewed assigned job'; end if;
end $$;

reset role;
rollback;
select 'bontraco_job_assignment_rls_passed' as result;
