-- Keep task assignments tenant-safe and align task creation with Bontraco roles.

alter table public.tasks
  add constraint tasks_title_length_check
  check (char_length(btrim(title)) between 1 and 240),
  add constraint tasks_single_parent_check
  check (num_nonnulls(job_id, lead_id) <= 1),
  add constraint tasks_account_assignee_fkey
  foreign key (account_id, assigned_to)
  references public.memberships(account_id, user_id)
  on delete set null (assigned_to);

create index tasks_account_status_due_idx
  on public.tasks (account_id, completed_at, due_at);

drop policy if exists tasks_insert_member on public.tasks;
drop policy if exists tasks_update_assigned on public.tasks;

create policy tasks_insert_authorized on public.tasks for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (
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
  )
);

create policy tasks_update_authorized on public.tasks for update to authenticated
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
