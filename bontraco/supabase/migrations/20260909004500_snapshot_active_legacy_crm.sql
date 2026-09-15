-- The published prototype still writes through service-role compatibility views.
-- Preserve a separate, read-only snapshot while those active tables continue to change.
create table bontraco_legacy.snapshot_crm_accounts as
table bontraco_legacy.crm_accounts;
create table bontraco_legacy.snapshot_crm_members as
table bontraco_legacy.crm_members;
create table bontraco_legacy.snapshot_crm_clients as
table bontraco_legacy.crm_clients;
create table bontraco_legacy.snapshot_crm_jobs as
table bontraco_legacy.crm_jobs;
create table bontraco_legacy.snapshot_crm_leads as
table bontraco_legacy.crm_leads;
create table bontraco_legacy.snapshot_crm_scan_runs as
table bontraco_legacy.crm_scan_runs;

revoke all on
  bontraco_legacy.snapshot_crm_accounts,
  bontraco_legacy.snapshot_crm_members,
  bontraco_legacy.snapshot_crm_clients,
  bontraco_legacy.snapshot_crm_jobs,
  bontraco_legacy.snapshot_crm_leads,
  bontraco_legacy.snapshot_crm_scan_runs
from public, anon, authenticated, service_role;

delete from bontraco_legacy.archive_manifest;
insert into bontraco_legacy.archive_manifest (row_counts, note)
select jsonb_build_object(
  'crm_accounts', (select count(*) from bontraco_legacy.snapshot_crm_accounts),
  'crm_members', (select count(*) from bontraco_legacy.snapshot_crm_members),
  'crm_clients', (select count(*) from bontraco_legacy.snapshot_crm_clients),
  'crm_jobs', (select count(*) from bontraco_legacy.snapshot_crm_jobs),
  'crm_leads', (select count(*) from bontraco_legacy.snapshot_crm_leads),
  'crm_scan_runs', (select count(*) from bontraco_legacy.snapshot_crm_scan_runs)
), 'Read-only snapshot of the active pre-Bontraco prototype; retain until controlled owner import or written disposal approval.';

comment on table bontraco_legacy.snapshot_crm_leads is
  'Read-only preservation snapshot. The unsuffixed legacy tables remain active for temporary production compatibility.';
