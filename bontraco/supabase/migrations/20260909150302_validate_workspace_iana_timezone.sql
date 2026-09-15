-- Require real IANA zone names rather than accepting format-only lookalikes.
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
  return new;
end;
$$;

revoke all on function private.normalize_bontraco_account_profile()
from public, anon, authenticated;
