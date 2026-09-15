-- Service-only, idempotent bridge from the preserved legacy snapshot into one
-- owner-controlled Bontraco workspace.
create or replace function public.import_bontraco_legacy_leads(
  target_account_id uuid,
  target_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  available_count integer;
  inserted_count integer;
begin
  if not exists (
    select 1
    from public.memberships m
    where m.account_id = target_account_id
      and m.user_id = target_actor_id
      and m.role = 'owner'
      and m.active
  ) then
    raise exception 'An active workspace owner is required';
  end if;

  select count(*) into available_count
  from bontraco_legacy.snapshot_crm_leads;

  insert into public.leads (
    account_id,
    title,
    status,
    trade,
    source,
    source_url,
    source_external_id,
    source_posted_at,
    discovered_at,
    last_verified_at,
    contact_name,
    contact_phone,
    contact_email,
    location_text,
    score,
    qualification_reason,
    evidence,
    dedup_key
  )
  select
    target_account_id,
    left(coalesce(nullif(trim(l.title), ''), 'Imported legacy lead'), 240),
    case lower(coalesce(l.status, ''))
      when 'qualified' then 'qualified'
      when 'contacted' then 'contacted'
      when 'converted' then 'won'
      when 'rejected' then 'lost'
      else 'new'
    end,
    case
      when coalesce(l.service, '') ~* 'plumb|pipe|sewer|drain|water' then 'plumbing'::public.bontraco_trade
      when coalesce(l.service, '') ~* 'electric|panel|wire|power|lighting' then 'electrical'::public.bontraco_trade
      when coalesce(l.service, '') ~* 'roof|gutter|siding|exterior' then 'roofing'::public.bontraco_trade
      else 'general'::public.bontraco_trade
    end,
    left('legacy_' || coalesce(nullif(lower(trim(l.source)), ''), 'prototype'), 120),
    nullif(left(trim(coalesce(l.url, '')), 2000), ''),
    left(l.id, 240),
    l.posted_at,
    coalesce(l.discovered_at, l.created_at, now()),
    coalesce(l.updated_at, l.discovered_at, l.created_at, now()),
    nullif(left(trim(coalesce(l.contact_name, '')), 160), ''),
    nullif(left(trim(coalesce(l.contact_phone, '')), 40), ''),
    nullif(left(lower(trim(coalesce(l.contact_email, ''))), 254), ''),
    nullif(left(trim(coalesce(l.location, '')), 300), ''),
    greatest(0, least(100, coalesce(l.score, 0)))::smallint,
    'Imported from the preserved pre-Bontraco lead snapshot.',
    jsonb_build_object(
      'provider', 'legacy_snapshot',
      'legacy_source', l.source,
      'legacy_urgency', l.urgency,
      'imported_at', now()
    ),
    'legacy:' || md5(l.account_id::text || ':' || l.id)
  from bontraco_legacy.snapshot_crm_leads l
  on conflict (account_id, dedup_key) do nothing;

  get diagnostics inserted_count = row_count;

  insert into public.activities (account_id, actor_id, kind, summary, metadata)
  values (
    target_account_id,
    target_actor_id,
    'legacy_leads_imported',
    'Imported preserved legacy leads',
    jsonb_build_object(
      'available', available_count,
      'inserted', inserted_count,
      'duplicates', available_count - inserted_count
    )
  );

  return jsonb_build_object(
    'available', available_count,
    'inserted', inserted_count,
    'duplicates', available_count - inserted_count
  );
end;
$$;

revoke execute on function public.import_bontraco_legacy_leads(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.import_bontraco_legacy_leads(uuid, uuid)
to service_role;
