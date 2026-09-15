alter table public.lead_source_profiles
  add column daily_request_limit smallint not null default 96,
  add constraint lead_source_profiles_daily_request_limit_check
    check (daily_request_limit between 1 and 1000);

comment on column public.lead_source_profiles.daily_request_limit is
  'Maximum provider requests this profile may initiate per UTC day, including failed attempts.';
