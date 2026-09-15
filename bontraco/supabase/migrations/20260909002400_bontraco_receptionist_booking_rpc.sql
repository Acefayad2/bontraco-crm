-- Atomic, idempotent appointment creation for the signed receptionist tool.
create or replace function public.book_receptionist_appointment(
  target_account_id uuid,
  target_provider_call_id text,
  customer_name text,
  customer_phone text,
  appointment_title text,
  appointment_starts_at timestamptz,
  appointment_ends_at timestamptz,
  appointment_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_call public.calls%rowtype;
  actor_id uuid;
  target_contact_id uuid;
  target_appointment_id uuid;
  external_reference text;
  normalized_name text := trim(coalesce(customer_name, ''));
begin
  if appointment_starts_at < now() - interval '5 minutes' or appointment_starts_at > now() + interval '180 days' then
    raise exception 'Appointment time is outside the allowed booking window';
  end if;
  if appointment_ends_at <= appointment_starts_at or appointment_ends_at > appointment_starts_at + interval '8 hours' then
    raise exception 'Appointment duration is invalid';
  end if;
  if char_length(trim(appointment_title)) not between 2 and 160 then raise exception 'Appointment title is invalid'; end if;
  if char_length(trim(customer_phone)) not between 8 and 30 then raise exception 'Customer phone is invalid'; end if;

  select * into target_call from public.calls
  where account_id = target_account_id and provider = 'retell' and provider_call_id = target_provider_call_id;
  if not found then raise exception 'Verified call not found'; end if;
  select created_by into actor_id from public.accounts where id = target_account_id;
  external_reference := target_provider_call_id || ':' || appointment_starts_at::text;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_account_id::text || external_reference, 0));

  select id into target_appointment_id from public.appointments
  where account_id = target_account_id and external_source = 'retell' and external_id = external_reference;
  if target_appointment_id is not null then return target_appointment_id; end if;

  select id into target_contact_id from public.contacts
  where account_id = target_account_id and phone = trim(customer_phone)
  order by created_at limit 1;
  if target_contact_id is null then
    insert into public.contacts (account_id, assigned_to, first_name, last_name, phone, source, created_by)
    values (
      target_account_id,
      target_call.assigned_to,
      coalesce(nullif(split_part(normalized_name, ' ', 1), ''), 'Caller'),
      nullif(trim(substr(normalized_name, length(split_part(normalized_name, ' ', 1)) + 1)), ''),
      trim(customer_phone),
      'ai_receptionist',
      actor_id
    ) returning id into target_contact_id;
  end if;

  insert into public.appointments (
    account_id, contact_id, assigned_to, title, starts_at, ends_at, status, notes,
    created_by, external_source, external_id
  ) values (
    target_account_id, target_contact_id, target_call.assigned_to, trim(appointment_title),
    appointment_starts_at, appointment_ends_at, 'scheduled', nullif(trim(coalesce(appointment_notes, '')), ''),
    actor_id, 'retell', external_reference
  ) returning id into target_appointment_id;

  update public.calls set contact_id = target_contact_id, disposition = 'Appointment booked'
  where id = target_call.id;
  return target_appointment_id;
end;
$$;
revoke all on function public.book_receptionist_appointment(uuid,text,text,text,text,timestamptz,timestamptz,text) from public, anon, authenticated;
grant execute on function public.book_receptionist_appointment(uuid,text,text,text,text,timestamptz,timestamptz,text) to service_role;
