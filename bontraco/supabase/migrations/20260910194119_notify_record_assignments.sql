-- Notify only the teammate receiving an operational assignment.

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('new_lead', 'urgent_call', 'appointment_booked', 'billing_issue', 'assignment', 'system'));

create or replace function private.notify_bontraco_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  entity_label text;
  record_label text;
begin
  if new.assigned_to is null then
    return new;
  end if;

  if tg_table_name = 'contacts' then
    entity_label := 'Customer';
    record_label := trim(new.first_name || ' ' || coalesce(new.last_name, ''));
  elsif tg_table_name = 'leads' then
    entity_label := 'Lead';
    record_label := new.title;
  elsif tg_table_name = 'jobs' then
    entity_label := 'Job';
    record_label := new.title;
  elsif tg_table_name = 'appointments' then
    entity_label := 'Appointment';
    record_label := new.title;
  elsif tg_table_name = 'tasks' then
    entity_label := 'Task';
    record_label := new.title;
  elsif tg_table_name = 'calls' then
    entity_label := 'Call';
    record_label := coalesce(new.caller_name, new.from_number, new.provider_call_id);
  else
    return new;
  end if;

  insert into public.notifications (
    account_id, user_id, kind, title, body, metadata
  ) values (
    new.account_id,
    new.assigned_to,
    'assignment',
    entity_label || ' assigned to you',
    left(record_label, 280),
    jsonb_build_object(
      'source_table', tg_table_name,
      'record_id', new.id,
      'assigned_by', (select auth.uid()),
      'old_assignee', old.assigned_to,
      'new_assignee', new.assigned_to
    )
  );

  return new;
end;
$$;

revoke all on function private.notify_bontraco_assignment()
from public, anon, authenticated;

create trigger contacts_notify_assignment
after update of assigned_to on public.contacts
for each row
when (old.assigned_to is distinct from new.assigned_to and new.assigned_to is not null)
execute function private.notify_bontraco_assignment();

create trigger leads_notify_assignment
after update of assigned_to on public.leads
for each row
when (old.assigned_to is distinct from new.assigned_to and new.assigned_to is not null)
execute function private.notify_bontraco_assignment();

create trigger jobs_notify_assignment
after update of assigned_to on public.jobs
for each row
when (old.assigned_to is distinct from new.assigned_to and new.assigned_to is not null)
execute function private.notify_bontraco_assignment();

create trigger appointments_notify_assignment
after update of assigned_to on public.appointments
for each row
when (old.assigned_to is distinct from new.assigned_to and new.assigned_to is not null)
execute function private.notify_bontraco_assignment();

create trigger tasks_notify_assignment
after update of assigned_to on public.tasks
for each row
when (old.assigned_to is distinct from new.assigned_to and new.assigned_to is not null)
execute function private.notify_bontraco_assignment();

create trigger calls_notify_assignment
after update of assigned_to on public.calls
for each row
when (old.assigned_to is distinct from new.assigned_to and new.assigned_to is not null)
execute function private.notify_bontraco_assignment();
