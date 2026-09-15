-- This project predates the current restrictive default grants. Keep new CRM tables undiscoverable to anon.

revoke all on table public.lead_source_profiles from anon;
revoke all on table public.lead_scan_runs from anon;
revoke all on table public.notes from anon;
revoke all on table public.files from anon;

revoke all on all sequences in schema public from anon;
