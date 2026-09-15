-- Trigger helpers run through their owning triggers and must not be callable over the API.
revoke execute on function public.audit_bontraco_checklist_completion() from public, anon, authenticated;
revoke execute on function public.seed_bontraco_job_checklist() from public, anon, authenticated;

-- Support archive-user lookups and foreign-key maintenance on service locations.
create index if not exists properties_archived_by_idx on public.properties (archived_by);
