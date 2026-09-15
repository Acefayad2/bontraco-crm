-- Authenticated users may acknowledge alerts but cannot rewrite their contents or ownership.

revoke update on table public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
