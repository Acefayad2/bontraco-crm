alter table public.account_subscriptions
  add column past_due_since timestamptz,
  add column grace_ends_at timestamptz;

update public.account_subscriptions
set past_due_since = coalesce(updated_at, now()),
    grace_ends_at = coalesce(updated_at, now()) + interval '7 days'
where status = 'past_due';

alter table public.account_subscriptions
  add constraint account_subscriptions_grace_state_valid check (
    (status = 'past_due' and past_due_since is not null and grace_ends_at > past_due_since)
    or (status <> 'past_due' and past_due_since is null and grace_ends_at is null)
  );

create or replace function public.set_bontraco_billing_grace_period()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'past_due' then
    if tg_op = 'INSERT' or old.status <> 'past_due' or old.past_due_since is null then
      new.past_due_since := now();
      new.grace_ends_at := now() + interval '7 days';
    else
      new.past_due_since := old.past_due_since;
      new.grace_ends_at := old.grace_ends_at;
    end if;
  else
    new.past_due_since := null;
    new.grace_ends_at := null;
  end if;
  return new;
end;
$$;

create trigger account_subscriptions_set_grace_period
before insert or update of status on public.account_subscriptions
for each row execute function public.set_bontraco_billing_grace_period();

revoke all on function public.set_bontraco_billing_grace_period() from public, anon, authenticated;

create or replace function public.has_account_entitlement(target_account_id uuid, entitlement text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_account_member(target_account_id)
    and exists (
      select 1 from public.account_subscriptions s
      where s.account_id = target_account_id
        and (
          s.status in ('trialing', 'active')
          or (s.status = 'past_due' and s.grace_ends_at > now())
        )
        and (
          entitlement = 'core_crm'
          or (entitlement = 'lead_engine' and s.plan_slug in ('growth', 'pro'))
          or (entitlement = 'ai_receptionist' and s.plan_slug = 'pro')
          or (entitlement = 'advanced_reporting' and s.plan_slug = 'pro')
        )
    );
$$;

revoke all on function public.has_account_entitlement(uuid, text) from public, anon;
grant execute on function public.has_account_entitlement(uuid, text) to authenticated;
