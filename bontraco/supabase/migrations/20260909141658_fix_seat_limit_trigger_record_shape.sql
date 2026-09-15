-- Trigger records only expose columns from their own table, so branch before
-- inspecting table-specific fields.
create or replace function private.enforce_bontraco_seat_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  seat_limit integer;
  occupied_seats integer;
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  if tg_table_name = 'memberships' then
    if not (old.active = false and new.active = true) then
      return new;
    end if;
  elsif tg_table_name = 'invitations' then
    if new.accepted_at is not null or new.expires_at <= now() then
      return new;
    end if;
  else
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.account_id::text, 0)
  );

  select p.included_users into seat_limit
  from public.account_subscriptions s
  join public.subscription_plans p on p.slug = s.plan_slug
  where s.account_id = new.account_id
    and p.active
    and (
      s.status in ('trialing', 'active')
      or (s.status = 'past_due' and s.grace_ends_at > now())
    );

  if seat_limit is null then
    raise exception 'Active subscription required before adding users';
  end if;

  select
    (select count(*) from public.memberships m
      where m.account_id = new.account_id and m.active)
    +
    (select count(*) from public.invitations i
      where i.account_id = new.account_id
        and i.accepted_at is null
        and i.expires_at > now())
  into occupied_seats;

  if occupied_seats >= seat_limit then
    raise exception 'Plan user limit reached (% seats)', seat_limit;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_bontraco_seat_limit() from public, anon, authenticated;
