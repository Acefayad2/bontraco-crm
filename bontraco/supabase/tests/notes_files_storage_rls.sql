-- Repeatable notes, file metadata, and private Storage isolation checks. Fixtures always roll back.
begin;

insert into auth.users (id,email,aud,role,created_at,updated_at) values
('1c300000-0000-0000-0000-000000000001','files-owner@example.invalid','authenticated','authenticated',now(),now()),
('1c300000-0000-0000-0000-000000000002','files-sales@example.invalid','authenticated','authenticated',now(),now()),
('1c300000-0000-0000-0000-000000000003','files-other@example.invalid','authenticated','authenticated',now(),now()),
('1c300000-0000-0000-0000-000000000004','files-outside@example.invalid','authenticated','authenticated',now(),now());

insert into public.accounts (id,name,slug,trades,created_by) values
('2c300000-0000-0000-0000-000000000001','Private Files One','bontraco-private-files-one',array['roofing']::public.bontraco_trade[],'1c300000-0000-0000-0000-000000000001'),
('2c300000-0000-0000-0000-000000000002','Private Files Two','bontraco-private-files-two',array['plumbing']::public.bontraco_trade[],'1c300000-0000-0000-0000-000000000004');

insert into public.memberships (account_id,user_id,role,display_name,email) values
('2c300000-0000-0000-0000-000000000001','1c300000-0000-0000-0000-000000000001','owner','Files Owner','files-owner@example.invalid'),
('2c300000-0000-0000-0000-000000000001','1c300000-0000-0000-0000-000000000002','sales','Files Sales','files-sales@example.invalid'),
('2c300000-0000-0000-0000-000000000001','1c300000-0000-0000-0000-000000000003','sales','Files Other','files-other@example.invalid'),
('2c300000-0000-0000-0000-000000000002','1c300000-0000-0000-0000-000000000004','owner','Files Outside','files-outside@example.invalid');

insert into public.contacts (id,account_id,assigned_to,first_name,created_by) values
('3c300000-0000-0000-0000-000000000001','2c300000-0000-0000-0000-000000000001','1c300000-0000-0000-0000-000000000002','Assigned','1c300000-0000-0000-0000-000000000001'),
('3c300000-0000-0000-0000-000000000002','2c300000-0000-0000-0000-000000000001','1c300000-0000-0000-0000-000000000003','Other','1c300000-0000-0000-0000-000000000001');

insert into public.jobs (id,account_id,contact_id,assigned_to,title,trade,created_by) values
('4c300000-0000-0000-0000-000000000001','2c300000-0000-0000-0000-000000000001','3c300000-0000-0000-0000-000000000001','1c300000-0000-0000-0000-000000000002','Assigned private job','roofing','1c300000-0000-0000-0000-000000000001'),
('4c300000-0000-0000-0000-000000000002','2c300000-0000-0000-0000-000000000001','3c300000-0000-0000-0000-000000000002','1c300000-0000-0000-0000-000000000003','Other private job','roofing','1c300000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub','1c300000-0000-0000-0000-000000000002',true);

insert into public.notes (id,account_id,job_id,body,created_by) values
('5c300000-0000-0000-0000-000000000001','2c300000-0000-0000-0000-000000000001','4c300000-0000-0000-0000-000000000001','Assigned job note','1c300000-0000-0000-0000-000000000002');

insert into storage.objects (id,bucket_id,name,owner_id) values
('6c300000-0000-0000-0000-000000000001','bontraco-files','2c300000-0000-0000-0000-000000000001/4c300000-0000-0000-0000-000000000001/inspection.txt','1c300000-0000-0000-0000-000000000002');
insert into public.files (id,account_id,job_id,storage_path,original_name,content_type,byte_size,created_by) values
('7c300000-0000-0000-0000-000000000001','2c300000-0000-0000-0000-000000000001','4c300000-0000-0000-0000-000000000001','2c300000-0000-0000-0000-000000000001/4c300000-0000-0000-0000-000000000001/inspection.txt','inspection.txt','text/plain',12,'1c300000-0000-0000-0000-000000000002');

insert into storage.objects (id,bucket_id,name,owner_id) values
('6c300000-0000-0000-0000-000000000002','bontraco-files','2c300000-0000-0000-0000-000000000001/4c300000-0000-0000-0000-000000000001/cleanup.txt','1c300000-0000-0000-0000-000000000002');

do $$
declare cleanup_authorized boolean := false;
begin
  begin
    delete from storage.objects where id = '6c300000-0000-0000-0000-000000000002';
  exception when insufficient_privilege then
    cleanup_authorized := sqlerrm like 'Direct deletion from storage tables is not allowed%';
  end;
  if not cleanup_authorized then
    raise exception 'Uploader did not reach the Storage API deletion guard for orphan cleanup';
  end if;
end $$;

do $$
declare denied boolean := false;
begin
  begin
    insert into storage.objects (bucket_id,name,owner_id) values
    ('bontraco-files','2c300000-0000-0000-0000-000000000001/4c300000-0000-0000-0000-000000000002/forbidden.txt','1c300000-0000-0000-0000-000000000002');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Sales uploaded to another representative job'; end if;

  denied := false;
  begin
    insert into storage.objects (bucket_id,name,owner_id) values
    ('bontraco-files','2c300000-0000-0000-0000-000000000001/not-a-job/orphan.txt','1c300000-0000-0000-0000-000000000002');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Malformed job path was accepted'; end if;

  denied := false;
  begin
    insert into public.notes (account_id,job_id,body,created_by) values
    ('2c300000-0000-0000-0000-000000000001','4c300000-0000-0000-0000-000000000002','Forbidden note','1c300000-0000-0000-0000-000000000002');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Sales added a note to another representative job'; end if;
end $$;

do $$ begin
  if (select count(*) from public.notes where id = '5c300000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'Assigned sales cannot read their note';
  end if;
  if (select count(*) from public.files where id = '7c300000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'Assigned sales cannot read their file metadata';
  end if;
  if (select count(*) from storage.objects where id = '6c300000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'Assigned sales cannot authorize their private object';
  end if;
end $$;

select set_config('request.jwt.claim.sub','1c300000-0000-0000-0000-000000000003',true);
do $$ begin
  if exists (select 1 from public.notes where id = '5c300000-0000-0000-0000-000000000001')
    or exists (select 1 from public.files where id = '7c300000-0000-0000-0000-000000000001')
    or exists (select 1 from storage.objects where id = '6c300000-0000-0000-0000-000000000001') then
    raise exception 'Unassigned sales could read private collaboration data';
  end if;
end $$;

select set_config('request.jwt.claim.sub','1c300000-0000-0000-0000-000000000004',true);
do $$ begin
  if exists (select 1 from public.notes where id = '5c300000-0000-0000-0000-000000000001')
    or exists (select 1 from public.files where id = '7c300000-0000-0000-0000-000000000001')
    or exists (select 1 from storage.objects where id = '6c300000-0000-0000-0000-000000000001') then
    raise exception 'Outside tenant could read private collaboration data';
  end if;
end $$;

select set_config('request.jwt.claim.sub','1c300000-0000-0000-0000-000000000001',true);
do $$ begin
  if (select count(*) from public.notes where id = '5c300000-0000-0000-0000-000000000001') <> 1
    or (select count(*) from public.files where id = '7c300000-0000-0000-0000-000000000001') <> 1
    or (select count(*) from storage.objects where id = '6c300000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'Workspace owner cannot inspect private collaboration data';
  end if;
end $$;

reset role;
rollback;
select 'bontraco_notes_files_storage_rls_passed' as result;
