-- Repeatable notification visibility check. Fixtures always roll back.
begin;
insert into auth.users (id, email, aud, role, created_at, updated_at) values
('16000000-0000-0000-0000-000000000001','alert-owner@example.invalid','authenticated','authenticated',now(),now()),
('16000000-0000-0000-0000-000000000002','alert-sales@example.invalid','authenticated','authenticated',now(),now()),
('16000000-0000-0000-0000-000000000003','alert-other-sales@example.invalid','authenticated','authenticated',now(),now()),
('16000000-0000-0000-0000-000000000004','alert-outside@example.invalid','authenticated','authenticated',now(),now());
insert into public.accounts (id,name,slug,trades,created_by) values
('26000000-0000-0000-0000-000000000001','Alerts One','bontraco-alerts-one',array['roofing']::public.bontraco_trade[],'16000000-0000-0000-0000-000000000001'),
('26000000-0000-0000-0000-000000000002','Alerts Two','bontraco-alerts-two',array['plumbing']::public.bontraco_trade[],'16000000-0000-0000-0000-000000000004');
insert into public.memberships (account_id,user_id,role,display_name,email) values
('26000000-0000-0000-0000-000000000001','16000000-0000-0000-0000-000000000001','owner','Owner','alert-owner@example.invalid'),
('26000000-0000-0000-0000-000000000001','16000000-0000-0000-0000-000000000002','sales','Sales','alert-sales@example.invalid'),
('26000000-0000-0000-0000-000000000001','16000000-0000-0000-0000-000000000003','sales','Other Sales','alert-other-sales@example.invalid'),
('26000000-0000-0000-0000-000000000002','16000000-0000-0000-0000-000000000004','owner','Outside','alert-outside@example.invalid');
insert into public.leads (id,account_id,assigned_to,title,trade,source,contact_phone,score,dedup_key) values
('36000000-0000-0000-0000-000000000001','26000000-0000-0000-0000-000000000001','16000000-0000-0000-0000-000000000002','Priority roof prospect','roofing','google_places','3125550199',90,'alerts-priority'),
('36000000-0000-0000-0000-000000000002','26000000-0000-0000-0000-000000000001',null,'Low score prospect','roofing','web_search',null,55,'alerts-low');

do $$ begin
  if (select count(*) from public.notifications where lead_id = '36000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'High-priority lead did not create exactly one alert';
  end if;
  if exists (select 1 from public.notifications where lead_id = '36000000-0000-0000-0000-000000000002') then
    raise exception 'Low-score lead created an alert';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','16000000-0000-0000-0000-000000000002',true);
do $$ begin if (select count(*) from public.notifications) <> 1 then raise exception 'Assigned sales cannot see relevant alert'; end if; end $$;
select set_config('request.jwt.claim.sub','16000000-0000-0000-0000-000000000003',true);
do $$ begin if (select count(*) from public.notifications) <> 0 then raise exception 'Unassigned sales viewed another rep alert'; end if; end $$;
select set_config('request.jwt.claim.sub','16000000-0000-0000-0000-000000000001',true);
do $$ begin
  if (select count(*) from public.notifications) <> 1 then raise exception 'Owner cannot see workspace alert'; end if;
  update public.notifications set read_at = now();
  if (select count(*) from public.notifications where read_at is not null) <> 1 then raise exception 'Owner cannot acknowledge alerts'; end if;
  begin
    execute 'update public.notifications set title = ''Rewritten''';
    raise exception 'Authenticated user rewrote protected alert content';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claim.sub','16000000-0000-0000-0000-000000000004',true);
do $$ begin if (select count(*) from public.notifications) <> 0 then raise exception 'Outside tenant viewed alerts'; end if; end $$;
reset role;
rollback;
select 'bontraco_notifications_rls_passed' as result;
