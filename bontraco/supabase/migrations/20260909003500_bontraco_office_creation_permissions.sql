-- Field users work assigned jobs; office roles create CRM, lead, and scheduling records.

drop policy if exists contacts_insert_member on public.contacts;
create policy contacts_insert_office on public.contacts for insert to authenticated
with check (
  public.has_account_role(
    account_id,
    array['owner', 'admin', 'dispatcher', 'sales']::public.bontraco_member_role[]
  )
  and created_by = (select auth.uid())
  and (
    assigned_to = (select auth.uid())
    or public.has_account_role(
      account_id,
      array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[]
    )
  )
);

drop policy if exists properties_insert_visible_contact on public.properties;
create policy properties_insert_office on public.properties for insert to authenticated
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

drop policy if exists leads_insert_member on public.leads;
create policy leads_insert_office on public.leads for insert to authenticated
with check (
  public.has_account_role(
    account_id,
    array['owner', 'admin', 'dispatcher', 'sales']::public.bontraco_member_role[]
  )
  and (
    assigned_to = (select auth.uid())
    or public.has_account_role(
      account_id,
      array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[]
    )
  )
);

drop policy if exists jobs_insert_member on public.jobs;
create policy jobs_insert_office on public.jobs for insert to authenticated
with check (
  public.has_account_role(
    account_id,
    array['owner', 'admin', 'dispatcher', 'sales']::public.bontraco_member_role[]
  )
  and created_by = (select auth.uid())
  and (
    assigned_to = (select auth.uid())
    or public.has_account_role(
      account_id,
      array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[]
    )
  )
);

drop policy if exists appointments_insert_member on public.appointments;
create policy appointments_insert_office on public.appointments for insert to authenticated
with check (
  public.has_account_role(
    account_id,
    array['owner', 'admin', 'dispatcher', 'sales']::public.bontraco_member_role[]
  )
  and created_by = (select auth.uid())
  and (
    assigned_to = (select auth.uid())
    or public.has_account_role(
      account_id,
      array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[]
    )
  )
);
