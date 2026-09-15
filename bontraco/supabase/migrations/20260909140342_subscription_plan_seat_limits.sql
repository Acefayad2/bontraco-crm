-- Database-driven plan metadata and concurrency-safe workspace seat limits.

create table public.subscription_plans (
  slug text primary key check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  display_name text not null unique check (char_length(btrim(display_name)) between 2 and 60),
  summary text not null check (char_length(btrim(summary)) between 10 and 240),
  monthly_price_cents integer not null check (monthly_price_cents >= 0),
  included_users smallint not null check (included_users between 1 and 10000),
  entitlements text[] not null check (
    cardinality(entitlements) > 0
    and entitlements <@ array[
      'core_crm',
      'lead_engine',
      'ai_receptionist',
      'advanced_reporting'
    ]::text[]
  ),
  sort_order smallint not null unique check (sort_order >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.subscription_plans (
  slug,
  display_name,
  summary,
  monthly_price_cents,
  included_users,
  entitlements,
  sort_order
) values
  (
    'starter',
    'Starter',
    'CRM, jobs, estimates, invoices, and basic reporting.',
    29900,
    5,
    array['core_crm'],
    10
  ),
  (
    'growth',
    'Growth',
    'Starter plus lead generation and advanced reporting.',
    49900,
    10,
    array['core_crm', 'lead_engine', 'advanced_reporting'],
    20
  ),
  (
    'pro',
    'AI Pro',
    'Growth plus the AI receptionist and calling tools.',
    89900,
    10,
    array['core_crm', 'lead_engine', 'ai_receptionist', 'advanced_reporting'],
    30
  );

create trigger subscription_plans_touch_updated_at
before update on public.subscription_plans
for each row execute function public.touch_updated_at();

alter table public.subscription_plans enable row level security;

create policy subscription_plans_select_active
on public.subscription_plans for select to authenticated
using (active);

revoke all on public.subscription_plans from anon, authenticated;
grant select on public.subscription_plans to authenticated;

alter table public.account_subscriptions
  drop constraint account_subscriptions_plan_slug_check,
  add constraint account_subscriptions_plan_slug_fkey
    foreign key (plan_slug) references public.subscription_plans(slug);

create index if not exists account_subscriptions_plan_slug_idx
on public.account_subscriptions(plan_slug);

create or replace function public.has_account_entitlement(target_account_id uuid, entitlement text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_account_member(target_account_id)
    and exists (
      select 1
      from public.account_subscriptions s
      join public.subscription_plans p on p.slug = s.plan_slug
      where s.account_id = target_account_id
        and (
          s.status in ('trialing', 'active')
          or (s.status = 'past_due' and s.grace_ends_at > now())
        )
        and entitlement = any(p.entitlements)
    );
$$;

revoke all on function public.has_account_entitlement(uuid, text) from public, anon;
grant execute on function public.has_account_entitlement(uuid, text) to authenticated;

-- Memberships may only be created through trusted onboarding and invitation RPCs.
-- This closes the direct-insert path that could race a plan limit check.
drop policy if exists memberships_insert_admin on public.memberships;

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
  -- Database migrations and trusted service jobs do not carry an end-user UUID.
  -- User-originated writes do, and are serialized per workspace below.
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

create trigger invitations_enforce_seat_limit
before insert on public.invitations
for each row execute function private.enforce_bontraco_seat_limit();

create trigger memberships_enforce_seat_limit_on_reactivation
before update of active on public.memberships
for each row execute function private.enforce_bontraco_seat_limit();

create or replace function public.accept_bontraco_invitation(raw_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_invitation public.invitations%rowtype;
  authenticated_email text;
  seat_limit integer;
  active_members integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  authenticated_email := lower(coalesce((select auth.jwt() ->> 'email'), ''));

  select * into matched_invitation
  from public.invitations
  where token_digest = encode(extensions.digest(raw_token, 'sha256'), 'hex')
    and accepted_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Invitation is invalid or expired';
  end if;

  if authenticated_email = '' or authenticated_email <> matched_invitation.email then
    raise exception 'Sign in with the email address that received this invitation';
  end if;

  if exists (
    select 1 from public.memberships
    where user_id = (select auth.uid()) and active
  ) then
    raise exception 'User already belongs to an active Bontraco account';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(matched_invitation.account_id::text, 0)
  );

  select p.included_users into seat_limit
  from public.account_subscriptions s
  join public.subscription_plans p on p.slug = s.plan_slug
  where s.account_id = matched_invitation.account_id
    and p.active
    and (
      s.status in ('trialing', 'active')
      or (s.status = 'past_due' and s.grace_ends_at > now())
    );

  if seat_limit is null then
    raise exception 'Active subscription required before accepting invitations';
  end if;

  select count(*) into active_members
  from public.memberships
  where account_id = matched_invitation.account_id and active;

  if active_members >= seat_limit then
    raise exception 'Plan user limit reached (% seats)', seat_limit;
  end if;

  update public.invitations
  set accepted_at = now()
  where id = matched_invitation.id;

  insert into public.memberships (account_id, user_id, role, display_name)
  values (
    matched_invitation.account_id,
    (select auth.uid()),
    matched_invitation.role,
    nullif(trim(coalesce((select auth.jwt() -> 'user_metadata' ->> 'full_name'), '')), '')
  );

  return matched_invitation.account_id;
end;
$$;

revoke all on function public.accept_bontraco_invitation(text) from public, anon;
grant execute on function public.accept_bontraco_invitation(text) to authenticated;
