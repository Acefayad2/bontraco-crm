-- Repeatable suppression, consent, audit, and tenant-isolation checks.

begin;

insert into auth.users (id, email, aud, role, created_at, updated_at) values
  ('1a000000-0000-0000-0000-000000000001', 'preference-owner@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('1a000000-0000-0000-0000-000000000002', 'preference-sales@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('1a000000-0000-0000-0000-000000000003', 'preference-field@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('1a000000-0000-0000-0000-000000000004', 'preference-outside@example.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.accounts (id, name, slug, trades, created_by) values
  ('2a000000-0000-0000-0000-000000000001', 'Preference Test One', 'bontraco-preference-test-one', array['roofing']::public.bontraco_trade[], '1a000000-0000-0000-0000-000000000001'),
  ('2a000000-0000-0000-0000-000000000002', 'Preference Test Two', 'bontraco-preference-test-two', array['electrical']::public.bontraco_trade[], '1a000000-0000-0000-0000-000000000004');

insert into public.memberships (account_id, user_id, role, display_name, email) values
  ('2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000001', 'owner', 'Preference Owner', 'preference-owner@example.invalid'),
  ('2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000002', 'sales', 'Preference Sales', 'preference-sales@example.invalid'),
  ('2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000003', 'field', 'Preference Field', 'preference-field@example.invalid'),
  ('2a000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000004', 'owner', 'Preference Outside', 'preference-outside@example.invalid');

insert into public.contacts (id, account_id, assigned_to, first_name, email, phone, created_by) values
  ('3a000000-0000-0000-0000-000000000001', '2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000002', 'Assigned', 'assigned@example.invalid', '+13125550101', '1a000000-0000-0000-0000-000000000001'),
  ('3a000000-0000-0000-0000-000000000002', '2a000000-0000-0000-0000-000000000001', null, 'Unassigned', 'unassigned@example.invalid', '+13125550102', '1a000000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub', '1a000000-0000-0000-0000-000000000001', true);

insert into public.communication_suppressions (
  id, account_id, contact_id, channel, destination, reason, source, created_by
) values (
  '4a000000-0000-0000-0000-000000000001',
  '2a000000-0000-0000-0000-000000000001',
  '3a000000-0000-0000-0000-000000000002',
  'voice',
  '+13125550102',
  'Recipient requested no calls',
  'recipient_request',
  '1a000000-0000-0000-0000-000000000001'
);

select set_config('request.jwt.claim.sub', '1a000000-0000-0000-0000-000000000002', true);

insert into public.communication_suppressions (
  id, account_id, contact_id, channel, destination, reason, source, created_by
) values (
  '4a000000-0000-0000-0000-000000000002',
  '2a000000-0000-0000-0000-000000000001',
  '3a000000-0000-0000-0000-000000000001',
  'email',
  'assigned@example.invalid',
  'Recipient unsubscribed',
  'recipient_request',
  '1a000000-0000-0000-0000-000000000002'
);

insert into public.communication_consents (
  id, account_id, contact_id, channel, purpose, destination, status, source,
  disclosure_version, created_by
) values (
  '5a000000-0000-0000-0000-000000000001',
  '2a000000-0000-0000-0000-000000000001',
  '3a000000-0000-0000-0000-000000000001',
  'voice',
  'artificial_voice',
  '+13125550101',
  'granted',
  'written',
  'test-v1',
  '1a000000-0000-0000-0000-000000000002'
);

do $$
declare denied boolean := false;
begin
  begin
    insert into public.communication_consents (
      account_id, contact_id, channel, purpose, destination, status, source,
      disclosure_version, created_by
    ) values (
      '2a000000-0000-0000-0000-000000000001',
      '3a000000-0000-0000-0000-000000000001',
      'email',
      'artificial_voice',
      'assigned@example.invalid',
      'granted',
      'written',
      'test-v1',
      '1a000000-0000-0000-0000-000000000002'
    );
  exception when check_violation then denied := true;
  end;
  if not denied then raise exception 'Artificial-voice consent accepted a non-voice channel'; end if;
end $$;

do $$
declare denied boolean := false;
begin
  if (select count(*) from public.communication_suppressions) <> 1 then
    raise exception 'Sales user can see suppressions outside assigned contacts';
  end if;
  begin
    insert into public.communication_suppressions (
      account_id, contact_id, channel, destination, reason, source, created_by
    ) values (
      '2a000000-0000-0000-0000-000000000001',
      '3a000000-0000-0000-0000-000000000002',
      'email',
      'unassigned@example.invalid',
      'Must be denied',
      'manual',
      '1a000000-0000-0000-0000-000000000002'
    );
  exception when others then denied := true;
  end;
  if not denied then raise exception 'Sales user suppressed an unassigned contact'; end if;
end $$;

select set_config('request.jwt.claim.sub', '1a000000-0000-0000-0000-000000000003', true);
do $$
declare denied boolean := false;
begin
  if (select count(*) from public.communication_suppressions) <> 0 then
    raise exception 'Field user can see communication preferences';
  end if;
  begin
    insert into public.communication_consents (
      account_id, contact_id, channel, purpose, destination, status, source,
      disclosure_version, created_by
    ) values (
      '2a000000-0000-0000-0000-000000000001',
      '3a000000-0000-0000-0000-000000000001',
      'voice',
      'recording',
      '+13125550101',
      'granted',
      'manual',
      'test-v1',
      '1a000000-0000-0000-0000-000000000003'
    );
  exception when others then denied := true;
  end;
  if not denied then raise exception 'Field user recorded communication consent'; end if;
end $$;

select set_config('request.jwt.claim.sub', '1a000000-0000-0000-0000-000000000004', true);
do $$
declare denied boolean := false;
begin
  if (select count(*) from public.communication_consents) <> 0 then
    raise exception 'Outside tenant can see communication consent';
  end if;
  begin
    perform public.is_communication_suppressed(
      '2a000000-0000-0000-0000-000000000001', 'email', 'assigned@example.invalid'
    );
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Authenticated users can call the service-only suppression helper'; end if;
end $$;

reset role;

do $$ begin
  if not public.is_communication_suppressed(
    '2a000000-0000-0000-0000-000000000001', 'email', 'assigned@example.invalid'
  ) then
    raise exception 'Active email suppression was not detected';
  end if;
  if not public.has_active_communication_consent(
    '2a000000-0000-0000-0000-000000000001', 'voice', 'artificial_voice', '+13125550101'
  ) then
    raise exception 'Active artificial-voice consent was not detected';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '1a000000-0000-0000-0000-000000000001', true);

update public.communication_suppressions
set lifted_at = now(),
    lifted_by = '1a000000-0000-0000-0000-000000000001',
    lift_reason = 'Written correction verified'
where id = '4a000000-0000-0000-0000-000000000002';

do $$ begin
  if (select count(*) from public.communication_suppressions) <> 2 then
    raise exception 'Owner cannot see the complete suppression ledger';
  end if;
  if (select count(*) from public.activities where account_id = '2a000000-0000-0000-0000-000000000001' and kind = 'communication_suppressed') <> 2
    or (select count(*) from public.activities where account_id = '2a000000-0000-0000-0000-000000000001' and kind = 'communication_consent_granted') <> 1
    or (select count(*) from public.activities where account_id = '2a000000-0000-0000-0000-000000000001' and kind = 'communication_suppression_lifted') <> 1 then
    raise exception 'Communication preference audit events are incomplete';
  end if;
end $$;

reset role;

do $$ begin
  if public.is_communication_suppressed(
    '2a000000-0000-0000-0000-000000000001', 'email', 'assigned@example.invalid'
  ) then
    raise exception 'Lifted email suppression remains active';
  end if;
end $$;

rollback;
