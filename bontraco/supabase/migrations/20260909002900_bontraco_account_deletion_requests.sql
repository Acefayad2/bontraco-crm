-- Recoverable, owner-only account deletion requests. Physical purge is a separate gated operation.

create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  requested_by uuid not null,
  status text not null default 'pending'
    check (status in ('pending', 'cancelled', 'approved', 'processing', 'completed', 'failed')),
  requested_at timestamptz not null default now(),
  scheduled_for timestamptz not null default (now() + interval '14 days'),
  cancelled_at timestamptz,
  completed_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index account_deletion_requests_active_idx
  on public.account_deletion_requests (account_id)
  where status in ('pending', 'approved', 'processing');
create index account_deletion_requests_due_idx
  on public.account_deletion_requests (status, scheduled_for)
  where status in ('pending', 'approved');
create index account_deletion_requests_requested_by_idx
  on public.account_deletion_requests (requested_by);

create trigger account_deletion_requests_touch_updated_at
before update on public.account_deletion_requests
for each row execute function public.touch_updated_at();

alter table public.account_deletion_requests enable row level security;

create policy account_deletion_requests_select_owner
on public.account_deletion_requests for select to authenticated
using (public.has_account_role(account_id, array['owner']::public.bontraco_member_role[]));

grant select on public.account_deletion_requests to authenticated;
revoke all on public.account_deletion_requests from anon;

create or replace function public.request_bontraco_account_deletion(
  target_account_id uuid,
  confirmation_slug text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_slug text;
  deletion_time timestamptz;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not public.has_account_role(
    target_account_id,
    array['owner']::public.bontraco_member_role[]
  ) then raise exception 'Only the workspace owner can request deletion'; end if;

  select slug into expected_slug from public.accounts where id = target_account_id for update;
  if expected_slug is null then raise exception 'Workspace not found'; end if;
  if lower(trim(coalesce(confirmation_slug, ''))) <> lower(expected_slug) then
    raise exception 'Workspace confirmation does not match';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_account_id::text, 0));

  select scheduled_for into deletion_time
  from public.account_deletion_requests
  where account_id = target_account_id and status in ('pending', 'approved', 'processing')
  order by requested_at desc limit 1;
  if deletion_time is not null then return deletion_time; end if;

  deletion_time := now() + interval '14 days';
  insert into public.account_deletion_requests (
    account_id, requested_by, status, scheduled_for
  ) values (
    target_account_id, (select auth.uid()), 'pending', deletion_time
  );
  insert into public.activities (
    account_id, actor_id, kind, summary, metadata
  ) values (
    target_account_id,
    (select auth.uid()),
    'account_deletion_requested',
    'Workspace deletion requested',
    jsonb_build_object('scheduled_for', deletion_time)
  );
  return deletion_time;
end;
$$;

create or replace function public.cancel_bontraco_account_deletion(target_account_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not public.has_account_role(
    target_account_id,
    array['owner']::public.bontraco_member_role[]
  ) then raise exception 'Only the workspace owner can cancel deletion'; end if;

  update public.account_deletion_requests
  set status = 'cancelled', cancelled_at = now(), last_error = null
  where account_id = target_account_id and status = 'pending';
  get diagnostics changed = row_count;
  if changed > 0 then
    insert into public.activities (
      account_id, actor_id, kind, summary
    ) values (
      target_account_id, (select auth.uid()), 'account_deletion_cancelled',
      'Workspace deletion request cancelled'
    );
  end if;
  return changed > 0;
end;
$$;

revoke all on function public.request_bontraco_account_deletion(uuid, text) from public;
revoke all on function public.cancel_bontraco_account_deletion(uuid) from public;
revoke execute on function public.request_bontraco_account_deletion(uuid, text) from anon;
revoke execute on function public.cancel_bontraco_account_deletion(uuid) from anon;
grant execute on function public.request_bontraco_account_deletion(uuid, text) to authenticated;
grant execute on function public.cancel_bontraco_account_deletion(uuid) to authenticated;
