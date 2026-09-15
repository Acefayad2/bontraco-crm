-- Repeatable atomic Stripe webhook claim/retry check. Fixtures always roll back.
begin;
do $$ begin
  if not public.claim_billing_webhook('evt_atomic_replay_test', 'customer.subscription.updated') then
    raise exception 'First webhook delivery was not claimed';
  end if;
  if public.claim_billing_webhook('evt_atomic_replay_test', 'customer.subscription.updated') then
    raise exception 'Concurrent webhook delivery was claimed twice';
  end if;
  update public.billing_webhook_events set processing_status = 'failed' where stripe_event_id = 'evt_atomic_replay_test';
  if not public.claim_billing_webhook('evt_atomic_replay_test', 'customer.subscription.updated') then
    raise exception 'Failed webhook was not retryable';
  end if;
  if public.claim_billing_webhook('evt_atomic_replay_test', 'customer.subscription.updated') then
    raise exception 'Retrying webhook was claimed twice';
  end if;
  if (select attempts from public.billing_webhook_events where stripe_event_id = 'evt_atomic_replay_test') <> 2 then
    raise exception 'Webhook attempt count is incorrect';
  end if;
end $$;
rollback;
select 'bontraco_webhook_replay_passed' as result;
