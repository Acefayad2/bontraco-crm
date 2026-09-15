-- Claim Stripe events atomically so concurrent deliveries cannot both apply state.
create or replace function public.claim_billing_webhook(target_event_id text, target_event_type text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare affected_rows integer := 0;
begin
  insert into public.billing_webhook_events (stripe_event_id, event_type, processing_status, attempts)
  values (target_event_id, target_event_type, 'processing', 1)
  on conflict (stripe_event_id) do nothing;
  get diagnostics affected_rows = row_count;
  if affected_rows > 0 then return true; end if;

  update public.billing_webhook_events
  set processing_status = 'processing', attempts = attempts + 1, last_error = null
  where stripe_event_id = target_event_id and processing_status = 'failed';
  get diagnostics affected_rows = row_count;
  return affected_rows > 0;
end;
$$;
revoke all on function public.claim_billing_webhook(text, text) from public, anon, authenticated;
grant execute on function public.claim_billing_webhook(text, text) to service_role;
