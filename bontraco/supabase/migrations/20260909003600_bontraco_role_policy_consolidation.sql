-- Consolidate role policies and keep field access read-only outside assigned field work.

drop policy if exists contacts_insert_office on public.contacts;
drop policy if exists leads_insert_office on public.leads;
drop policy if exists jobs_insert_office on public.jobs;

drop policy if exists contacts_update_authorized on public.contacts;
create policy contacts_update_office on public.contacts for update to authenticated
using (
  public.has_account_role(
    account_id,
    array['owner', 'admin', 'dispatcher', 'sales']::public.bontraco_member_role[]
  )
  and public.can_access_assigned_record(account_id, assigned_to)
)
with check (
  (
    public.has_account_role(
      account_id,
      array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[]
    )
    and (assigned_to is null or public.is_active_account_user(account_id, assigned_to))
  )
  or (
    public.has_account_role(account_id, array['sales']::public.bontraco_member_role[])
    and assigned_to = (select auth.uid())
  )
);

drop policy if exists properties_update_visible_contact on public.properties;
create policy properties_update_office on public.properties for update to authenticated
using (
  public.has_account_role(
    account_id,
    array['owner', 'admin', 'dispatcher', 'sales']::public.bontraco_member_role[]
  )
  and exists (
    select 1 from public.contacts c
    where c.id = contact_id
      and c.account_id = account_id
      and public.can_access_assigned_record(c.account_id, c.assigned_to)
  )
)
with check (
  public.has_account_role(
    account_id,
    array['owner', 'admin', 'dispatcher', 'sales']::public.bontraco_member_role[]
  )
  and exists (
    select 1 from public.contacts c
    where c.id = contact_id
      and c.account_id = account_id
      and public.can_access_assigned_record(c.account_id, c.assigned_to)
  )
);

drop policy if exists leads_select_assigned on public.leads;
create policy leads_select_office on public.leads for select to authenticated
using (
  public.has_account_role(
    account_id,
    array['owner', 'admin', 'dispatcher', 'sales']::public.bontraco_member_role[]
  )
  and public.can_access_assigned_record(account_id, assigned_to)
);

drop policy if exists leads_update_authorized on public.leads;
create policy leads_update_office on public.leads for update to authenticated
using (
  public.has_account_role(
    account_id,
    array['owner', 'admin', 'dispatcher', 'sales']::public.bontraco_member_role[]
  )
  and public.can_access_assigned_record(account_id, assigned_to)
)
with check (
  (
    public.has_account_role(
      account_id,
      array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[]
    )
    and (assigned_to is null or public.is_active_account_user(account_id, assigned_to))
  )
  or (
    public.has_account_role(account_id, array['sales']::public.bontraco_member_role[])
    and assigned_to = (select auth.uid())
  )
);

drop policy if exists appointments_insert_office on public.appointments;
create policy appointments_insert_office on public.appointments for insert to authenticated
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
      public.has_account_role(account_id, array['sales']::public.bontraco_member_role[])
      and assigned_to = (select auth.uid())
    )
  )
);
