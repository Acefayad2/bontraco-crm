-- Repeatable plan-catalog and seat-limit checks. Fixtures always roll back.
begin;

insert into auth.users (id, email, aud, role, created_at, updated_at) values
  ('1a000000-0000-0000-0000-000000000001', 'seat-owner@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('1a000000-0000-0000-0000-000000000002', 'seat-user-two@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('1a000000-0000-0000-0000-000000000003', 'seat-user-three@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('1a000000-0000-0000-0000-000000000004', 'seat-user-four@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('1a000000-0000-0000-0000-000000000005', 'seat-user-five@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('1a000000-0000-0000-0000-000000000006', 'seat-invitee@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('1a000000-0000-0000-0000-000000000007', 'seat-second-invitee@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('1a000000-0000-0000-0000-000000000008', 'seat-direct-insert@example.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.accounts (id, name, slug, trades, created_by)
values (
  '2a000000-0000-0000-0000-000000000001',
  'Seat Limit Test',
  'bontraco-seat-limit-test',
  array['roofing']::public.bontraco_trade[],
  '1a000000-0000-0000-0000-000000000001'
);

insert into public.memberships (account_id, user_id, role, display_name, email) values
  ('2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000001', 'owner', 'Seat Owner', 'seat-owner@example.invalid'),
  ('2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000002', 'admin', 'Seat User Two', 'seat-user-two@example.invalid'),
  ('2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000003', 'sales', 'Seat User Three', 'seat-user-three@example.invalid'),
  ('2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000004', 'dispatcher', 'Seat User Four', 'seat-user-four@example.invalid'),
  ('2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000005', 'field', 'Seat User Five', 'seat-user-five@example.invalid');

insert into public.account_subscriptions (account_id, plan_slug, status)
values ('2a000000-0000-0000-0000-000000000001', 'starter', 'active');

set local role authenticated;
select set_config('request.jwt.claim.sub', '1a000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"1a000000-0000-0000-0000-000000000001","email":"seat-owner@example.invalid","role":"authenticated"}',
  true
);

do $$
declare denied boolean := false;
begin
  if (select count(*) from public.subscription_plans) <> 3 then
    raise exception 'Authenticated users cannot read the active plan catalog';
  end if;
  if (select included_users from public.subscription_plans where slug = 'starter') <> 5 then
    raise exception 'Starter user limit is not database-driven';
  end if;
  if not public.has_account_entitlement('2a000000-0000-0000-0000-000000000001', 'core_crm') then
    raise exception 'Starter core CRM entitlement is missing';
  end if;
  if public.has_account_entitlement('2a000000-0000-0000-0000-000000000001', 'lead_engine') then
    raise exception 'Starter unexpectedly received lead engine access';
  end if;

  begin
    insert into public.memberships (account_id, user_id, role, email)
    values (
      '2a000000-0000-0000-0000-000000000001',
      '1a000000-0000-0000-0000-000000000008',
      'sales',
      'seat-direct-insert@example.invalid'
    );
  exception when others then
    denied := true;
  end;
  if not denied then raise exception 'Direct membership insertion bypassed invitation acceptance'; end if;

  denied := false;
  begin
    insert into public.invitations (
      account_id, email, role, token_digest, invited_by, expires_at
    ) values (
      '2a000000-0000-0000-0000-000000000001',
      'seat-invitee@example.invalid',
      'sales',
      encode(extensions.digest('seat-token-one', 'sha256'), 'hex'),
      '1a000000-0000-0000-0000-000000000001',
      now() + interval '7 days'
    );
  exception when others then
    denied := position('Plan user limit reached' in sqlerrm) > 0;
  end;
  if not denied then raise exception 'Starter allowed an invitation beyond five occupied seats'; end if;

  denied := false;
  begin
    update public.subscription_plans set included_users = 99 where slug = 'starter';
  exception when others then
    denied := true;
  end;
  if not denied then raise exception 'Authenticated user modified the plan catalog'; end if;
end $$;

update public.memberships
set active = false
where account_id = '2a000000-0000-0000-0000-000000000001'
  and user_id = '1a000000-0000-0000-0000-000000000005';

insert into public.invitations (
  account_id, email, role, token_digest, invited_by, expires_at
) values (
  '2a000000-0000-0000-0000-000000000001',
  'seat-invitee@example.invalid',
  'sales',
  encode(extensions.digest('seat-token-one', 'sha256'), 'hex'),
  '1a000000-0000-0000-0000-000000000001',
  now() + interval '7 days'
);

do $$
declare denied boolean := false;
begin
  begin
    insert into public.invitations (
      account_id, email, role, token_digest, invited_by, expires_at
    ) values (
      '2a000000-0000-0000-0000-000000000001',
      'seat-second-invitee@example.invalid',
      'sales',
      encode(extensions.digest('seat-token-two', 'sha256'), 'hex'),
      '1a000000-0000-0000-0000-000000000001',
      now() + interval '7 days'
    );
  exception when others then
    denied := position('Plan user limit reached' in sqlerrm) > 0;
  end;
  if not denied then raise exception 'Pending invitation did not reserve the final Starter seat'; end if;
end $$;

select set_config('request.jwt.claim.sub', '1a000000-0000-0000-0000-000000000006', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"1a000000-0000-0000-0000-000000000006","email":"seat-invitee@example.invalid","role":"authenticated","user_metadata":{"full_name":"Seat Invitee"}}',
  true
);
select public.accept_bontraco_invitation('seat-token-one');

select set_config('request.jwt.claim.sub', '1a000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"1a000000-0000-0000-0000-000000000001","email":"seat-owner@example.invalid","role":"authenticated"}',
  true
);

do $$
declare denied boolean := false;
begin
  if (
    select count(*) from public.memberships
    where account_id = '2a000000-0000-0000-0000-000000000001' and active
  ) <> 5 then raise exception 'Invitation acceptance did not consume the reserved seat'; end if;

  begin
    update public.memberships
    set active = true
    where account_id = '2a000000-0000-0000-0000-000000000001'
      and user_id = '1a000000-0000-0000-0000-000000000005';
  exception when others then
    denied := position('Plan user limit reached' in sqlerrm) > 0;
  end;
  if not denied then raise exception 'Starter allowed a sixth active member'; end if;
end $$;

reset role;
update public.account_subscriptions
set plan_slug = 'growth'
where account_id = '2a000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', '1a000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"1a000000-0000-0000-0000-000000000001","email":"seat-owner@example.invalid","role":"authenticated"}',
  true
);

update public.memberships
set active = true
where account_id = '2a000000-0000-0000-0000-000000000001'
  and user_id = '1a000000-0000-0000-0000-000000000005';

do $$ begin
  if (
    select count(*) from public.memberships
    where account_id = '2a000000-0000-0000-0000-000000000001' and active
  ) <> 6 then raise exception 'Growth did not permit a sixth active member'; end if;
  if not public.has_account_entitlement('2a000000-0000-0000-0000-000000000001', 'lead_engine') then
    raise exception 'Growth lead engine entitlement is missing';
  end if;
  if public.has_account_entitlement('2a000000-0000-0000-0000-000000000001', 'ai_receptionist') then
    raise exception 'Growth unexpectedly received AI receptionist access';
  end if;
end $$;

reset role;
rollback;
select 'bontraco_plan_seat_limits_passed' as result;
