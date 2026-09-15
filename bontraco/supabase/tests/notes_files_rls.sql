-- Repeatable notes/file-metadata isolation check. Fixtures always roll back.

begin;

insert into auth.users (id, email, aud, role, created_at, updated_at) values
  ('11000000-0000-0000-0000-000000000001', 'notes-owner@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('11000000-0000-0000-0000-000000000002', 'notes-sales@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('11000000-0000-0000-0000-000000000003', 'notes-outsider@example.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.accounts (id, name, slug, trades, created_by) values
  ('21000000-0000-0000-0000-000000000001', 'Notes Test One', 'bontraco-notes-test-one', array['roofing']::public.bontraco_trade[], '11000000-0000-0000-0000-000000000001'),
  ('21000000-0000-0000-0000-000000000002', 'Notes Test Two', 'bontraco-notes-test-two', array['plumbing']::public.bontraco_trade[], '11000000-0000-0000-0000-000000000003');

insert into public.memberships (account_id, user_id, role, display_name, email) values
  ('21000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'owner', 'Notes Owner', 'notes-owner@example.invalid'),
  ('21000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002', 'sales', 'Notes Sales', 'notes-sales@example.invalid'),
  ('21000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000003', 'owner', 'Notes Outsider', 'notes-outsider@example.invalid');

insert into public.contacts (id, account_id, assigned_to, first_name, created_by) values
  ('31000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002', 'Assigned', '11000000-0000-0000-0000-000000000001'),
  ('31000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000001', null, 'Unassigned', '11000000-0000-0000-0000-000000000001');

insert into public.jobs (id, account_id, contact_id, assigned_to, title, trade, created_by) values
  ('41000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002', 'Assigned job', 'roofing', '11000000-0000-0000-0000-000000000001'),
  ('41000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000002', null, 'Unassigned job', 'roofing', '11000000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000002', true);

insert into public.notes (id, account_id, job_id, body, created_by)
values ('51000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 'Assigned note', '11000000-0000-0000-0000-000000000002');

insert into public.files (id, account_id, job_id, storage_path, original_name, byte_size, created_by)
values ('61000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001/41000000-0000-0000-0000-000000000001/test.pdf', 'test.pdf', 100, '11000000-0000-0000-0000-000000000002');

do $$
declare denied_note boolean := false; denied_file boolean := false;
begin
  if (select count(*) from public.notes where id = '51000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'Assigned salesperson cannot read their note';
  end if;
  begin
    insert into public.notes (account_id, job_id, body, created_by)
    values ('21000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000002', 'Forbidden note', '11000000-0000-0000-0000-000000000002');
  exception when others then denied_note := true;
  end;
  begin
    insert into public.files (account_id, job_id, storage_path, original_name, byte_size, created_by)
    values ('21000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000002/wrong/test.pdf', 'test.pdf', 100, '11000000-0000-0000-0000-000000000002');
  exception when others then denied_file := true;
  end;
  if not denied_note then raise exception 'Salesperson wrote to an unassigned job'; end if;
  if not denied_file then raise exception 'Cross-account storage path was accepted'; end if;
end
$$;

select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000003', true);

do $$
begin
  if (select count(*) from public.notes where id = '51000000-0000-0000-0000-000000000001') <> 0 then
    raise exception 'Outside tenant read a private note';
  end if;
  if (select count(*) from public.files where id = '61000000-0000-0000-0000-000000000001') <> 0 then
    raise exception 'Outside tenant read private file metadata';
  end if;
end
$$;

reset role;
rollback;
select 'bontraco_notes_files_rls_passed' as result;
