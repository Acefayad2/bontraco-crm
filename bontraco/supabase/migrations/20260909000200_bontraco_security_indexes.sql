-- Tighten function access and add covering indexes for foreign-key maintenance.

revoke execute on function public.is_account_member(uuid) from anon;
revoke execute on function public.has_account_role(uuid, public.bontraco_member_role[]) from anon;
revoke execute on function public.can_access_assigned_record(uuid, uuid) from anon;
revoke execute on function public.create_bontraco_account(text, text, public.bontraco_trade) from anon;

create index accounts_created_by_idx on public.accounts (created_by);
create index invitations_invited_by_idx on public.invitations (invited_by);
create index contacts_assigned_to_idx on public.contacts (assigned_to);
create index contacts_created_by_idx on public.contacts (created_by);
create index properties_contact_id_idx on public.properties (contact_id);
create index leads_assigned_to_idx on public.leads (assigned_to);
create index leads_contact_id_idx on public.leads (contact_id);
create index jobs_contact_id_idx on public.jobs (contact_id);
create index jobs_property_id_idx on public.jobs (property_id);
create index jobs_lead_id_idx on public.jobs (lead_id);
create index jobs_assigned_to_idx on public.jobs (assigned_to);
create index jobs_created_by_idx on public.jobs (created_by);
create index appointments_job_id_idx on public.appointments (job_id);
create index appointments_contact_id_idx on public.appointments (contact_id);
create index appointments_created_by_idx on public.appointments (created_by);
create index tasks_job_id_idx on public.tasks (job_id);
create index tasks_lead_id_idx on public.tasks (lead_id);
create index tasks_assigned_to_idx on public.tasks (assigned_to);
create index tasks_created_by_idx on public.tasks (created_by);
create index activities_actor_id_idx on public.activities (actor_id);
create index activities_contact_id_idx on public.activities (contact_id);
create index activities_lead_id_idx on public.activities (lead_id);
create index activities_job_id_idx on public.activities (job_id);
