-- Repeatable owner/admin team-management boundary checks. Fixtures always roll back.
begin;

insert into auth.users (id,email,aud,role,created_at,updated_at) values
('1e000000-0000-0000-0000-000000000001','team-owner@example.invalid','authenticated','authenticated',now(),now()),
('1e000000-0000-0000-0000-000000000002','team-admin@example.invalid','authenticated','authenticated',now(),now()),
('1e000000-0000-0000-0000-000000000003','team-sales@example.invalid','authenticated','authenticated',now(),now()),
('1e000000-0000-0000-0000-000000000004','team-field@example.invalid','authenticated','authenticated',now(),now()),
('1e000000-0000-0000-0000-000000000005','team-outside@example.invalid','authenticated','authenticated',now(),now());

insert into public.accounts (id,name,slug,trades,created_by) values
('2e000000-0000-0000-0000-000000000001','Team Management One','bontraco-team-management-one',array['roofing']::public.bontraco_trade[],'1e000000-0000-0000-0000-000000000001'),
('2e000000-0000-0000-0000-000000000002','Team Management Two','bontraco-team-management-two',array['plumbing']::public.bontraco_trade[],'1e000000-0000-0000-0000-000000000005');

insert into public.memberships (account_id,user_id,role,display_name,email) values
('2e000000-0000-0000-0000-000000000001','1e000000-0000-0000-0000-000000000001','owner','Team Owner','team-owner@example.invalid'),
('2e000000-0000-0000-0000-000000000001','1e000000-0000-0000-0000-000000000002','admin','Team Admin','team-admin@example.invalid'),
('2e000000-0000-0000-0000-000000000001','1e000000-0000-0000-0000-000000000003','sales','Team Sales','team-sales@example.invalid'),
('2e000000-0000-0000-0000-000000000001','1e000000-0000-0000-0000-000000000004','field','Team Field','team-field@example.invalid'),
('2e000000-0000-0000-0000-000000000002','1e000000-0000-0000-0000-000000000005','owner','Team Outside','team-outside@example.invalid');

insert into public.account_subscriptions (account_id,plan_slug,status) values
('2e000000-0000-0000-0000-000000000001','growth','active'),
('2e000000-0000-0000-0000-000000000002','growth','active');

set local role authenticated;
select set_config('request.jwt.claim.sub','1e000000-0000-0000-0000-000000000002',true);

update public.memberships
set active = false
where account_id = '2e000000-0000-0000-0000-000000000001'
  and user_id = '1e000000-0000-0000-0000-000000000003';

do $$
declare denied boolean := false;
begin
  if (select active from public.memberships where account_id = '2e000000-0000-0000-0000-000000000001' and user_id = '1e000000-0000-0000-0000-000000000003') then
    raise exception 'Admin could not deactivate staff';
  end if;

  begin
    update public.memberships
    set active = false
    where account_id = '2e000000-0000-0000-0000-000000000001'
      and user_id = '1e000000-0000-0000-0000-000000000002';
  exception when others then denied := true;
  end;
  if not denied and exists (
    select 1 from public.memberships
    where account_id = '2e000000-0000-0000-0000-000000000001'
      and user_id = '1e000000-0000-0000-0000-000000000002'
      and not active
  ) then raise exception 'Admin deactivated self'; end if;

  denied := false;
  begin
    update public.memberships
    set role = 'sales'
    where account_id = '2e000000-0000-0000-0000-000000000001'
      and user_id = '1e000000-0000-0000-0000-000000000001';
  exception when others then denied := true;
  end;
  if not denied and exists (
    select 1 from public.memberships
    where account_id = '2e000000-0000-0000-0000-000000000001'
      and user_id = '1e000000-0000-0000-0000-000000000001'
      and role <> 'owner'
  ) then raise exception 'Admin changed owner role'; end if;

  denied := false;
  begin
    update public.memberships
    set role = 'sales'
    where account_id = '2e000000-0000-0000-0000-000000000001'
      and user_id = '1e000000-0000-0000-0000-000000000002';
  exception when others then denied := true;
  end;
  if not denied and exists (
    select 1 from public.memberships
    where account_id = '2e000000-0000-0000-0000-000000000001'
      and user_id = '1e000000-0000-0000-0000-000000000002'
      and role <> 'admin'
  ) then raise exception 'Admin changed own role'; end if;

  denied := false;
  begin
    update public.memberships
    set email = 'rewritten@example.invalid'
    where account_id = '2e000000-0000-0000-0000-000000000001'
      and user_id = '1e000000-0000-0000-0000-000000000003';
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Admin rewrote immutable member identity'; end if;
end $$;

insert into public.invitations (account_id,email,role,token_digest,invited_by,expires_at)
values (
  '2e000000-0000-0000-0000-000000000001',
  'team-field-invite@example.invalid',
  'field',
  encode(extensions.digest('team-field-invite-token','sha256'),'hex'),
  '1e000000-0000-0000-0000-000000000002',
  now() + interval '7 days'
);

do $$
declare denied boolean := false;
begin
  begin
    insert into public.invitations (account_id,email,role,token_digest,invited_by,expires_at)
    values (
      '2e000000-0000-0000-0000-000000000001',
      'team-admin-invite@example.invalid',
      'admin',
      encode(extensions.digest('team-admin-invite-token','sha256'),'hex'),
      '1e000000-0000-0000-0000-000000000002',
      now() + interval '7 days'
    );
  exception when others then denied := true;
  end;
  if not denied then raise exception 'Admin invited another admin'; end if;
end $$;

select set_config('request.jwt.claim.sub','1e000000-0000-0000-0000-000000000001',true);

update public.memberships
set active = true, role = 'dispatcher'
where account_id = '2e000000-0000-0000-0000-000000000001'
  and user_id = '1e000000-0000-0000-0000-000000000003';

update public.memberships
set role = 'admin'
where account_id = '2e000000-0000-0000-0000-000000000001'
  and user_id = '1e000000-0000-0000-0000-000000000004';

do $$ begin
  if not exists (
    select 1 from public.memberships
    where account_id = '2e000000-0000-0000-0000-000000000001'
      and user_id = '1e000000-0000-0000-0000-000000000003'
      and role = 'dispatcher' and active
  ) then raise exception 'Owner could not reactivate and change staff role'; end if;
  if not exists (
    select 1 from public.memberships
    where account_id = '2e000000-0000-0000-0000-000000000001'
      and user_id = '1e000000-0000-0000-0000-000000000004'
      and role = 'admin'
  ) then raise exception 'Owner could not promote an admin'; end if;
  if (select count(*) from public.activities where kind = 'team_access_changed') <> 2 then
    raise exception 'Team access changes were not audited exactly once';
  end if;
  if (select count(*) from public.activities where kind = 'team_role_changed') <> 2 then
    raise exception 'Team role changes were not audited exactly once';
  end if;
end $$;

select set_config('request.jwt.claim.sub','1e000000-0000-0000-0000-000000000003',true);
do $$ begin
  if exists (select 1 from public.activities where kind like 'team_%') then
    raise exception 'Dispatcher could see manager-private team activity';
  end if;
end $$;

select set_config('request.jwt.claim.sub','1e000000-0000-0000-0000-000000000005',true);
do $$ begin
  if exists (select 1 from public.activities where kind like 'team_%') then
    raise exception 'Outside tenant could see team activity';
  end if;
end $$;

reset role;
rollback;
select 'bontraco_team_management_rls_passed' as result;
