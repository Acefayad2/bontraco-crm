-- Repeatable proposal-logo path, storage role, and public-listing checks. Fixtures roll back.
begin;

insert into auth.users (id, email, aud, role, created_at, updated_at) values
  ('f1000000-0000-4000-8000-000000000001', 'logo-owner@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('f1000000-0000-4000-8000-000000000002', 'logo-admin@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('f1000000-0000-4000-8000-000000000003', 'logo-sales@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('f1000000-0000-4000-8000-000000000004', 'logo-outsider@example.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.accounts (id, name, slug, trades, created_by) values
  (
    'f2000000-0000-4000-8000-000000000001', 'Logo Company', 'bontraco-logo-company',
    array['roofing']::public.bontraco_trade[], 'f1000000-0000-4000-8000-000000000001'
  ),
  (
    'f2000000-0000-4000-8000-000000000002', 'Other Logo Company',
    'bontraco-logo-company-other', array['plumbing']::public.bontraco_trade[],
    'f1000000-0000-4000-8000-000000000004'
  );

insert into public.memberships (account_id, user_id, role, display_name, email) values
  ('f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 'owner', 'Logo Owner', 'logo-owner@example.invalid'),
  ('f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002', 'admin', 'Logo Admin', 'logo-admin@example.invalid'),
  ('f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000003', 'sales', 'Logo Sales', 'logo-sales@example.invalid'),
  ('f2000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000004', 'owner', 'Other Logo Owner', 'logo-outsider@example.invalid');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000001', true);

update public.accounts
set proposal_logo_path =
  'f2000000-0000-4000-8000-000000000001/branding/f9000000-0000-4000-8000-000000000001'
where id = 'f2000000-0000-4000-8000-000000000001';

insert into storage.objects (id, bucket_id, name, owner, owner_id)
values (
  'f8000000-0000-4000-8000-000000000001',
  'bontraco-branding',
  'f2000000-0000-4000-8000-000000000001/branding/f9000000-0000-4000-8000-000000000001',
  'f1000000-0000-4000-8000-000000000001',
  'f1000000-0000-4000-8000-000000000001'
);

do $$
declare denied boolean := false;
begin
  if (select count(*) from storage.objects where bucket_id = 'bontraco-branding') <> 1
  then raise exception 'Owner cannot read the workspace branding object'; end if;
  begin
    update public.accounts
    set proposal_logo_path =
      'f2000000-0000-4000-8000-000000000002/branding/f9000000-0000-4000-8000-000000000002'
    where id = 'f2000000-0000-4000-8000-000000000001';
  exception when check_violation then denied := true;
  end;
  if not denied then raise exception 'Cross-workspace logo path was accepted'; end if;
end $$;

select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000002', true);
update public.accounts set proposal_logo_path = null
where id = 'f2000000-0000-4000-8000-000000000001';

select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000003', true);
do $$
declare account_denied boolean := false; object_denied boolean := false;
begin
  begin
    update public.accounts
    set proposal_logo_path =
      'f2000000-0000-4000-8000-000000000001/branding/f9000000-0000-4000-8000-000000000003'
    where id = 'f2000000-0000-4000-8000-000000000001';
  exception when others then account_denied := true;
  end;
  begin
    insert into storage.objects (id, bucket_id, name, owner, owner_id)
    values (
      'f8000000-0000-4000-8000-000000000002', 'bontraco-branding',
      'f2000000-0000-4000-8000-000000000001/branding/f9000000-0000-4000-8000-000000000003',
      'f1000000-0000-4000-8000-000000000003',
      'f1000000-0000-4000-8000-000000000003'
    );
  exception when others then object_denied := true;
  end;
  if not account_denied and exists (
    select 1 from public.accounts
    where id = 'f2000000-0000-4000-8000-000000000001'
      and proposal_logo_path is not null
  ) then raise exception 'Sales user changed the proposal logo'; end if;
  if not object_denied then raise exception 'Sales user uploaded a branding object'; end if;
  if (select count(*) from storage.objects where bucket_id = 'bontraco-branding') <> 0
  then raise exception 'Sales user listed manager-only branding metadata'; end if;
end $$;

reset role;
set local role anon;
do $$ begin
  if (select count(*) from storage.objects where bucket_id = 'bontraco-branding') <> 0
  then raise exception 'Anonymous user listed public branding metadata'; end if;
end $$;

reset role;
rollback;
select 'bontraco_proposal_logo_branding_passed' as result;
