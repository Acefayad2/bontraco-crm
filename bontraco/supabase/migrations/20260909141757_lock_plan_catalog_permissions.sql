-- Supabase projects may have broad schema default privileges. Keep the public
-- product catalog readable, but never browser-writable.
revoke all on public.subscription_plans from anon, authenticated;
grant select on public.subscription_plans to authenticated;
