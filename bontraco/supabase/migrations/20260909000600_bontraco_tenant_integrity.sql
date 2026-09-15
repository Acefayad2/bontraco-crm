-- Enforce same-account relationships even when record IDs are guessed.

alter table public.contacts add constraint contacts_account_id_id_key unique (account_id, id);
alter table public.properties add constraint properties_account_id_id_key unique (account_id, id);
alter table public.leads add constraint leads_account_id_id_key unique (account_id, id);
alter table public.jobs add constraint jobs_account_id_id_key unique (account_id, id);

alter table public.properties drop constraint properties_contact_id_fkey;
alter table public.leads drop constraint leads_contact_id_fkey;
alter table public.jobs drop constraint jobs_contact_id_fkey;
alter table public.jobs drop constraint jobs_property_id_fkey;
alter table public.jobs drop constraint jobs_lead_id_fkey;
alter table public.appointments drop constraint appointments_job_id_fkey;
alter table public.appointments drop constraint appointments_contact_id_fkey;
alter table public.tasks drop constraint tasks_job_id_fkey;
alter table public.tasks drop constraint tasks_lead_id_fkey;
alter table public.activities drop constraint activities_contact_id_fkey;
alter table public.activities drop constraint activities_lead_id_fkey;
alter table public.activities drop constraint activities_job_id_fkey;

alter table public.properties
  add constraint properties_account_contact_fkey
  foreign key (account_id, contact_id) references public.contacts(account_id, id) on delete cascade;

alter table public.leads
  add constraint leads_account_contact_fkey
  foreign key (account_id, contact_id) references public.contacts(account_id, id) on delete set null (contact_id);

alter table public.jobs
  add constraint jobs_account_contact_fkey
  foreign key (account_id, contact_id) references public.contacts(account_id, id) on delete restrict;
alter table public.jobs
  add constraint jobs_account_property_fkey
  foreign key (account_id, property_id) references public.properties(account_id, id) on delete set null (property_id);
alter table public.jobs
  add constraint jobs_account_lead_fkey
  foreign key (account_id, lead_id) references public.leads(account_id, id) on delete set null (lead_id);

alter table public.appointments
  add constraint appointments_account_job_fkey
  foreign key (account_id, job_id) references public.jobs(account_id, id) on delete cascade;
alter table public.appointments
  add constraint appointments_account_contact_fkey
  foreign key (account_id, contact_id) references public.contacts(account_id, id) on delete cascade;

alter table public.tasks
  add constraint tasks_account_job_fkey
  foreign key (account_id, job_id) references public.jobs(account_id, id) on delete cascade;
alter table public.tasks
  add constraint tasks_account_lead_fkey
  foreign key (account_id, lead_id) references public.leads(account_id, id) on delete cascade;

alter table public.activities
  add constraint activities_account_contact_fkey
  foreign key (account_id, contact_id) references public.contacts(account_id, id) on delete cascade;
alter table public.activities
  add constraint activities_account_lead_fkey
  foreign key (account_id, lead_id) references public.leads(account_id, id) on delete cascade;
alter table public.activities
  add constraint activities_account_job_fkey
  foreign key (account_id, job_id) references public.jobs(account_id, id) on delete cascade;

drop policy if exists contacts_insert_member on public.contacts;
drop policy if exists contacts_update_assigned on public.contacts;
drop policy if exists jobs_insert_member on public.jobs;
drop policy if exists jobs_update_assigned on public.jobs;

create policy contacts_insert_authorized on public.contacts for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (
    (
      public.has_account_role(account_id, array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[])
      and (assigned_to is null or public.is_active_account_user(account_id, assigned_to))
    )
    or (
      public.has_account_role(account_id, array['sales']::public.bontraco_member_role[])
      and assigned_to = (select auth.uid())
    )
  )
);

create policy contacts_update_authorized on public.contacts for update to authenticated
using (public.can_access_assigned_record(account_id, assigned_to))
with check (
  (
    public.has_account_role(account_id, array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[])
    and (assigned_to is null or public.is_active_account_user(account_id, assigned_to))
  )
  or assigned_to = (select auth.uid())
);

create policy jobs_insert_authorized on public.jobs for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (
    (
      public.has_account_role(account_id, array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[])
      and (assigned_to is null or public.is_active_account_user(account_id, assigned_to))
    )
    or (
      public.has_account_role(account_id, array['sales']::public.bontraco_member_role[])
      and assigned_to = (select auth.uid())
    )
  )
);

create policy jobs_update_authorized on public.jobs for update to authenticated
using (public.can_access_assigned_record(account_id, assigned_to))
with check (
  (
    public.has_account_role(account_id, array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[])
    and (assigned_to is null or public.is_active_account_user(account_id, assigned_to))
  )
  or assigned_to = (select auth.uid())
);
