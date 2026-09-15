drop policy lead_source_profiles_insert_admin on public.lead_source_profiles;
drop policy lead_source_profiles_update_admin on public.lead_source_profiles;

create policy lead_source_profiles_insert_admin
on public.lead_source_profiles for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.has_account_role(
    account_id,
    array['owner', 'admin']::public.bontraco_member_role[]
  )
  and (
    not enabled
    or public.has_account_entitlement(account_id, 'lead_engine')
  )
);

create policy lead_source_profiles_update_admin
on public.lead_source_profiles for update to authenticated
using (
  public.has_account_role(
    account_id,
    array['owner', 'admin']::public.bontraco_member_role[]
  )
)
with check (
  public.has_account_role(
    account_id,
    array['owner', 'admin']::public.bontraco_member_role[]
  )
  and (
    not enabled
    or public.has_account_entitlement(account_id, 'lead_engine')
  )
);
