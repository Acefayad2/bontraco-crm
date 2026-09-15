-- Allow office managers to route calls only to active call-authorized teammates.

create policy calls_update_assignment
on public.calls
for update
to authenticated
using (
  public.has_account_role(
    account_id,
    array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[]
  )
)
with check (
  public.has_account_role(
    account_id,
    array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[]
  )
  and (
    assigned_to is null
    or exists (
      select 1
      from public.memberships m
      where m.account_id = calls.account_id
        and m.user_id = calls.assigned_to
        and m.active
        and m.role in ('owner', 'admin', 'dispatcher', 'sales')
    )
  )
);

grant update (assigned_to) on table public.calls to authenticated;
