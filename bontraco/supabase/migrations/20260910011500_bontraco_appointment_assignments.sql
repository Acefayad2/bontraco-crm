-- Keep appointment assignment inside the workspace and prevent user-to-user reassignment.

alter table public.appointments
  add constraint appointments_account_assignee_fkey
  foreign key (account_id, assigned_to)
  references public.memberships(account_id, user_id)
  on delete set null (assigned_to);

create index appointments_account_assignee_idx
  on public.appointments (account_id, assigned_to, starts_at);

drop policy if exists appointments_update_assigned on public.appointments;

create policy appointments_update_authorized on public.appointments for update to authenticated
using (public.can_access_assigned_record(account_id, assigned_to))
with check (
  (
    public.has_account_role(
      account_id,
      array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[]
    )
    and (assigned_to is null or public.is_active_account_user(account_id, assigned_to))
  )
  or (
    public.has_account_role(
      account_id,
      array['sales', 'field']::public.bontraco_member_role[]
    )
    and assigned_to = (select auth.uid())
  )
);
