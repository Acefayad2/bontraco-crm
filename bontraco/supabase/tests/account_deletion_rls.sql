-- Repeatable account deletion request and visibility checks. Fixtures always roll back.
begin;
insert into auth.users (id, email, aud, role, created_at, updated_at) values
('18000000-0000-0000-0000-000000000001','delete-owner@example.invalid','authenticated','authenticated',now(),now()),
('18000000-0000-0000-0000-000000000002','delete-admin@example.invalid','authenticated','authenticated',now(),now()),
('18000000-0000-0000-0000-000000000003','delete-outside@example.invalid','authenticated','authenticated',now(),now());
insert into public.accounts (id,name,slug,trades,created_by) values
('28000000-0000-0000-0000-000000000001','Delete One','delete-one',array['roofing']::public.bontraco_trade[],'18000000-0000-0000-0000-000000000001'),
('28000000-0000-0000-0000-000000000002','Delete Outside','delete-outside',array['plumbing']::public.bontraco_trade[],'18000000-0000-0000-0000-000000000003');
insert into public.memberships (account_id,user_id,role,display_name,email) values
('28000000-0000-0000-0000-000000000001','18000000-0000-0000-0000-000000000001','owner','Owner','delete-owner@example.invalid'),
('28000000-0000-0000-0000-000000000001','18000000-0000-0000-0000-000000000002','admin','Admin','delete-admin@example.invalid'),
('28000000-0000-0000-0000-000000000002','18000000-0000-0000-0000-000000000003','owner','Outside','delete-outside@example.invalid');

set local role authenticated;
select set_config('request.jwt.claim.sub','18000000-0000-0000-0000-000000000002',true);
do $$
declare rejected boolean := false;
begin
  begin
    perform public.request_bontraco_account_deletion('28000000-0000-0000-0000-000000000001','delete-one');
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'Admin requested owner-only account deletion'; end if;
end $$;

select set_config('request.jwt.claim.sub','18000000-0000-0000-0000-000000000001',true);
do $$
declare first_time timestamptz; second_time timestamptz;
begin
  first_time := public.request_bontraco_account_deletion('28000000-0000-0000-0000-000000000001','delete-one');
  second_time := public.request_bontraco_account_deletion('28000000-0000-0000-0000-000000000001','delete-one');
  if first_time <> second_time then raise exception 'Deletion request is not idempotent'; end if;
  if first_time < now() + interval '13 days 23 hours' then raise exception 'Deletion grace period is too short'; end if;
  if (select count(*) from public.account_deletion_requests) <> 1 then raise exception 'Owner deletion request missing or duplicated'; end if;
  if not public.cancel_bontraco_account_deletion('28000000-0000-0000-0000-000000000001') then raise exception 'Owner could not cancel deletion'; end if;
  if public.cancel_bontraco_account_deletion('28000000-0000-0000-0000-000000000001') then raise exception 'Cancellation was not idempotent'; end if;
end $$;

select set_config('request.jwt.claim.sub','18000000-0000-0000-0000-000000000003',true);
do $$ begin
  if (select count(*) from public.account_deletion_requests) <> 0 then raise exception 'Outside owner viewed another account deletion request'; end if;
end $$;
reset role;
rollback;
select 'bontraco_account_deletion_rls_passed' as result;
