-- Repeatable lead-engine entitlement enforcement checks. Fixtures always roll back.

begin;

insert into auth.users (id, email, aud, role, created_at, updated_at)
values (
  '6c000000-0000-0000-0000-000000000001',
  'lead-entitlement-owner@example.invalid',
  'authenticated',
  'authenticated',
  now(),
  now()
);

insert into public.accounts (id, name, slug, trades, created_by)
values (
  '6d000000-0000-0000-0000-000000000001',
  'Lead Entitlement Test',
  'bontraco-lead-entitlement-test',
  array['roofing']::public.bontraco_trade[],
  '6c000000-0000-0000-0000-000000000001'
);

insert into public.memberships (account_id, user_id, role, display_name, email)
values (
  '6d000000-0000-0000-0000-000000000001',
  '6c000000-0000-0000-0000-000000000001',
  'owner',
  'Lead Entitlement Owner',
  'lead-entitlement-owner@example.invalid'
);

insert into public.account_subscriptions (account_id, plan_slug, status)
values ('6d000000-0000-0000-0000-000000000001', 'starter', 'active');

set local role authenticated;
select set_config('request.jwt.claim.sub', '6c000000-0000-0000-0000-000000000001', true);

insert into public.lead_source_profiles (
  account_id, name, provider, trades, search_terms, geography, allowed_domains, enabled, created_by
) values (
  '6d000000-0000-0000-0000-000000000001',
  'Disabled Starter search',
  'tavily',
  array['roofing']::public.bontraco_trade[],
  array['roof leak'],
  '{"city":"Chicago","region":"IL"}'::jsonb,
  array['reddit.com'],
  false,
  '6c000000-0000-0000-0000-000000000001'
);

do $$
declare denied boolean := false;
begin
  begin
    update public.lead_source_profiles
    set enabled = true
    where account_id = '6d000000-0000-0000-0000-000000000001';
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Starter owner enabled automated lead scanning'; end if;
end $$;

reset role;
update public.account_subscriptions
set plan_slug = 'growth'
where account_id = '6d000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', '6c000000-0000-0000-0000-000000000001', true);
update public.lead_source_profiles
set enabled = true
where account_id = '6d000000-0000-0000-0000-000000000001';

do $$ begin
  if not exists (
    select 1 from public.lead_source_profiles
    where account_id = '6d000000-0000-0000-0000-000000000001' and enabled
  ) then raise exception 'Growth owner could not enable automated lead scanning'; end if;
end $$;

reset role;
update public.account_subscriptions
set status = 'canceled'
where account_id = '6d000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', '6c000000-0000-0000-0000-000000000001', true);
update public.lead_source_profiles
set enabled = false
where account_id = '6d000000-0000-0000-0000-000000000001';

do $$ begin
  if exists (
    select 1 from public.lead_source_profiles
    where account_id = '6d000000-0000-0000-0000-000000000001' and enabled
  ) then raise exception 'Inactive subscriber could not disable automated lead scanning'; end if;
end $$;

reset role;
rollback;
select 'bontraco_lead_engine_entitlement_rls_passed' as result;
