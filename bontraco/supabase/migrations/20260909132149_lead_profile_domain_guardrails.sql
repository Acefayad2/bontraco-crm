alter table public.lead_source_profiles
  add constraint lead_source_profiles_domain_count_check
  check (
    cardinality(allowed_domains) <= 20
    and (provider <> 'tavily' or cardinality(allowed_domains) >= 1)
  ),
  add constraint lead_source_profiles_domain_shape_check
  check (
    allowed_domains::text = lower(allowed_domains::text)
    and array_to_string(allowed_domains, '') ~ '^[a-z0-9.-]*$'
  );
