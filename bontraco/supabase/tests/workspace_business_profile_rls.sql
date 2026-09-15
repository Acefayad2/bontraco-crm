-- Repeatable workspace-profile validation and RLS checks. Fixtures always roll back.
begin;

insert into auth.users (id, email, aud, role, created_at, updated_at) values
  ('1d000000-0000-4000-8000-000000000001', 'profile-owner@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('1d000000-0000-4000-8000-000000000002', 'profile-admin@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('1d000000-0000-4000-8000-000000000003', 'profile-sales@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('1d000000-0000-4000-8000-000000000004', 'profile-outsider@example.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.accounts (id, name, slug, trades, created_by) values
  ('2d000000-0000-4000-8000-000000000001', ' Profile Company ', 'bontraco-profile-company', array['roofing']::public.bontraco_trade[], '1d000000-0000-4000-8000-000000000001'),
  ('2d000000-0000-4000-8000-000000000002', 'Other Profile Company', 'bontraco-profile-other', array['plumbing']::public.bontraco_trade[], '1d000000-0000-4000-8000-000000000004');

insert into public.memberships (account_id, user_id, role, display_name, email) values
  ('2d000000-0000-4000-8000-000000000001', '1d000000-0000-4000-8000-000000000001', 'owner', 'Profile Owner', 'profile-owner@example.invalid'),
  ('2d000000-0000-4000-8000-000000000001', '1d000000-0000-4000-8000-000000000002', 'admin', 'Profile Admin', 'profile-admin@example.invalid'),
  ('2d000000-0000-4000-8000-000000000001', '1d000000-0000-4000-8000-000000000003', 'sales', 'Profile Sales', 'profile-sales@example.invalid'),
  ('2d000000-0000-4000-8000-000000000002', '1d000000-0000-4000-8000-000000000004', 'owner', 'Profile Outsider', 'profile-outsider@example.invalid');

set local role authenticated;
select set_config('request.jwt.claim.sub', '1d000000-0000-4000-8000-000000000001', true);

do $$ begin
  if (
    select name <> 'Profile Company'
      or legal_name <> 'Profile Company'
      or proposal_accent_color <> '#0F5B4F'
      or estimate_default_tax_rate <> 0
      or estimate_default_valid_days <> 30
    from public.accounts where id = '2d000000-0000-4000-8000-000000000001'
  ) then raise exception 'Account profile defaults were not normalized'; end if;
end $$;

update public.accounts set
  legal_name = ' Profile Company Holdings LLC ',
  timezone = 'America/Indiana/Indianapolis',
  service_area = ' Cook, DuPage, and Lake Counties ',
  business_hours = ' Monday-Friday 7:00 AM-6:00 PM ',
  emergency_rules = ' Transfer active leaks and safety hazards to the on-call manager. ',
  business_phone = ' (312) 555-0199 ',
  business_email = ' SALES@PROFILE.EXAMPLE ',
  business_website = ' https://profile.example/estimates ',
  proposal_accent_color = ' #1d4ed8 ',
  estimate_default_tax_rate = 0.0825,
  estimate_default_valid_days = 21,
  estimate_default_customer_note = ' Thank you for the opportunity. ',
  estimate_default_terms = ' A signed estimate and deposit are required. '
where id = '2d000000-0000-4000-8000-000000000001';

do $$ begin
  if not exists (
    select 1 from public.accounts
    where id = '2d000000-0000-4000-8000-000000000001'
      and legal_name = 'Profile Company Holdings LLC'
      and timezone = 'America/Indiana/Indianapolis'
      and service_area = 'Cook, DuPage, and Lake Counties'
      and business_hours = 'Monday-Friday 7:00 AM-6:00 PM'
      and emergency_rules = 'Transfer active leaks and safety hazards to the on-call manager.'
      and business_phone = '(312) 555-0199'
      and business_email = 'sales@profile.example'
      and business_website = 'https://profile.example/estimates'
      and proposal_accent_color = '#1D4ED8'
      and estimate_default_tax_rate = 0.0825
      and estimate_default_valid_days = 21
      and estimate_default_customer_note = 'Thank you for the opportunity.'
      and estimate_default_terms = 'A signed estimate and deposit are required.'
  ) then raise exception 'Owner profile update was not stored and normalized'; end if;
end $$;

select set_config('request.jwt.claim.sub', '1d000000-0000-4000-8000-000000000002', true);
update public.accounts set service_area = 'Northern Illinois' where id = '2d000000-0000-4000-8000-000000000001';

select set_config('request.jwt.claim.sub', '1d000000-0000-4000-8000-000000000003', true);
do $$
declare denied boolean := false;
begin
  if (select count(*) from public.accounts) <> 1 then raise exception 'Sales profile visibility crossed tenants'; end if;
  begin
    update public.accounts set service_area = 'Unauthorized change'
    where id = '2d000000-0000-4000-8000-000000000001';
  exception when others then denied := true;
  end;
  if not denied and exists (
    select 1 from public.accounts
    where id = '2d000000-0000-4000-8000-000000000001'
      and service_area = 'Unauthorized change'
  ) then raise exception 'Sales user changed the company profile'; end if;
end $$;

select set_config('request.jwt.claim.sub', '1d000000-0000-4000-8000-000000000001', true);
do $$
declare denied boolean := false;
begin
  begin
    update public.accounts set timezone = 'Mars/Base'
    where id = '2d000000-0000-4000-8000-000000000001';
  exception when check_violation then denied := true;
  end;
  if not denied then raise exception 'Invalid timezone was accepted'; end if;
end $$;

do $$
declare denied boolean := false;
begin
  begin
    update public.accounts set business_website = 'http://insecure.example'
    where id = '2d000000-0000-4000-8000-000000000001';
  exception when check_violation then denied := true;
  end;
  if not denied then raise exception 'Insecure proposal website was accepted'; end if;
end $$;

do $$
declare denied boolean := false;
begin
  begin
    update public.accounts set estimate_default_tax_rate = 1.01
    where id = '2d000000-0000-4000-8000-000000000001';
  exception when check_violation then denied := true;
  end;
  if not denied then raise exception 'Out-of-range estimate tax default was accepted'; end if;
end $$;

do $$
declare denied boolean := false;
begin
  begin
    update public.accounts set estimate_default_valid_days = 0
    where id = '2d000000-0000-4000-8000-000000000001';
  exception when check_violation then denied := true;
  end;
  if not denied then raise exception 'Out-of-range estimate validity was accepted'; end if;
end $$;

do $$
declare denied boolean := false;
begin
  begin
    update public.accounts set proposal_accent_color = '#XYZ123'
    where id = '2d000000-0000-4000-8000-000000000001';
  exception when check_violation then denied := true;
  end;
  if not denied then raise exception 'Invalid proposal color was accepted'; end if;
end $$;

reset role;
rollback;
select 'bontraco_workspace_business_profile_rls_passed' as result;
