-- Repeatable subscription visibility and entitlement check. Fixtures always roll back.
begin;

insert into auth.users (id, email, aud, role, created_at, updated_at) values
  ('13000000-0000-0000-0000-000000000001', 'billing-owner@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('13000000-0000-0000-0000-000000000002', 'billing-sales@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('13000000-0000-0000-0000-000000000003', 'billing-outsider@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('13000000-0000-0000-0000-000000000005', 'billing-trial@example.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.accounts (id, name, slug, trades, created_by) values
  ('23000000-0000-0000-0000-000000000001', 'Billing Test One', 'bontraco-billing-one', array['roofing']::public.bontraco_trade[], '13000000-0000-0000-0000-000000000001'),
  ('23000000-0000-0000-0000-000000000002', 'Billing Test Two', 'bontraco-billing-two', array['plumbing']::public.bontraco_trade[], '13000000-0000-0000-0000-000000000003');

insert into public.memberships (account_id, user_id, role, display_name, email) values
  ('23000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001', 'owner', 'Billing Owner', 'billing-owner@example.invalid'),
  ('23000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000002', 'sales', 'Billing Sales', 'billing-sales@example.invalid'),
  ('23000000-0000-0000-0000-000000000002', '13000000-0000-0000-0000-000000000003', 'owner', 'Billing Outsider', 'billing-outsider@example.invalid');

insert into public.account_subscriptions (account_id, plan_slug, status)
values ('23000000-0000-0000-0000-000000000001', 'pro', 'active');
update public.account_subscriptions
set status = 'past_due'
where account_id = '23000000-0000-0000-0000-000000000001';
do $$ begin
  if not exists (
    select 1 from public.account_subscriptions
    where account_id = '23000000-0000-0000-0000-000000000001'
      and past_due_since is not null
      and grace_ends_at between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour'
  ) then raise exception 'Past-due transition did not establish a seven-day grace period'; end if;
end $$;
insert into public.billing_webhook_events (stripe_event_id, event_type, processing_status)
values ('evt_bontraco_rls_test', 'customer.subscription.updated', 'processed');

set local role authenticated;
select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000005', true);
select public.create_bontraco_account('Trial Test Company', 'bontraco-trial-atomic', 'electrical');
do $$ begin
  if not exists (
    select 1 from public.account_subscriptions s join public.accounts a on a.id = s.account_id
    where a.slug = 'bontraco-trial-atomic' and s.plan_slug = 'pro' and s.status = 'trialing'
      and s.trial_ends_at > now() + interval '13 days'
  ) then raise exception 'Atomic onboarding did not create the Pro trial'; end if;
end $$;

select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000001', true);
do $$ begin
  if (select count(*) from public.account_subscriptions) <> 1 then raise exception 'Owner cannot read subscription'; end if;
  if not public.has_account_entitlement('23000000-0000-0000-0000-000000000001', 'ai_receptionist') then raise exception 'Past-due Pro entitlement missing during grace period'; end if;
end $$;

select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000002', true);
do $$ begin
  if (select count(*) from public.account_subscriptions) <> 0 then raise exception 'Sales role read billing details'; end if;
  if not public.has_account_entitlement('23000000-0000-0000-0000-000000000001', 'lead_engine') then raise exception 'Member entitlement check failed'; end if;
end $$;

reset role;
update public.account_subscriptions
set past_due_since = now() - interval '8 days', grace_ends_at = now() - interval '1 day'
where account_id = '23000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000002', true);
do $$ begin
  if public.has_account_entitlement('23000000-0000-0000-0000-000000000001', 'core_crm') then
    raise exception 'Expired grace period retained CRM entitlement';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000003', true);
do $$
declare denied boolean := false;
begin
  if public.has_account_entitlement('23000000-0000-0000-0000-000000000001', 'core_crm') then raise exception 'Cross-tenant entitlement exposed'; end if;
  begin perform * from public.billing_webhook_events; exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Webhook event ledger exposed to a user'; end if;
end $$;

reset role;
rollback;
select 'bontraco_billing_rls_passed' as result;
