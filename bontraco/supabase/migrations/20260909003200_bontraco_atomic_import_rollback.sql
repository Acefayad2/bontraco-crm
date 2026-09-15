-- Keep user-requested and failure-cleanup import rollback all-or-nothing.

create or replace function public.rollback_bontraco_import(
  target_account_id uuid,
  target_batch_id uuid,
  target_actor_id uuid,
  final_status text default 'rolled_back'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  batch_status text;
  job_count integer;
  property_count integer;
  contact_count integer;
begin
  if final_status not in ('rolled_back', 'failed') then
    raise exception 'Invalid import rollback status';
  end if;
  if not exists (
    select 1 from public.memberships m
    where m.account_id = target_account_id
      and m.user_id = target_actor_id
      and m.active
      and m.role in ('owner', 'admin')
  ) then
    raise exception 'Active owner or administrator required';
  end if;

  select b.status into batch_status
  from public.data_import_batches b
  where b.account_id = target_account_id and b.id = target_batch_id
  for update;
  if batch_status is null then raise exception 'Import batch not found'; end if;
  if batch_status not in ('running', 'completed', 'failed') then
    raise exception 'Import batch cannot be rolled back from status %', batch_status;
  end if;

  select count(*) into job_count from public.data_import_records r
  where r.account_id = target_account_id and r.batch_id = target_batch_id and r.target_table = 'jobs';
  select count(*) into property_count from public.data_import_records r
  where r.account_id = target_account_id and r.batch_id = target_batch_id and r.target_table = 'properties';
  select count(*) into contact_count from public.data_import_records r
  where r.account_id = target_account_id and r.batch_id = target_batch_id and r.target_table = 'contacts';

  delete from public.jobs j
  where j.account_id = target_account_id
    and exists (
      select 1 from public.data_import_records r
      where r.account_id = target_account_id
        and r.batch_id = target_batch_id
        and r.target_table = 'jobs'
        and r.target_id = j.id
    );
  delete from public.properties p
  where p.account_id = target_account_id
    and exists (
      select 1 from public.data_import_records r
      where r.account_id = target_account_id
        and r.batch_id = target_batch_id
        and r.target_table = 'properties'
        and r.target_id = p.id
    );
  delete from public.contacts c
  where c.account_id = target_account_id
    and exists (
      select 1 from public.data_import_records r
      where r.account_id = target_account_id
        and r.batch_id = target_batch_id
        and r.target_table = 'contacts'
        and r.target_id = c.id
    );

  delete from public.data_import_records r
  where r.account_id = target_account_id and r.batch_id = target_batch_id;
  update public.data_import_batches b
  set status = final_status,
      rolled_back_at = case when final_status = 'rolled_back' then now() else b.rolled_back_at end
  where b.account_id = target_account_id and b.id = target_batch_id;
  insert into public.activities (account_id, actor_id, kind, summary, metadata)
  values (
    target_account_id,
    target_actor_id,
    case when final_status = 'rolled_back' then 'prototype_import_rolled_back' else 'prototype_import_failed' end,
    case when final_status = 'rolled_back'
      then 'Prototype CRM import rolled back'
      else 'Prototype CRM import failed and created records were removed'
    end,
    jsonb_build_object(
      'batch_id', target_batch_id,
      'removed', jsonb_build_object('contacts', contact_count, 'properties', property_count, 'jobs', job_count)
    )
  );
  return jsonb_build_object('contacts', contact_count, 'properties', property_count, 'jobs', job_count);
end;
$$;

revoke all on function public.rollback_bontraco_import(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.rollback_bontraco_import(uuid, uuid, uuid, text) to service_role;
