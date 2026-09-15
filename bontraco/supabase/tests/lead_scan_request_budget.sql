-- Repeatable provider-request budget constraints. Fixtures always roll back.

begin;

insert into auth.users (id, email, aud, role, created_at, updated_at)
values (
  '8a000000-0000-4000-8000-000000000001',
  'lead-budget-owner@example.invalid',
  'authenticated',
  'authenticated',
  now(),
  now()
);

insert into public.accounts (id, name, slug, trades, created_by)
values (
  '8b000000-0000-4000-8000-000000000001',
  'Lead Request Budget Test',
  'bontraco-lead-request-budget-test',
  array['roofing']::public.bontraco_trade[],
  '8a000000-0000-4000-8000-000000000001'
);

insert into public.memberships (account_id, user_id, role, display_name, email)
values (
  '8b000000-0000-4000-8000-000000000001',
  '8a000000-0000-4000-8000-000000000001',
  'owner',
  'Lead Budget Owner',
  'lead-budget-owner@example.invalid'
);

insert into public.account_subscriptions (account_id, plan_slug, status)
values ('8b000000-0000-4000-8000-000000000001', 'growth', 'active');

insert into public.lead_source_profiles (
  account_id, name, provider, trades, search_terms, geography, allowed_domains, created_by
) values (
  '8b000000-0000-4000-8000-000000000001',
  'Budgeted public search',
  'tavily',
  array['roofing']::public.bontraco_trade[],
  array['roof leak'],
  '{"city":"Chicago","region":"IL"}'::jsonb,
  array['reddit.com'],
  '8a000000-0000-4000-8000-000000000001'
);

do $$
begin
  if (
    select daily_request_limit
    from public.lead_source_profiles
    where account_id = '8b000000-0000-4000-8000-000000000001'
  ) <> 96 then
    raise exception 'Lead profile did not receive the safe daily request default';
  end if;
end $$;

do $$
begin
  if (select included_lead_profiles from public.subscription_plans where slug = 'starter') <> 1
    or (select included_lead_profiles from public.subscription_plans where slug = 'growth') <> 3
    or (select included_lead_profiles from public.subscription_plans where slug = 'pro') <> 5
  then
    raise exception 'Lead profile plan limits do not match the product catalog';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '8a000000-0000-4000-8000-000000000001', true);

do $$
declare denied boolean := false;
begin
  begin
    update public.lead_source_profiles
    set daily_request_limit = 0
    where account_id = '8b000000-0000-4000-8000-000000000001';
  exception when check_violation then
    denied := true;
  end;
  if not denied then
    raise exception 'Lead profile accepted a zero provider-request budget';
  end if;
end $$;

do $$
declare denied boolean := false;
begin
  begin
    update public.lead_source_profiles
    set daily_request_limit = 97
    where account_id = '8b000000-0000-4000-8000-000000000001';
  exception when check_violation then
    denied := true;
  end;
  if not denied then
    raise exception 'Lead profile accepted an excessive provider-request budget';
  end if;
end $$;

insert into public.lead_source_profiles (
  account_id, name, provider, trades, search_terms, geography, allowed_domains, created_by
) values
(
  '8b000000-0000-4000-8000-000000000001',
  'Second budgeted search',
  'tavily',
  array['roofing']::public.bontraco_trade[],
  array['storm damage'],
  '{"city":"Chicago","region":"IL"}'::jsonb,
  array['patch.com'],
  '8a000000-0000-4000-8000-000000000001'
),
(
  '8b000000-0000-4000-8000-000000000001',
  'Third budgeted search',
  'google_places',
  array['roofing']::public.bontraco_trade[],
  array['property management company'],
  '{"city":"Chicago","region":"IL"}'::jsonb,
  array[]::text[],
  '8a000000-0000-4000-8000-000000000001'
);

do $$
declare denied boolean := false;
begin
  begin
    insert into public.lead_source_profiles (
      account_id, name, provider, trades, search_terms, geography, allowed_domains, created_by
    ) values (
      '8b000000-0000-4000-8000-000000000001',
      'Fourth over-limit search',
      'tavily',
      array['roofing']::public.bontraco_trade[],
      array['roof replacement'],
      '{"city":"Chicago","region":"IL"}'::jsonb,
      array['reddit.com'],
      '8a000000-0000-4000-8000-000000000001'
    );
  exception when raise_exception then
    denied := true;
  end;
  if not denied then
    raise exception 'Growth plan accepted more than three lead profiles';
  end if;
end $$;

rollback;
select 'bontraco_lead_scan_request_budget_passed' as result;
