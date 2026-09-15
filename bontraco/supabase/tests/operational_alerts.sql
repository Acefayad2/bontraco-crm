-- Repeatable urgent-call and billing transition alert checks. Fixtures always roll back.
begin;
insert into auth.users (id, email, aud, role, created_at, updated_at) values
('17000000-0000-0000-0000-000000000001','ops-owner@example.invalid','authenticated','authenticated',now(),now());
insert into public.accounts (id,name,slug,trades,created_by) values
('27000000-0000-0000-0000-000000000001','Ops Alerts','bontraco-ops-alerts',array['electrical']::public.bontraco_trade[],'17000000-0000-0000-0000-000000000001');
insert into public.memberships (account_id,user_id,role,display_name,email) values
('27000000-0000-0000-0000-000000000001','17000000-0000-0000-0000-000000000001','owner','Owner','ops-owner@example.invalid');
insert into public.calls
  (id,account_id,provider,provider_call_id,emergency_flag,caller_name,summary)
values
  ('57000000-0000-0000-0000-000000000001','27000000-0000-0000-0000-000000000001','retell','urgent-alert-call',true,'Taylor Caller','Sparking panel with a burning smell.');
update public.calls set emergency_flag = true where id = '57000000-0000-0000-0000-000000000001';

insert into public.account_subscriptions
  (account_id,plan_slug,status)
values
  ('27000000-0000-0000-0000-000000000001','pro','active');
update public.account_subscriptions
set status = 'past_due'
where account_id = '27000000-0000-0000-0000-000000000001';

insert into public.operational_incidents
  (fingerprint,kind,severity,source_record_id,payload,detected_at)
values
  (
    'urgent_call:57000000-0000-0000-0000-000000000001',
    'urgent_call',
    'critical',
    '57000000-0000-0000-0000-000000000001',
    '{"account_id":"27000000-0000-0000-0000-000000000001"}'::jsonb,
    now()
  );
update public.account_subscriptions
set status = 'past_due'
where account_id = '27000000-0000-0000-0000-000000000001';

do $$ begin
  if (select count(*) from public.notifications where kind = 'urgent_call') <> 1 then
    raise exception 'Urgent call alert is missing or duplicated';
  end if;
  if (select count(*) from public.notifications where kind = 'billing_issue') <> 1 then
    raise exception 'Billing transition alert is missing or duplicated';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '17000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare denied boolean := false;
begin
  begin
    perform * from public.operational_incidents;
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then
    raise exception 'Operational incidents must remain server-only';
  end if;
end $$;

reset role;
rollback;
select 'bontraco_operational_alerts_passed' as result;
