alter table public.lead_source_profiles
  drop constraint lead_source_profiles_daily_request_limit_check,
  add constraint lead_source_profiles_daily_request_limit_check
    check (daily_request_limit between 1 and 96);

alter table public.subscription_plans
  add column included_lead_profiles smallint not null default 0
    check (included_lead_profiles between 0 and 100);

update public.subscription_plans
set included_lead_profiles = case slug
  when 'growth' then 3
  when 'pro' then 5
  else 0
end;

create or replace function private.enforce_bontraco_lead_profile_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_limit integer;
  existing_profiles integer;
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('lead-profiles:' || new.account_id::text, 0)
  );

  select p.included_lead_profiles into profile_limit
  from public.account_subscriptions s
  join public.subscription_plans p on p.slug = s.plan_slug
  where s.account_id = new.account_id
    and p.active
    and (
      s.status in ('trialing', 'active')
      or (s.status = 'past_due' and s.grace_ends_at > now())
    );

  if profile_limit is null or profile_limit = 0 then
    raise exception 'An active Growth or Pro plan is required for lead search profiles';
  end if;

  select count(*) into existing_profiles
  from public.lead_source_profiles
  where account_id = new.account_id;

  if existing_profiles >= profile_limit then
    raise exception 'Plan lead-profile limit reached (% profiles)', profile_limit;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_bontraco_lead_profile_limit()
from public, anon, authenticated;

create trigger lead_source_profiles_enforce_plan_limit
before insert on public.lead_source_profiles
for each row execute function private.enforce_bontraco_lead_profile_limit();
