-- Cover the source-profile creator foreign key reported by the database advisor.

create index if not exists lead_source_profiles_created_by_idx
  on public.lead_source_profiles (created_by);
