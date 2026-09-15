-- Keep team administration below the owner boundary and restrict mutable identity columns.

create or replace function public.can_manage_membership(
  target_account_id uuid,
  target_user_id uuid,
  target_role public.bontraco_member_role
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships actor
    where actor.account_id = target_account_id
      and actor.user_id = (select auth.uid())
      and actor.active
      and (
        (actor.role = 'owner' and target_role <> 'owner')
        or (
          actor.role = 'admin'
          and target_user_id <> (select auth.uid())
          and target_role in ('sales', 'dispatcher', 'field')
        )
      )
  );
$$;

revoke all on function public.can_manage_membership(uuid, uuid, public.bontraco_member_role)
  from public, anon;
grant execute on function public.can_manage_membership(uuid, uuid, public.bontraco_member_role)
  to authenticated;

drop policy if exists memberships_update_admin on public.memberships;
create policy memberships_update_manager
on public.memberships
for update
to authenticated
using (public.can_manage_membership(account_id, user_id, role))
with check (public.can_manage_membership(account_id, user_id, role));

-- The browser only needs to change access state and role. Account/user identity and
-- member profile fields remain immutable through the Data API.
revoke update on table public.memberships from authenticated;
grant update (role, active) on table public.memberships to authenticated;

drop policy if exists invitations_admin_all on public.invitations;

create policy invitations_manager_select
on public.invitations
for select
to authenticated
using (public.has_account_role(
  account_id,
  array['owner', 'admin']::public.bontraco_member_role[]
));

create policy invitations_manager_insert
on public.invitations
for insert
to authenticated
with check (
  invited_by = (select auth.uid())
  and (
    public.has_account_role(account_id, array['owner']::public.bontraco_member_role[])
    or (
      public.has_account_role(account_id, array['admin']::public.bontraco_member_role[])
      and role in ('sales', 'dispatcher', 'field')
    )
  )
);

create policy invitations_manager_delete
on public.invitations
for delete
to authenticated
using (public.has_account_role(
  account_id,
  array['owner', 'admin']::public.bontraco_member_role[]
));

revoke update on table public.invitations from authenticated;
