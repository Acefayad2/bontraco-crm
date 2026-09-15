-- Public proposal branding with tenant-controlled writes and frozen estimate references.
alter table public.accounts
  add column proposal_logo_path text,
  add constraint accounts_proposal_logo_path_format check (
    proposal_logo_path is null
    or proposal_logo_path ~ (
      '^' || id::text ||
      '/branding/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    )
  );

comment on column public.accounts.proposal_logo_path is
  'Public branding object path. Prior objects remain available for frozen proposal snapshots.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bontraco-branding',
  'bontraco-branding',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy bontraco_branding_object_select_manager
on storage.objects for select to authenticated
using (
  bucket_id = 'bontraco-branding'
  and name ~ '^[0-9a-f-]{36}/branding/[0-9a-f-]{36}$'
  and public.has_account_role(
    split_part(name, '/', 1)::uuid,
    array['owner', 'admin']::public.bontraco_member_role[]
  )
);

create policy bontraco_branding_object_insert_manager
on storage.objects for insert to authenticated
with check (
  bucket_id = 'bontraco-branding'
  and name ~ '^[0-9a-f-]{36}/branding/[0-9a-f-]{36}$'
  and public.has_account_role(
    split_part(name, '/', 1)::uuid,
    array['owner', 'admin']::public.bontraco_member_role[]
  )
);

create policy bontraco_branding_object_update_manager
on storage.objects for update to authenticated
using (
  bucket_id = 'bontraco-branding'
  and name ~ '^[0-9a-f-]{36}/branding/[0-9a-f-]{36}$'
  and public.has_account_role(
    split_part(name, '/', 1)::uuid,
    array['owner', 'admin']::public.bontraco_member_role[]
  )
)
with check (
  bucket_id = 'bontraco-branding'
  and name ~ '^[0-9a-f-]{36}/branding/[0-9a-f-]{36}$'
  and public.has_account_role(
    split_part(name, '/', 1)::uuid,
    array['owner', 'admin']::public.bontraco_member_role[]
  )
);

create policy bontraco_branding_object_delete_manager
on storage.objects for delete to authenticated
using (
  bucket_id = 'bontraco-branding'
  and name ~ '^[0-9a-f-]{36}/branding/[0-9a-f-]{36}$'
  and public.has_account_role(
    split_part(name, '/', 1)::uuid,
    array['owner', 'admin']::public.bontraco_member_role[]
  )
);

create or replace function private.freeze_estimate_proposal_logo()
returns trigger
language plpgsql
set search_path = ''
as $$
declare logo_path text;
begin
  select proposal_logo_path into logo_path
  from public.accounts
  where id = new.account_id;
  if logo_path is not null then
    new.document_snapshot := jsonb_set(
      new.document_snapshot,
      '{company,logo_path}',
      to_jsonb(logo_path),
      true
    );
  end if;
  return new;
end;
$$;

create trigger estimate_share_tokens_freeze_logo
before insert on private.estimate_share_tokens
for each row execute function private.freeze_estimate_proposal_logo();

revoke all on function private.freeze_estimate_proposal_logo()
from public, anon, authenticated;
