-- Repeatable receptionist settings and call privacy check. Fixtures always roll back.
begin;
insert into auth.users (id, email, aud, role, created_at, updated_at) values
('14000000-0000-0000-0000-000000000001','calls-owner@example.invalid','authenticated','authenticated',now(),now()),
('14000000-0000-0000-0000-000000000002','calls-sales@example.invalid','authenticated','authenticated',now(),now()),
('14000000-0000-0000-0000-000000000003','calls-field@example.invalid','authenticated','authenticated',now(),now()),
('14000000-0000-0000-0000-000000000004','calls-outside@example.invalid','authenticated','authenticated',now(),now());
insert into public.accounts (id,name,slug,trades,created_by) values
('24000000-0000-0000-0000-000000000001','Calls One','bontraco-calls-one',array['roofing']::public.bontraco_trade[],'14000000-0000-0000-0000-000000000001'),
('24000000-0000-0000-0000-000000000002','Calls Two','bontraco-calls-two',array['plumbing']::public.bontraco_trade[],'14000000-0000-0000-0000-000000000004');
insert into public.memberships (account_id,user_id,role,display_name,email) values
('24000000-0000-0000-0000-000000000001','14000000-0000-0000-0000-000000000001','owner','Owner','calls-owner@example.invalid'),
('24000000-0000-0000-0000-000000000001','14000000-0000-0000-0000-000000000002','sales','Sales','calls-sales@example.invalid'),
('24000000-0000-0000-0000-000000000001','14000000-0000-0000-0000-000000000003','field','Field','calls-field@example.invalid'),
('24000000-0000-0000-0000-000000000002','14000000-0000-0000-0000-000000000004','owner','Outside','calls-outside@example.invalid');
insert into public.receptionist_settings (account_id,provider,created_by) values ('24000000-0000-0000-0000-000000000001','retell','14000000-0000-0000-0000-000000000001');
insert into public.calls (id,account_id,assigned_to,provider,provider_call_id,status) values
('54000000-0000-0000-0000-000000000001','24000000-0000-0000-0000-000000000001','14000000-0000-0000-0000-000000000002','retell','call-assigned','completed'),
('54000000-0000-0000-0000-000000000002','24000000-0000-0000-0000-000000000001',null,'retell','call-unassigned','completed');
insert into public.call_events (account_id,call_id,provider_event_id,event_type) values ('24000000-0000-0000-0000-000000000001','54000000-0000-0000-0000-000000000001','event-assigned','call_analyzed');
insert into public.call_usage (account_id,call_id,provider,external_usage_id,billable_seconds,provider_cost_cents)
values ('24000000-0000-0000-0000-000000000001','54000000-0000-0000-0000-000000000001','retell','call-assigned',121,42);

do $$
declare starts timestamptz := now() + interval '2 days'; first_id uuid; second_id uuid;
begin
  first_id := public.book_receptionist_appointment('24000000-0000-0000-0000-000000000001','call-assigned','Jamie Customer','+13125550199','Roof inspection',starts,starts + interval '1 hour','Created during signed call');
  second_id := public.book_receptionist_appointment('24000000-0000-0000-0000-000000000001','call-assigned','Jamie Customer','+13125550199','Roof inspection',starts,starts + interval '1 hour','Created during signed call');
  if first_id <> second_id then raise exception 'Receptionist booking was not idempotent'; end if;
  if (select count(*) from public.appointments where external_source = 'retell') <> 1 then raise exception 'Receptionist created duplicate appointments'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','14000000-0000-0000-0000-000000000002',true);
do $$ begin
 if (select count(*) from public.calls) <> 1 then raise exception 'Sales call visibility is incorrect'; end if;
 if (select count(*) from public.call_events) <> 1 then raise exception 'Sales call event visibility is incorrect'; end if;
  if (select count(*) from public.receptionist_settings) <> 0 then raise exception 'Sales viewed receptionist secrets'; end if;
  if (select count(*) from public.call_usage) <> 0 then raise exception 'Sales viewed provider cost data'; end if;
end $$;
select set_config('request.jwt.claim.sub','14000000-0000-0000-0000-000000000001',true);
do $$ begin
 if (select count(*) from public.calls) <> 2 then raise exception 'Owner cannot see workspace calls'; end if;
  if (select count(*) from public.receptionist_settings) <> 1 then raise exception 'Owner cannot see receptionist settings'; end if;
  if (select billable_minutes from public.call_usage) <> 3 then raise exception 'Owner usage metering is incorrect'; end if;
end $$;
select set_config('request.jwt.claim.sub','14000000-0000-0000-0000-000000000003',true);
do $$ begin if (select count(*) from public.calls) <> 0 then raise exception 'Field role viewed private calls'; end if; end $$;
select set_config('request.jwt.claim.sub','14000000-0000-0000-0000-000000000004',true);
do $$ begin if (select count(*) from public.calls) <> 0 then raise exception 'Outside tenant viewed calls'; end if; end $$;
reset role;
rollback;
select 'bontraco_receptionist_rls_passed' as result;
