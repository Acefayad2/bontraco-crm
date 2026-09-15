-- Produce useful CRM history automatically while preserving assigned-record visibility.

drop policy if exists activities_select_member on public.activities;

create policy activities_select_visible_record on public.activities for select to authenticated
using (
  public.has_account_role(account_id, array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[])
  or actor_id = (select auth.uid())
  or exists (
    select 1 from public.contacts c
    where c.id = contact_id and c.account_id = account_id
      and public.can_access_assigned_record(c.account_id, c.assigned_to)
  )
  or exists (
    select 1 from public.leads l
    where l.id = lead_id and l.account_id = account_id
      and public.can_access_assigned_record(l.account_id, l.assigned_to)
  )
  or exists (
    select 1 from public.jobs j
    where j.id = job_id and j.account_id = account_id
      and public.can_access_assigned_record(j.account_id, j.assigned_to)
  )
);

create or replace function public.record_bontraco_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_kind text;
  event_summary text;
  event_contact uuid;
  event_lead uuid;
  event_job uuid;
begin
  if tg_table_name = 'contacts' then
    event_kind := 'customer_created';
    event_summary := 'Customer added: ' || trim(new.first_name || ' ' || coalesce(new.last_name, ''));
    event_contact := new.id;
  elsif tg_table_name = 'leads' then
    event_lead := new.id;
    if tg_op = 'INSERT' then
      event_kind := 'lead_created';
      event_summary := 'Lead added: ' || new.title;
    else
      event_kind := 'lead_status_changed';
      event_summary := 'Lead moved to ' || replace(new.status, '_', ' ') || ': ' || new.title;
    end if;
  elsif tg_table_name = 'jobs' then
    event_job := new.id;
    event_contact := new.contact_id;
    if tg_op = 'INSERT' then
      event_kind := 'job_created';
      event_summary := 'Job created: ' || new.title;
    else
      event_kind := 'job_stage_changed';
      event_summary := 'Job moved to ' || new.stage || ': ' || new.title;
    end if;
  elsif tg_table_name = 'appointments' then
    event_job := new.job_id;
    event_contact := new.contact_id;
    if tg_op = 'INSERT' then
      event_kind := 'appointment_created';
      event_summary := 'Appointment scheduled: ' || new.title;
    else
      event_kind := 'appointment_status_changed';
      event_summary := 'Appointment marked ' || replace(new.status, '_', ' ') || ': ' || new.title;
    end if;
  else
    return new;
  end if;

  insert into public.activities (
    account_id, actor_id, contact_id, lead_id, job_id, kind, summary, metadata
  ) values (
    new.account_id,
    (select auth.uid()),
    event_contact,
    event_lead,
    event_job,
    event_kind,
    event_summary,
    jsonb_build_object('source_table', tg_table_name, 'operation', tg_op)
  );
  return new;
end;
$$;

revoke all on function public.record_bontraco_activity() from public;
revoke execute on function public.record_bontraco_activity() from anon, authenticated;

create trigger contacts_record_activity
after insert on public.contacts
for each row execute function public.record_bontraco_activity();

create trigger leads_record_activity
after insert or update of status on public.leads
for each row execute function public.record_bontraco_activity();

create trigger jobs_record_activity
after insert or update of stage on public.jobs
for each row execute function public.record_bontraco_activity();

create trigger appointments_record_activity
after insert or update of status on public.appointments
for each row execute function public.record_bontraco_activity();
