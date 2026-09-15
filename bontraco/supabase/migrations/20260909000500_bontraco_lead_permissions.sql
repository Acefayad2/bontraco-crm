-- Restrict lead creation and assignment to appropriate workspace roles.

create or replace function public.is_active_account_user(target_account_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.account_id = target_account_id
      and m.user_id = target_user_id
      and m.active
  );
$$;

revoke all on function public.is_active_account_user(uuid, uuid) from public;
revoke execute on function public.is_active_account_user(uuid, uuid) from anon;
grant execute on function public.is_active_account_user(uuid, uuid) to authenticated;

drop policy if exists leads_insert_member on public.leads;
drop policy if exists leads_update_assigned on public.leads;

create policy leads_insert_authorized on public.leads for insert to authenticated
with check (
  (
    public.has_account_role(account_id, array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[])
    and (assigned_to is null or public.is_active_account_user(account_id, assigned_to))
  )
  or (
    public.has_account_role(account_id, array['sales']::public.bontraco_member_role[])
    and assigned_to = (select auth.uid())
  )
);

create policy leads_update_authorized on public.leads for update to authenticated
using (public.can_access_assigned_record(account_id, assigned_to))
with check (
  (
    public.has_account_role(account_id, array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[])
    and (assigned_to is null or public.is_active_account_user(account_id, assigned_to))
  )
  or assigned_to = (select auth.uid())
);
