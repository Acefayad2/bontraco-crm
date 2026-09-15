create index communication_suppressions_created_by_idx
  on public.communication_suppressions (created_by);
create index communication_suppressions_lifted_by_idx
  on public.communication_suppressions (lifted_by)
  where lifted_by is not null;
create index communication_consents_created_by_idx
  on public.communication_consents (created_by);
