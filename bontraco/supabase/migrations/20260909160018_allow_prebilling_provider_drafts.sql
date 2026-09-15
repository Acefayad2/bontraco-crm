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

  -- Pre-billing drafts cannot run, so a small recovery allowance carries no provider cost.
  profile_limit := coalesce(profile_limit, 5);

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
