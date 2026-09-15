-- Tenant-controlled contact identity and safe defaults for customer estimate documents.
alter table public.accounts
  add column business_phone text,
  add column business_email text,
  add column business_website text,
  add column proposal_accent_color text not null default '#0F5B4F',
  add column estimate_default_tax_rate numeric(7,6) not null default 0,
  add column estimate_default_valid_days smallint not null default 30,
  add column estimate_default_customer_note text,
  add column estimate_default_terms text,
  add constraint accounts_business_phone_length check (
    business_phone is null or char_length(business_phone) between 7 and 40
  ),
  add constraint accounts_business_email_format check (
    business_email is null or (
      char_length(business_email) between 3 and 254
      and business_email = lower(business_email)
      and business_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  ),
  add constraint accounts_business_website_format check (
    business_website is null or (
      char_length(business_website) between 9 and 500
      and business_website ~ '^https://[^[:space:]]+$'
    )
  ),
  add constraint accounts_proposal_accent_color_format check (
    proposal_accent_color ~ '^#[0-9A-F]{6}$'
  ),
  add constraint accounts_estimate_default_tax_rate_range check (
    estimate_default_tax_rate between 0 and 1
  ),
  add constraint accounts_estimate_default_valid_days_range check (
    estimate_default_valid_days between 1 and 365
  ),
  add constraint accounts_estimate_default_customer_note_length check (
    estimate_default_customer_note is null
    or char_length(estimate_default_customer_note) between 1 and 2000
  ),
  add constraint accounts_estimate_default_terms_length check (
    estimate_default_terms is null or char_length(estimate_default_terms) between 1 and 5000
  );

comment on column public.accounts.estimate_default_tax_rate is
  'Workspace estimate tax default stored as a decimal fraction from 0 through 1.';
comment on column public.accounts.proposal_accent_color is
  'Uppercase six-digit hex color used for non-text proposal branding accents.';

create or replace function private.normalize_bontraco_account_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := btrim(new.name);
  new.legal_name := coalesce(nullif(btrim(new.legal_name), ''), new.name);
  new.timezone := btrim(new.timezone);
  if not exists (
    select 1 from pg_catalog.pg_timezone_names timezone_name
    where timezone_name.name = new.timezone
  ) then
    raise check_violation using message = 'Timezone must be a recognized IANA timezone';
  end if;
  new.service_area := nullif(btrim(new.service_area), '');
  new.business_hours := nullif(btrim(new.business_hours), '');
  new.emergency_rules := nullif(btrim(new.emergency_rules), '');
  new.business_phone := nullif(btrim(new.business_phone), '');
  new.business_email := lower(nullif(btrim(new.business_email), ''));
  new.business_website := nullif(btrim(new.business_website), '');
  new.proposal_accent_color := upper(btrim(new.proposal_accent_color));
  new.estimate_default_customer_note := nullif(btrim(new.estimate_default_customer_note), '');
  new.estimate_default_terms := nullif(btrim(new.estimate_default_terms), '');
  return new;
end;
$$;

drop trigger accounts_normalize_business_profile on public.accounts;
create trigger accounts_normalize_business_profile
before insert or update of
  name,
  legal_name,
  timezone,
  service_area,
  business_hours,
  emergency_rules,
  business_phone,
  business_email,
  business_website,
  proposal_accent_color,
  estimate_default_customer_note,
  estimate_default_terms
on public.accounts
for each row execute function private.normalize_bontraco_account_profile();

revoke all on function private.normalize_bontraco_account_profile()
from public, anon, authenticated;
