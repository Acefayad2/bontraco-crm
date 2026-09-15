-- Stripe-backed subscription state and member-safe entitlement checks.

create table public.account_subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.accounts(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan_slug text not null default 'starter' check (plan_slug in ('starter', 'growth', 'pro')),
  status text not null default 'incomplete' check (status in ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused')),
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.billing_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  processing_status text not null default 'processing' check (processing_status in ('processing', 'processed', 'failed')),
  attempts integer not null default 1 check (attempts > 0),
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index billing_webhook_events_status_idx on public.billing_webhook_events (processing_status, updated_at);

create trigger account_subscriptions_touch_updated_at before update on public.account_subscriptions
for each row execute function public.touch_updated_at();
create trigger billing_webhook_events_touch_updated_at before update on public.billing_webhook_events
for each row execute function public.touch_updated_at();

alter table public.account_subscriptions enable row level security;
alter table public.billing_webhook_events enable row level security;

create policy subscriptions_select_admin on public.account_subscriptions for select to authenticated
using (public.has_account_role(account_id, array['owner','admin']::public.bontraco_member_role[]));

grant select on public.account_subscriptions to authenticated;
revoke all on public.account_subscriptions, public.billing_webhook_events from anon;
revoke all on public.billing_webhook_events from authenticated;

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
        and s.status in ('trialing', 'active')
        and (
          entitlement = 'core_crm'
          or (entitlement = 'lead_engine' and s.plan_slug in ('growth', 'pro'))
          or (entitlement = 'ai_receptionist' and s.plan_slug = 'pro')
          or (entitlement = 'advanced_reporting' and s.plan_slug = 'pro')
        )
    );
$$;

revoke all on function public.has_account_entitlement(uuid, text) from public;
revoke execute on function public.has_account_entitlement(uuid, text) from anon;
grant execute on function public.has_account_entitlement(uuid, text) to authenticated;
