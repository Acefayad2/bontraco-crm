-- Escalate urgent calls and subscription problems without weakening record visibility.

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('new_lead', 'urgent_call', 'appointment_booked', 'billing_issue', 'system'));

create unique index notifications_call_kind_unique
  on public.notifications (account_id, call_id, kind)
  where call_id is not null;

create or replace function public.notify_urgent_call()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.emergency_flag and (tg_op = 'INSERT' or not coalesce(old.emergency_flag, false)) then
    insert into public.notifications (
      account_id, user_id, call_id, kind, title, body, metadata
    ) values (
      new.account_id,
      new.assigned_to,
      new.id,
      'urgent_call',
      'Urgent caller needs attention',
      coalesce(new.caller_name, new.from_number, 'Unknown caller') ||
        case when new.summary is null then '' else ': ' || left(new.summary, 280) end,
      jsonb_build_object('provider', new.provider, 'disposition', new.disposition)
    )
    on conflict (account_id, call_id, kind) where call_id is not null do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.notify_urgent_call() from public;
revoke execute on function public.notify_urgent_call() from anon, authenticated;

create trigger calls_create_urgent_notification
after insert or update of emergency_flag on public.calls
for each row execute function public.notify_urgent_call();

create or replace function public.notify_billing_issue()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('past_due', 'unpaid', 'incomplete_expired')
    and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.notifications (
      account_id, kind, title, body, metadata
    ) values (
      new.account_id,
      'billing_issue',
      'Billing action required',
      'Your Bontraco subscription is ' || replace(new.status, '_', ' ') ||
        '. Update payment details to prevent service interruption.',
      jsonb_build_object('subscription_status', new.status, 'plan', new.plan_slug)
    );
  end if;
  return new;
end;
$$;

revoke all on function public.notify_billing_issue() from public;
revoke execute on function public.notify_billing_issue() from anon, authenticated;

create trigger subscriptions_create_billing_notification
after insert or update of status on public.account_subscriptions
for each row execute function public.notify_billing_issue();
