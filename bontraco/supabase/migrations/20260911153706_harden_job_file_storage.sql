-- Restrict private uploads to a visible job and permit uploader cleanup after metadata failure.

drop policy bontraco_files_object_insert on storage.objects;
create policy bontraco_files_object_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'bontraco-files'
  and cardinality(storage.foldername(name)) = 2
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then public.can_access_bontraco_entity(
      ((storage.foldername(name))[1])::uuid,
      null,
      null,
      ((storage.foldername(name))[2])::uuid
    )
    else false
  end
);

drop policy bontraco_files_object_delete on storage.objects;
create policy bontraco_files_object_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'bontraco-files'
  and (
    owner_id = (select auth.uid()::text)
    or exists (
      select 1 from public.files f
      where f.storage_path = name
        and (
          f.created_by = (select auth.uid())
          or public.has_account_role(
            f.account_id,
            array['owner', 'admin']::public.bontraco_member_role[]
          )
        )
    )
  )
);
