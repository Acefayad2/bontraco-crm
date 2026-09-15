-- Create one tenant-scoped activity whenever an operational record is reassigned.

create or replace function private.record_bontraco_assignment_activity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  entity_label text;
  record_label text;
  assignee_label text;
  event_contact_id uuid;
  event_lead_id uuid;
  event_job_id uuid;
begin
  if tg_table_name = 'contacts' then
    entity_label := 'Customer';
    record_label := trim(new.first_name || ' ' || coalesce(new.last_name, ''));
    event_contact_id := new.id;
  elsif tg_table_name = 'leads' then
    entity_label := 'Lead';
    record_label := new.title;
    event_lead_id := new.id;
  elsif tg_table_name = 'jobs' then
    entity_label := 'Job';
    record_label := new.title;
    event_contact_id := new.contact_id;
    event_job_id := new.id;
  elsif tg_table_name = 'appointments' then
    entity_label := 'Appointment';
    record_label := new.title;
    event_contact_id := new.contact_id;
    event_job_id := new.job_id;
  elsif tg_table_name = 'tasks' then
    entity_label := 'Task';
    record_label := new.title;
    event_lead_id := new.lead_id;
    event_job_id := new.job_id;
  elsif tg_table_name = 'calls' then
    entity_label := 'Call';
    record_label := coalesce(new.caller_name, new.from_number, new.provider_call_id);
    event_contact_id := new.contact_id;
    event_lead_id := new.lead_id;
    event_job_id := new.job_id;
  else
    return new;
  end if;

  if new.assigned_to is not null then
    select coalesce(nullif(trim(m.display_name), ''), m.email)
    into assignee_label
    from public.memberships m
    where m.account_id = new.account_id
      and m.user_id = new.assigned_to;
  end if;

  insert into public.activities (
    account_id, actor_id, contact_id, lead_id, job_id, kind, summary, metadata
  ) values (
    new.account_id,
    (select auth.uid()),
    event_contact_id,
    event_lead_id,
    event_job_id,
    'assignment_changed',
    entity_label
      || case
        when new.assigned_to is null then ' unassigned: '
        else ' assigned to ' || coalesce(assignee_label, 'a teammate') || ': '
      end
      || record_label,
    jsonb_build_object(
      'source_table', tg_table_name,
      'record_id', new.id,
      'old_assignee', old.assigned_to,
      'new_assignee', new.assigned_to
    )
  );

  return new;
end;
$$;

revoke all on function private.record_bontraco_assignment_activity()
from public, anon, authenticated;

create trigger contacts_record_assignment_activity
after update of assigned_to on public.contacts
for each row
when (old.assigned_to is distinct from new.assigned_to)
execute function private.record_bontraco_assignment_activity();

create trigger leads_record_assignment_activity
after update of assigned_to on public.leads
for each row
when (old.assigned_to is distinct from new.assigned_to)
execute function private.record_bontraco_assignment_activity();

create trigger jobs_record_assignment_activity
after update of assigned_to on public.jobs
for each row
when (old.assigned_to is distinct from new.assigned_to)
execute function private.record_bontraco_assignment_activity();

create trigger appointments_record_assignment_activity
after update of assigned_to on public.appointments
for each row
when (old.assigned_to is distinct from new.assigned_to)
execute function private.record_bontraco_assignment_activity();

create trigger tasks_record_assignment_activity
after update of assigned_to on public.tasks
for each row
when (old.assigned_to is distinct from new.assigned_to)
execute function private.record_bontraco_assignment_activity();

create trigger calls_record_assignment_activity
after update of assigned_to on public.calls
for each row
when (old.assigned_to is distinct from new.assigned_to)
execute function private.record_bontraco_assignment_activity();
