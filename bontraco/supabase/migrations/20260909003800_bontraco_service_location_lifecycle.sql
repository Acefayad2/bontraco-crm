alter table public.properties
  add column active boolean not null default true,
  add column archived_at timestamptz,
  add column archived_by uuid references auth.users(id) on delete set null,
  add constraint properties_archive_state_valid check (
    (active and archived_at is null and archived_by is null)
    or (not active and archived_at is not null)
  ),
  add constraint properties_label_length check (label is null or char_length(label) <= 80),
  add constraint properties_address_line_1_length check (
    char_length(trim(address_line_1)) between 1 and 200
  ),
  add constraint properties_address_line_2_length check (
    address_line_2 is null or char_length(address_line_2) <= 200
  ),
  add constraint properties_city_length check (char_length(trim(city)) between 1 and 100),
  add constraint properties_region_length check (char_length(trim(region)) between 1 and 30),
  add constraint properties_postal_code_length check (
    postal_code is null or char_length(postal_code) <= 30
  );

create index properties_account_active_contact_idx
  on public.properties (account_id, active, contact_id, created_at);

create or replace function public.guard_bontraco_property_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.active is distinct from old.active
    or new.archived_at is distinct from old.archived_at
    or new.archived_by is distinct from old.archived_by
  then
    if (select auth.uid()) is not null and not public.has_account_role(
      old.account_id,
      array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[]
    ) then
      raise exception 'Owner, administrator, or dispatcher required';
    end if;
  end if;
  return new;
end;
$$;

create trigger properties_guard_lifecycle
before update on public.properties
for each row execute function public.guard_bontraco_property_lifecycle();

revoke all on function public.guard_bontraco_property_lifecycle() from public, anon, authenticated;

create or replace function public.set_bontraco_property_active(
  target_account_id uuid,
  target_property_id uuid,
  desired_active boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_contact_id uuid;
begin
  if actor_id is null then raise exception 'Authentication required'; end if;
  if not public.has_account_role(
    target_account_id,
    array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[]
  ) then
    raise exception 'Owner, administrator, or dispatcher required';
  end if;

  select p.contact_id into target_contact_id
  from public.properties p
  where p.account_id = target_account_id and p.id = target_property_id;
  if target_contact_id is null then raise exception 'Service location not found'; end if;

  update public.properties
  set active = desired_active,
      archived_at = case when desired_active then null else now() end,
      archived_by = case when desired_active then null else actor_id end
  where account_id = target_account_id and id = target_property_id;

  insert into public.activities (account_id, actor_id, contact_id, kind, summary, metadata)
  values (
    target_account_id,
    actor_id,
    target_contact_id,
    case when desired_active then 'service_location_reactivated' else 'service_location_archived' end,
    case when desired_active then 'Service location reactivated' else 'Service location archived' end,
    jsonb_build_object('property_id', target_property_id)
  );
end;
$$;

revoke all on function public.set_bontraco_property_active(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_bontraco_property_active(uuid, uuid, boolean) to authenticated;
