-- Private, tenant-safe notes and file metadata for CRM records.

create or replace function public.can_access_bontraco_entity(
  target_account_id uuid,
  target_contact_id uuid default null,
  target_lead_id uuid default null,
  target_job_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when target_contact_id is not null then exists (
      select 1 from public.contacts c
      where c.account_id = target_account_id and c.id = target_contact_id
        and public.can_access_assigned_record(c.account_id, c.assigned_to)
    )
    when target_lead_id is not null then exists (
      select 1 from public.leads l
      where l.account_id = target_account_id and l.id = target_lead_id
        and public.can_access_assigned_record(l.account_id, l.assigned_to)
    )
    when target_job_id is not null then exists (
      select 1 from public.jobs j
      where j.account_id = target_account_id and j.id = target_job_id
        and public.can_access_assigned_record(j.account_id, j.assigned_to)
    )
    else false
  end;
$$;

revoke all on function public.can_access_bontraco_entity(uuid, uuid, uuid, uuid) from public;
revoke execute on function public.can_access_bontraco_entity(uuid, uuid, uuid, uuid) from anon;
grant execute on function public.can_access_bontraco_entity(uuid, uuid, uuid, uuid) to authenticated;

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  contact_id uuid,
  lead_id uuid,
  job_id uuid,
  body text not null check (char_length(trim(body)) between 1 and 10000),
  pinned boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notes_one_parent check (num_nonnulls(contact_id, lead_id, job_id) = 1),
  constraint notes_account_contact_fkey foreign key (account_id, contact_id)
    references public.contacts(account_id, id) on delete cascade,
  constraint notes_account_lead_fkey foreign key (account_id, lead_id)
    references public.leads(account_id, id) on delete cascade,
  constraint notes_account_job_fkey foreign key (account_id, job_id)
    references public.jobs(account_id, id) on delete cascade
);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  contact_id uuid,
  lead_id uuid,
  job_id uuid,
  storage_path text not null unique,
  original_name text not null check (char_length(original_name) between 1 and 255),
  content_type text,
  byte_size bigint not null check (byte_size between 0 and 26214400),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint files_one_parent check (num_nonnulls(contact_id, lead_id, job_id) = 1),
  constraint files_account_contact_fkey foreign key (account_id, contact_id)
    references public.contacts(account_id, id) on delete cascade,
  constraint files_account_lead_fkey foreign key (account_id, lead_id)
    references public.leads(account_id, id) on delete cascade,
  constraint files_account_job_fkey foreign key (account_id, job_id)
    references public.jobs(account_id, id) on delete cascade
);

create index notes_account_contact_idx on public.notes (account_id, contact_id, created_at desc) where contact_id is not null;
create index notes_account_lead_idx on public.notes (account_id, lead_id, created_at desc) where lead_id is not null;
create index notes_account_job_idx on public.notes (account_id, job_id, created_at desc) where job_id is not null;
create index notes_created_by_idx on public.notes (created_by);
create index files_account_contact_idx on public.files (account_id, contact_id, created_at desc) where contact_id is not null;
create index files_account_lead_idx on public.files (account_id, lead_id, created_at desc) where lead_id is not null;
create index files_account_job_idx on public.files (account_id, job_id, created_at desc) where job_id is not null;
create index files_created_by_idx on public.files (created_by);

create trigger notes_touch_updated_at before update on public.notes
for each row execute function public.touch_updated_at();

alter table public.notes enable row level security;
alter table public.files enable row level security;

create policy notes_select_visible on public.notes for select to authenticated
using (public.can_access_bontraco_entity(account_id, contact_id, lead_id, job_id));
create policy notes_insert_visible on public.notes for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.can_access_bontraco_entity(account_id, contact_id, lead_id, job_id)
);
create policy notes_update_author on public.notes for update to authenticated
using (
  public.can_access_bontraco_entity(account_id, contact_id, lead_id, job_id)
  and (
    created_by = (select auth.uid())
    or public.has_account_role(account_id, array['owner', 'admin']::public.bontraco_member_role[])
  )
)
with check (public.can_access_bontraco_entity(account_id, contact_id, lead_id, job_id));
create policy notes_delete_author on public.notes for delete to authenticated
using (
  public.can_access_bontraco_entity(account_id, contact_id, lead_id, job_id)
  and (
    created_by = (select auth.uid())
    or public.has_account_role(account_id, array['owner', 'admin']::public.bontraco_member_role[])
  )
);

create policy files_select_visible on public.files for select to authenticated
using (public.can_access_bontraco_entity(account_id, contact_id, lead_id, job_id));
create policy files_insert_visible on public.files for insert to authenticated
with check (
  created_by = (select auth.uid())
  and storage_path like account_id::text || '/%'
  and public.can_access_bontraco_entity(account_id, contact_id, lead_id, job_id)
);
create policy files_delete_author on public.files for delete to authenticated
using (
  public.can_access_bontraco_entity(account_id, contact_id, lead_id, job_id)
  and (
    created_by = (select auth.uid())
    or public.has_account_role(account_id, array['owner', 'admin']::public.bontraco_member_role[])
  )
);

grant select, insert, update, delete on public.notes to authenticated;
grant select, insert, delete on public.files to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bontraco-files',
  'bontraco-files',
  false,
  26214400,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy bontraco_files_object_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'bontraco-files'
  and public.is_account_member(((storage.foldername(name))[1])::uuid)
);

create policy bontraco_files_object_select on storage.objects for select to authenticated
using (
  bucket_id = 'bontraco-files'
  and exists (
    select 1 from public.files f
    where f.storage_path = name
      and public.can_access_bontraco_entity(f.account_id, f.contact_id, f.lead_id, f.job_id)
  )
);

create policy bontraco_files_object_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'bontraco-files'
  and exists (
    select 1 from public.files f
    where f.storage_path = name
      and (
        f.created_by = (select auth.uid())
        or public.has_account_role(f.account_id, array['owner', 'admin']::public.bontraco_member_role[])
      )
  )
);
