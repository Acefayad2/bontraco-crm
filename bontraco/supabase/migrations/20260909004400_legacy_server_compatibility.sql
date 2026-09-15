-- Keep the currently published prototype server functions operational while the
-- underlying records remain isolated from browser roles.
grant usage on schema bontraco_legacy to service_role;
grant select, insert, update, delete on
  bontraco_legacy.crm_accounts,
  bontraco_legacy.crm_members,
  bontraco_legacy.crm_clients,
  bontraco_legacy.crm_jobs,
  bontraco_legacy.crm_leads,
  bontraco_legacy.crm_scan_runs
to service_role;
grant usage, select on all sequences in schema bontraco_legacy to service_role;

create view public.crm_accounts with (security_invoker = true) as
select * from bontraco_legacy.crm_accounts;
create view public.crm_members with (security_invoker = true) as
select * from bontraco_legacy.crm_members;
create view public.crm_clients with (security_invoker = true) as
select * from bontraco_legacy.crm_clients;
create view public.crm_jobs with (security_invoker = true) as
select * from bontraco_legacy.crm_jobs;
create view public.crm_leads with (security_invoker = true) as
select * from bontraco_legacy.crm_leads;
create view public.crm_scan_runs with (security_invoker = true) as
select * from bontraco_legacy.crm_scan_runs;

revoke all on
  public.crm_accounts,
  public.crm_members,
  public.crm_clients,
  public.crm_jobs,
  public.crm_leads,
  public.crm_scan_runs
from public, anon, authenticated;
grant select, insert, update, delete on
  public.crm_accounts,
  public.crm_members,
  public.crm_clients,
  public.crm_jobs,
  public.crm_leads,
  public.crm_scan_runs
to service_role;

comment on view public.crm_leads is
  'Temporary service-role-only compatibility view for the currently published prototype.';
