-- Give every workspace an explicit trial and make future onboarding atomic with billing state.

insert into public.account_subscriptions (account_id, plan_slug, status, trial_ends_at, current_period_ends_at)
select a.id, 'pro', 'trialing', now() + interval '14 days', now() + interval '14 days'
from public.accounts a
where not exists (select 1 from public.account_subscriptions s where s.account_id = a.id);

create or replace function public.create_bontraco_account(
  account_name text,
  account_slug text,
  primary_trade public.bontraco_trade default 'roofing'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_account_id uuid;
  normalized_slug text;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if exists (select 1 from public.memberships where user_id = (select auth.uid()) and active) then
    raise exception 'User already belongs to an active Bontraco account';
  end if;
  normalized_slug := lower(trim(account_slug));
  if normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'Invalid account slug'; end if;

  insert into public.accounts (name, slug, trades, created_by)
  values (trim(account_name), normalized_slug, array[primary_trade], (select auth.uid()))
  returning id into new_account_id;

  insert into public.memberships (account_id, user_id, role, display_name)
  values (new_account_id, (select auth.uid()), 'owner', nullif(trim(coalesce((select auth.jwt() -> 'user_metadata' ->> 'full_name'), '')), ''));

  insert into public.account_subscriptions (account_id, plan_slug, status, trial_ends_at, current_period_ends_at)
  values (new_account_id, 'pro', 'trialing', now() + interval '14 days', now() + interval '14 days');

  return new_account_id;
end;
$$;

revoke all on function public.create_bontraco_account(text, text, public.bontraco_trade) from public;
revoke execute on function public.create_bontraco_account(text, text, public.bontraco_trade) from anon;
grant execute on function public.create_bontraco_account(text, text, public.bontraco_trade) to authenticated;
