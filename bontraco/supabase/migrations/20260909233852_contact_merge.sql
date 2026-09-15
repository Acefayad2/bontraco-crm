-- Atomically consolidate duplicate customers without orphaning operational or consent history.

create or replace function public.validate_communication_suppression_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.contact_id is distinct from old.contact_id
    and current_user in ('postgres', 'service_role')
    and new.id is not distinct from old.id
    and new.account_id is not distinct from old.account_id
    and new.channel is not distinct from old.channel
    and new.destination is not distinct from old.destination
    and new.reason is not distinct from old.reason
    and new.source is not distinct from old.source
    and new.created_by is not distinct from old.created_by
    and new.suppressed_at is not distinct from old.suppressed_at
    and new.lifted_at is not distinct from old.lifted_at
    and new.lifted_by is not distinct from old.lifted_by
    and new.lift_reason is not distinct from old.lift_reason
    and new.created_at is not distinct from old.created_at then
    return new;
  end if;

  if old.lifted_at is not null then
    raise exception 'A lifted suppression is immutable';
  end if;
  if new.id is distinct from old.id
    or new.account_id is distinct from old.account_id
    or new.contact_id is distinct from old.contact_id
    or new.channel is distinct from old.channel
    or new.destination is distinct from old.destination
    or new.reason is distinct from old.reason
    or new.source is distinct from old.source
    or new.created_by is distinct from old.created_by
    or new.suppressed_at is distinct from old.suppressed_at
    or new.created_at is distinct from old.created_at then
    raise exception 'Suppression evidence is immutable';
  end if;
  if new.lifted_at is null
    or new.lifted_by is distinct from (select auth.uid())
    or new.lift_reason is null
    or char_length(btrim(new.lift_reason)) < 2 then
    raise exception 'Lifting requires the current actor, timestamp, and reason';
  end if;
  return new;
end;
$$;

create or replace function public.merge_bontraco_contacts(
  target_account_id uuid,
  source_contact_id uuid,
  destination_contact_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_contact public.contacts%rowtype;
  destination_contact public.contacts%rowtype;
  matched_contacts integer := 0;
  moved_properties integer := 0;
  moved_leads integer := 0;
  moved_jobs integer := 0;
  moved_appointments integer := 0;
  moved_activities integer := 0;
  moved_notes integer := 0;
  moved_files integer := 0;
  moved_calls integer := 0;
  moved_suppressions integer := 0;
  moved_consents integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if target_account_id is null or source_contact_id is null or destination_contact_id is null then
    raise exception 'Workspace and both customer records are required';
  end if;
  if source_contact_id = destination_contact_id then
    raise exception 'Choose two different customer records';
  end if;
  if not public.has_account_role(
    target_account_id,
    array['owner', 'admin']::public.bontraco_member_role[]
  ) then
    raise exception 'Owner or admin access required';
  end if;

  perform c.id
  from public.contacts c
  where c.account_id = target_account_id
    and c.id in (source_contact_id, destination_contact_id)
  order by c.id
  for update;
  get diagnostics matched_contacts = row_count;
  if matched_contacts <> 2 then
    raise exception 'Both customer records must belong to this workspace';
  end if;

  select * into source_contact
  from public.contacts
  where account_id = target_account_id and id = source_contact_id;
  select * into destination_contact
  from public.contacts
  where account_id = target_account_id and id = destination_contact_id;

  update public.contacts
  set
    last_name = coalesce(nullif(btrim(destination_contact.last_name), ''), source_contact.last_name),
    company_name = coalesce(
      nullif(btrim(destination_contact.company_name), ''),
      source_contact.company_name
    ),
    email = coalesce(nullif(btrim(destination_contact.email), ''), source_contact.email),
    phone = coalesce(nullif(btrim(destination_contact.phone), ''), source_contact.phone),
    source = coalesce(nullif(btrim(destination_contact.source), ''), source_contact.source),
    assigned_to = coalesce(destination_contact.assigned_to, source_contact.assigned_to)
  where account_id = target_account_id and id = destination_contact_id;

  update public.properties set contact_id = destination_contact_id
  where account_id = target_account_id and contact_id = source_contact_id;
  get diagnostics moved_properties = row_count;
  update public.leads set contact_id = destination_contact_id
  where account_id = target_account_id and contact_id = source_contact_id;
  get diagnostics moved_leads = row_count;
  update public.jobs set contact_id = destination_contact_id
  where account_id = target_account_id and contact_id = source_contact_id;
  get diagnostics moved_jobs = row_count;
  update public.appointments set contact_id = destination_contact_id
  where account_id = target_account_id and contact_id = source_contact_id;
  get diagnostics moved_appointments = row_count;
  update public.activities set contact_id = destination_contact_id
  where account_id = target_account_id and contact_id = source_contact_id;
  get diagnostics moved_activities = row_count;
  update public.notes set contact_id = destination_contact_id
  where account_id = target_account_id and contact_id = source_contact_id;
  get diagnostics moved_notes = row_count;
  update public.files set contact_id = destination_contact_id
  where account_id = target_account_id and contact_id = source_contact_id;
  get diagnostics moved_files = row_count;
  update public.calls set contact_id = destination_contact_id
  where account_id = target_account_id and contact_id = source_contact_id;
  get diagnostics moved_calls = row_count;
  update public.communication_suppressions set contact_id = destination_contact_id
  where account_id = target_account_id and contact_id = source_contact_id;
  get diagnostics moved_suppressions = row_count;
  update public.communication_consents set contact_id = destination_contact_id
  where account_id = target_account_id and contact_id = source_contact_id;
  get diagnostics moved_consents = row_count;

  delete from public.contacts
  where account_id = target_account_id and id = source_contact_id;

  insert into public.activities (account_id, actor_id, contact_id, kind, summary, metadata)
  values (
    target_account_id,
    (select auth.uid()),
    destination_contact_id,
    'customer_merged',
    'Duplicate customer merged into ' || trim(
      destination_contact.first_name || ' ' || coalesce(destination_contact.last_name, '')
    ),
    jsonb_build_object(
      'source_contact_id', source_contact_id,
      'destination_contact_id', destination_contact_id,
      'source_name', trim(source_contact.first_name || ' ' || coalesce(source_contact.last_name, '')),
      'moved', jsonb_build_object(
        'properties', moved_properties,
        'leads', moved_leads,
        'jobs', moved_jobs,
        'appointments', moved_appointments,
        'activities', moved_activities,
        'notes', moved_notes,
        'files', moved_files,
        'calls', moved_calls,
        'suppressions', moved_suppressions,
        'consents', moved_consents
      )
    )
  );

  return jsonb_build_object(
    'contact_id', destination_contact_id,
    'moved_records', moved_properties + moved_leads + moved_jobs + moved_appointments
      + moved_activities + moved_notes + moved_files + moved_calls
      + moved_suppressions + moved_consents
  );
end;
$$;

revoke all on function public.merge_bontraco_contacts(uuid, uuid, uuid) from public;
revoke execute on function public.merge_bontraco_contacts(uuid, uuid, uuid) from anon;
grant execute on function public.merge_bontraco_contacts(uuid, uuid, uuid) to authenticated, service_role;
