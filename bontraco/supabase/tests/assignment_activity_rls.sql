-- Repeatable cross-record assignment-audit and visibility checks. Fixtures always roll back.
begin;

insert into auth.users (id,email,aud,role,created_at,updated_at) values
('1b200000-0000-0000-0000-000000000001','assignment-owner@example.invalid','authenticated','authenticated',now(),now()),
('1b200000-0000-0000-0000-000000000002','assignment-dispatch@example.invalid','authenticated','authenticated',now(),now()),
('1b200000-0000-0000-0000-000000000003','assignment-sales@example.invalid','authenticated','authenticated',now(),now()),
('1b200000-0000-0000-0000-000000000004','assignment-other@example.invalid','authenticated','authenticated',now(),now()),
('1b200000-0000-0000-0000-000000000005','assignment-outside@example.invalid','authenticated','authenticated',now(),now());

insert into public.accounts (id,name,slug,trades,created_by) values
('2b200000-0000-0000-0000-000000000001','Assignment Audit One','bontraco-assignment-audit-one',array['roofing']::public.bontraco_trade[],'1b200000-0000-0000-0000-000000000001'),
('2b200000-0000-0000-0000-000000000002','Assignment Audit Two','bontraco-assignment-audit-two',array['plumbing']::public.bontraco_trade[],'1b200000-0000-0000-0000-000000000005');

insert into public.memberships (account_id,user_id,role,display_name,email) values
('2b200000-0000-0000-0000-000000000001','1b200000-0000-0000-0000-000000000001','owner','Assignment Owner','assignment-owner@example.invalid'),
('2b200000-0000-0000-0000-000000000001','1b200000-0000-0000-0000-000000000002','dispatcher','Assignment Dispatcher','assignment-dispatch@example.invalid'),
('2b200000-0000-0000-0000-000000000001','1b200000-0000-0000-0000-000000000003','sales','Assignment Sales','assignment-sales@example.invalid'),
('2b200000-0000-0000-0000-000000000001','1b200000-0000-0000-0000-000000000004','sales','Other Sales','assignment-other@example.invalid'),
('2b200000-0000-0000-0000-000000000002','1b200000-0000-0000-0000-000000000005','owner','Assignment Outside','assignment-outside@example.invalid');

insert into public.contacts (id,account_id,first_name,last_name,created_by)
values ('3b200000-0000-0000-0000-000000000001','2b200000-0000-0000-0000-000000000001','Audit','Customer','1b200000-0000-0000-0000-000000000001');

insert into public.leads (id,account_id,contact_id,title,trade,source,dedup_key)
values ('4b200000-0000-0000-0000-000000000001','2b200000-0000-0000-0000-000000000001','3b200000-0000-0000-0000-000000000001','Audit lead','roofing','manual','assignment-audit-lead');

insert into public.jobs (id,account_id,contact_id,lead_id,title,trade,created_by)
values ('5b200000-0000-0000-0000-000000000001','2b200000-0000-0000-0000-000000000001','3b200000-0000-0000-0000-000000000001','4b200000-0000-0000-0000-000000000001','Audit job','roofing','1b200000-0000-0000-0000-000000000001');

insert into public.appointments (id,account_id,job_id,contact_id,title,starts_at,ends_at,created_by)
values ('6b200000-0000-0000-0000-000000000001','2b200000-0000-0000-0000-000000000001','5b200000-0000-0000-0000-000000000001','3b200000-0000-0000-0000-000000000001','Audit appointment',now() + interval '1 day',now() + interval '25 hours','1b200000-0000-0000-0000-000000000001');

insert into public.tasks (id,account_id,job_id,title,created_by)
values ('7b200000-0000-0000-0000-000000000001','2b200000-0000-0000-0000-000000000001','5b200000-0000-0000-0000-000000000001','Audit task','1b200000-0000-0000-0000-000000000001');

insert into public.calls (id,account_id,contact_id,lead_id,job_id,provider,provider_call_id,status,caller_name)
values ('8b200000-0000-0000-0000-000000000001','2b200000-0000-0000-0000-000000000001','3b200000-0000-0000-0000-000000000001','4b200000-0000-0000-0000-000000000001','5b200000-0000-0000-0000-000000000001','retell','assignment-audit-call','completed','Audit Caller');

set local role authenticated;
select set_config('request.jwt.claim.sub','1b200000-0000-0000-0000-000000000002',true);

update public.contacts set assigned_to = '1b200000-0000-0000-0000-000000000003'
where id = '3b200000-0000-0000-0000-000000000001';
update public.leads set assigned_to = '1b200000-0000-0000-0000-000000000003'
where id = '4b200000-0000-0000-0000-000000000001';
update public.jobs set assigned_to = '1b200000-0000-0000-0000-000000000003'
where id = '5b200000-0000-0000-0000-000000000001';
update public.appointments set assigned_to = '1b200000-0000-0000-0000-000000000003'
where id = '6b200000-0000-0000-0000-000000000001';
update public.tasks set assigned_to = '1b200000-0000-0000-0000-000000000003'
where id = '7b200000-0000-0000-0000-000000000001';
update public.calls set assigned_to = '1b200000-0000-0000-0000-000000000003'
where id = '8b200000-0000-0000-0000-000000000001';

update public.contacts set assigned_to = '1b200000-0000-0000-0000-000000000003'
where id = '3b200000-0000-0000-0000-000000000001';

do $$ begin
  if (select count(*) from public.activities where kind = 'assignment_changed') <> 6 then
    raise exception 'Assignment updates did not create exactly six audit events';
  end if;
  if exists (select 1 from public.notifications where kind = 'assignment') then
    raise exception 'Dispatcher could see private assignment notifications';
  end if;
  if (select count(distinct metadata ->> 'source_table') from public.activities where kind = 'assignment_changed') <> 6 then
    raise exception 'Assignment audit did not cover every operational record type';
  end if;
  if exists (
    select 1 from public.activities
    where kind = 'assignment_changed'
      and (
        metadata ->> 'old_assignee' is not null
        or metadata ->> 'new_assignee' <> '1b200000-0000-0000-0000-000000000003'
      )
  ) then raise exception 'Assignment audit metadata is incomplete'; end if;
end $$;

select set_config('request.jwt.claim.sub','1b200000-0000-0000-0000-000000000003',true);
do $$ begin
  if (select count(*) from public.activities where kind = 'assignment_changed') <> 6 then
    raise exception 'Assigned sales could not see linked assignment history';
  end if;
  if (select count(*) from public.notifications where kind = 'assignment') <> 6 then
    raise exception 'Assigned sales did not receive exactly six assignment notifications';
  end if;
  if (select count(distinct metadata ->> 'source_table') from public.notifications where kind = 'assignment') <> 6 then
    raise exception 'Assignment notifications did not cover every operational record type';
  end if;
  if exists (
    select 1 from public.notifications
    where kind = 'assignment'
      and (
        user_id <> '1b200000-0000-0000-0000-000000000003'
        or metadata ->> 'assigned_by' <> '1b200000-0000-0000-0000-000000000002'
      )
  ) then raise exception 'Assignment notification recipient or actor metadata is incorrect'; end if;
end $$;

select set_config('request.jwt.claim.sub','1b200000-0000-0000-0000-000000000004',true);
do $$ begin
  if exists (select 1 from public.activities where kind = 'assignment_changed') then
    raise exception 'Unassigned sales could see assignment history';
  end if;
  if exists (select 1 from public.notifications where kind = 'assignment') then
    raise exception 'Unassigned sales could see assignment notifications';
  end if;
end $$;

select set_config('request.jwt.claim.sub','1b200000-0000-0000-0000-000000000005',true);
do $$ begin
  if exists (select 1 from public.activities where kind = 'assignment_changed') then
    raise exception 'Outside tenant could see assignment history';
  end if;
  if exists (select 1 from public.notifications where kind = 'assignment') then
    raise exception 'Outside tenant could see assignment notifications';
  end if;
end $$;

reset role;
rollback;
select 'bontraco_assignment_activity_rls_passed' as result;
