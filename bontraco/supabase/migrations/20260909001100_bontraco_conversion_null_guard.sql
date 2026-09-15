-- Treat a NULL assignment check as denied inside the security-definer conversion RPC.

create or replace function public.convert_bontraco_lead(
  target_account_id uuid,
  target_lead_id uuid,
  customer_first_name text,
  customer_last_name text default null,
  job_title text default null,
  job_estimated_value numeric default null
)
returns table (contact_id uuid, job_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  source_lead public.leads%rowtype;
  existing_job_id uuid;
  new_contact_id uuid;
  new_job_id uuid;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;
  if nullif(trim(customer_first_name), '') is null then
    raise exception 'Customer first name is required';
  end if;
  if job_estimated_value is not null and job_estimated_value < 0 then
    raise exception 'Estimated value cannot be negative';
  end if;

  select * into source_lead
  from public.leads l
  where l.account_id = target_account_id and l.id = target_lead_id
  for update;

  if not found then
    raise exception 'Lead not found';
  end if;
  if public.can_access_assigned_record(source_lead.account_id, source_lead.assigned_to) is not true then
    raise exception 'Lead access denied';
  end if;

  select j.id into existing_job_id
  from public.jobs j
  where j.account_id = target_account_id and j.lead_id = target_lead_id
  order by j.created_at
  limit 1;

  if existing_job_id is not null then
    return query select source_lead.contact_id, existing_job_id;
    return;
  end if;

  new_contact_id := source_lead.contact_id;
  if new_contact_id is null then
    insert into public.contacts (
      account_id, assigned_to, first_name, last_name, email, phone, source, created_by
    ) values (
      source_lead.account_id,
      source_lead.assigned_to,
      trim(customer_first_name),
      nullif(trim(coalesce(customer_last_name, '')), ''),
      source_lead.contact_email,
      source_lead.contact_phone,
      source_lead.source,
      actor_id
    ) returning id into new_contact_id;
  end if;

  update public.leads
  set contact_id = new_contact_id, status = 'won'
  where account_id = target_account_id and id = target_lead_id;

  insert into public.jobs (
    account_id, contact_id, lead_id, assigned_to, title, trade, stage, status,
    estimated_value, created_by
  ) values (
    source_lead.account_id,
    new_contact_id,
    source_lead.id,
    source_lead.assigned_to,
    coalesce(nullif(trim(coalesce(job_title, '')), ''), source_lead.title),
    source_lead.trade,
    'new',
    'open',
    job_estimated_value,
    actor_id
  ) returning id into new_job_id;

  return query select new_contact_id, new_job_id;
end;
$$;

revoke all on function public.convert_bontraco_lead(uuid, uuid, text, text, text, numeric) from public;
revoke execute on function public.convert_bontraco_lead(uuid, uuid, text, text, text, numeric) from anon;
grant execute on function public.convert_bontraco_lead(uuid, uuid, text, text, text, numeric) to authenticated;
