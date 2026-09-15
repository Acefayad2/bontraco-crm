-- Cover tenant-safe composite foreign keys used by CRM joins and cascades.

create index if not exists activities_account_contact_idx
  on public.activities (account_id, contact_id)
  where contact_id is not null;
create index if not exists activities_account_lead_idx
  on public.activities (account_id, lead_id)
  where lead_id is not null;
create index if not exists activities_account_job_idx
  on public.activities (account_id, job_id)
  where job_id is not null;

create index if not exists appointments_account_contact_idx
  on public.appointments (account_id, contact_id)
  where contact_id is not null;
create index if not exists appointments_account_job_idx
  on public.appointments (account_id, job_id)
  where job_id is not null;

create index if not exists jobs_account_contact_idx
  on public.jobs (account_id, contact_id);
create index if not exists jobs_account_property_idx
  on public.jobs (account_id, property_id)
  where property_id is not null;
create index if not exists jobs_account_lead_idx
  on public.jobs (account_id, lead_id)
  where lead_id is not null;

create index if not exists leads_account_contact_idx
  on public.leads (account_id, contact_id)
  where contact_id is not null;

create index if not exists tasks_account_job_idx
  on public.tasks (account_id, job_id)
  where job_id is not null;
create index if not exists tasks_account_lead_idx
  on public.tasks (account_id, lead_id)
  where lead_id is not null;
