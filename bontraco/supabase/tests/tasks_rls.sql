-- Repeatable task visibility and assignment checks. Fixtures always roll back.
begin;

insert into auth.users (id,email,aud,role,created_at,updated_at) values
('1a000000-0000-0000-0000-000000000001','task-owner@example.invalid','authenticated','authenticated',now(),now()),
('1a000000-0000-0000-0000-000000000002','task-sales@example.invalid','authenticated','authenticated',now(),now()),
('1a000000-0000-0000-0000-000000000003','task-field@example.invalid','authenticated','authenticated',now(),now()),
('1a000000-0000-0000-0000-000000000004','task-outside@example.invalid','authenticated','authenticated',now(),now());

insert into public.accounts (id,name,slug,trades,created_by) values
('2a000000-0000-0000-0000-000000000001','Task Test One','bontraco-task-test-one',array['roofing']::public.bontraco_trade[],'1a000000-0000-0000-0000-000000000001'),
('2a000000-0000-0000-0000-000000000002','Task Test Two','bontraco-task-test-two',array['plumbing']::public.bontraco_trade[],'1a000000-0000-0000-0000-000000000004');

insert into public.memberships (account_id,user_id,role,display_name,email) values
('2a000000-0000-0000-0000-000000000001','1a000000-0000-0000-0000-000000000001','owner','Task Owner','task-owner@example.invalid'),
('2a000000-0000-0000-0000-000000000001','1a000000-0000-0000-0000-000000000002','sales','Task Sales','task-sales@example.invalid'),
('2a000000-0000-0000-0000-000000000001','1a000000-0000-0000-0000-000000000003','field','Task Field','task-field@example.invalid'),
('2a000000-0000-0000-0000-000000000002','1a000000-0000-0000-0000-000000000004','owner','Outside Owner','task-outside@example.invalid');

insert into public.tasks (id,account_id,assigned_to,title,due_at,created_by) values
('3a000000-0000-0000-0000-000000000001','2a000000-0000-0000-0000-000000000001','1a000000-0000-0000-0000-000000000002','Sales follow-up',now() + interval '1 day','1a000000-0000-0000-0000-000000000001'),
('3a000000-0000-0000-0000-000000000002','2a000000-0000-0000-0000-000000000001','1a000000-0000-0000-0000-000000000003','Field checklist',now() + interval '2 days','1a000000-0000-0000-0000-000000000001'),
('3a000000-0000-0000-0000-000000000003','2a000000-0000-0000-0000-000000000001',null,'Manager-only queue',null,'1a000000-0000-0000-0000-000000000001');

set local role authenticated;

select set_config('request.jwt.claim.sub','1a000000-0000-0000-0000-000000000001',true);
do $$ begin
  if (select count(*) from public.tasks) <> 3 then raise exception 'Owner cannot see all workspace tasks'; end if;
  insert into public.tasks (account_id,assigned_to,title,created_by)
  values ('2a000000-0000-0000-0000-000000000001','1a000000-0000-0000-0000-000000000003','Owner-assigned task','1a000000-0000-0000-0000-000000000001');
end $$;

select set_config('request.jwt.claim.sub','1a000000-0000-0000-0000-000000000002',true);
do $$
declare denied boolean := false;
begin
  if (select count(*) from public.tasks) <> 1 then raise exception 'Sales can read tasks outside their assignment'; end if;
  update public.tasks set completed_at = now() where id = '3a000000-0000-0000-0000-000000000001';
  if not found then raise exception 'Sales cannot complete their assigned task'; end if;
  begin
    insert into public.tasks (account_id,assigned_to,title,created_by)
    values ('2a000000-0000-0000-0000-000000000001','1a000000-0000-0000-0000-000000000003','Cross-assigned task','1a000000-0000-0000-0000-000000000002');
  exception when others then denied := true;
  end;
  if not denied then raise exception 'Sales assigned a task to another user'; end if;
  insert into public.tasks (account_id,assigned_to,title,created_by)
  values ('2a000000-0000-0000-0000-000000000001','1a000000-0000-0000-0000-000000000002','Sales personal task','1a000000-0000-0000-0000-000000000002');
end $$;

select set_config('request.jwt.claim.sub','1a000000-0000-0000-0000-000000000003',true);
do $$ begin
  if (select count(*) from public.tasks) <> 2 then raise exception 'Field user cannot see assigned tasks'; end if;
  insert into public.tasks (account_id,assigned_to,title,created_by)
  values ('2a000000-0000-0000-0000-000000000001','1a000000-0000-0000-0000-000000000003','Field personal task','1a000000-0000-0000-0000-000000000003');
end $$;

select set_config('request.jwt.claim.sub','1a000000-0000-0000-0000-000000000004',true);
do $$ begin
  if exists (select 1 from public.tasks where account_id = '2a000000-0000-0000-0000-000000000001') then raise exception 'Outside tenant viewed workspace tasks'; end if;
end $$;

reset role;
rollback;
select 'bontraco_tasks_rls_passed' as result;
