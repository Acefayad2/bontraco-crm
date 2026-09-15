-- Repeatable hashed-link, snapshot, role, acceptance, and export checks. Fixtures roll back.
begin;

insert into auth.users (id, email, aud, role, created_at, updated_at) values
  ('e1000000-0000-4000-8000-000000000001', 'accept-owner@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('e1000000-0000-4000-8000-000000000002', 'accept-sales@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('e1000000-0000-4000-8000-000000000003', 'accept-outsider@example.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.accounts (
  id, name, slug, trades, created_by, business_phone, business_email, business_website,
  proposal_logo_path, proposal_accent_color
) values
  (
    'e2000000-0000-4000-8000-000000000001', 'Acceptance Company',
    'bontraco-acceptance-company', array['roofing']::public.bontraco_trade[],
    'e1000000-0000-4000-8000-000000000001', '(312) 555-0100',
    'proposals@acceptance.example', 'https://acceptance.example',
    'e2000000-0000-4000-8000-000000000001/branding/e9000000-0000-4000-8000-000000000001',
    '#1D4ED8'
  ),
  (
    'e2000000-0000-4000-8000-000000000002', 'Outside Acceptance Company',
    'bontraco-acceptance-outside', array['plumbing']::public.bontraco_trade[],
    'e1000000-0000-4000-8000-000000000003', null, null, null, null, '#0F5B4F'
  );

insert into public.memberships (account_id, user_id, role, display_name, email) values
  ('e2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'owner', 'Acceptance Owner', 'accept-owner@example.invalid'),
  ('e2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000002', 'sales', 'Acceptance Sales', 'accept-sales@example.invalid'),
  ('e2000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000003', 'owner', 'Outside Owner', 'accept-outsider@example.invalid');

insert into public.contacts (id, account_id, assigned_to, first_name, last_name, email, created_by) values
  (
    'e3000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000002', 'Taylor', 'Customer',
    'taylor@example.invalid', 'e1000000-0000-4000-8000-000000000001'
  ),
  (
    'e3000000-0000-4000-8000-000000000002', 'e2000000-0000-4000-8000-000000000001',
    null, 'Morgan', 'Unassigned', null, 'e1000000-0000-4000-8000-000000000001'
  );

insert into public.properties (
  id, account_id, contact_id, address_line_1, city, region, postal_code
) values (
  'e4000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001',
  'e3000000-0000-4000-8000-000000000001', '100 Main Street', 'Chicago', 'IL', '60601'
);

insert into public.jobs (
  id, account_id, contact_id, property_id, assigned_to, title, trade, created_by
) values
  (
    'e5000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000001', 'e4000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000002', 'Customer roof replacement', 'roofing',
    'e1000000-0000-4000-8000-000000000001'
  ),
  (
    'e5000000-0000-4000-8000-000000000002', 'e2000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000002', null, null, 'Unassigned roof repair',
    'roofing', 'e1000000-0000-4000-8000-000000000001'
  );

insert into public.estimates (
  id, account_id, job_id, estimate_number, status, tax_rate, valid_until,
  customer_note, terms, created_by
) values
  (
    'e6000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001',
    'e5000000-0000-4000-8000-000000000001', 'EST-ACCEPT-1', 'draft', 0.1,
    current_date + 30, 'Frozen customer note', 'Frozen customer terms',
    'e1000000-0000-4000-8000-000000000001'
  ),
  (
    'e6000000-0000-4000-8000-000000000002', 'e2000000-0000-4000-8000-000000000001',
    'e5000000-0000-4000-8000-000000000002', 'EST-UNASSIGNED', 'draft', 0,
    current_date + 30, null, null, 'e1000000-0000-4000-8000-000000000001'
  );

insert into public.estimate_items (
  id, account_id, estimate_id, sort_order, description, quantity, unit, unit_price, taxable
) values
  (
    'e7000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001',
    'e6000000-0000-4000-8000-000000000001', 0, 'Architectural shingle system',
    10, 'square', 100, true
  ),
  (
    'e7000000-0000-4000-8000-000000000002', 'e2000000-0000-4000-8000-000000000001',
    'e6000000-0000-4000-8000-000000000002', 0, 'Roof repair allowance',
    1, 'each', 500, false
  );

set constraints estimates_require_line_items immediate;
set constraints estimates_require_line_items deferred;

do $$
begin
  if has_table_privilege('authenticated', 'private.estimate_share_tokens', 'SELECT')
    or has_table_privilege('anon', 'private.estimate_share_tokens', 'SELECT')
  then raise exception 'Customer estimate acceptance evidence is directly exposed'; end if;
  if has_function_privilege(
    'authenticated', 'public.create_bontraco_estimate_share(uuid, uuid, text, uuid)', 'EXECUTE'
  ) or has_function_privilege(
    'anon', 'public.get_bontraco_estimate_share(text)', 'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.accept_bontraco_estimate_share(text, text, text, boolean, text, text)',
    'EXECUTE'
  ) then raise exception 'Customer estimate service RPCs are exposed to browser roles'; end if;
end $$;

set local role service_role;

select public.create_bontraco_estimate_share(
  'e2000000-0000-4000-8000-000000000001',
  'e6000000-0000-4000-8000-000000000001',
  encode(extensions.digest(convert_to(repeat('a', 43), 'UTF8'), 'sha256'), 'hex'),
  'e1000000-0000-4000-8000-000000000001'
);

reset role;

do $$
declare payload jsonb;
begin
  select document_snapshot into payload
  from private.estimate_share_tokens
  where estimate_id = 'e6000000-0000-4000-8000-000000000001' and revoked_at is null;
  if (select status from public.estimates where id = 'e6000000-0000-4000-8000-000000000001') <> 'sent'
  then raise exception 'Sharing did not mark the estimate sent'; end if;
  if payload->'company'->>'phone' <> '(312) 555-0100'
    or payload->'company'->>'accent_color' <> '#1D4ED8'
    or payload->'company'->>'logo_path' <>
      'e2000000-0000-4000-8000-000000000001/branding/e9000000-0000-4000-8000-000000000001'
    or payload->'estimate'->>'terms' <> 'Frozen customer terms'
    or (payload->'estimate'->>'total')::numeric <> 1100
    or jsonb_array_length(payload->'items') <> 1
  then raise exception 'Customer proposal snapshot omitted frozen commercial data'; end if;
  if exists (
    select 1 from private.estimate_share_tokens where token_hash = repeat('a', 43)
  ) then raise exception 'Raw estimate token was stored'; end if;
end $$;

do $$
declare denied boolean := false;
begin
  begin
    perform public.create_bontraco_estimate_share(
      'e2000000-0000-4000-8000-000000000001',
      'e6000000-0000-4000-8000-000000000001',
      encode(extensions.digest(convert_to(repeat('b', 43), 'UTF8'), 'sha256'), 'hex'),
      'e1000000-0000-4000-8000-000000000003'
    );
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Outside tenant created an estimate link'; end if;
end $$;

do $$
declare denied boolean := false;
begin
  begin
    perform public.create_bontraco_estimate_share(
      'e2000000-0000-4000-8000-000000000001',
      'e6000000-0000-4000-8000-000000000002',
      encode(extensions.digest(convert_to(repeat('c', 43), 'UTF8'), 'sha256'), 'hex'),
      'e1000000-0000-4000-8000-000000000002'
    );
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Salesperson shared an unassigned estimate'; end if;
end $$;

select public.create_bontraco_estimate_share(
  'e2000000-0000-4000-8000-000000000001',
  'e6000000-0000-4000-8000-000000000001',
  encode(extensions.digest(convert_to(repeat('b', 43), 'UTF8'), 'sha256'), 'hex'),
  'e1000000-0000-4000-8000-000000000002'
);

do $$
declare payload jsonb;
begin
  if public.get_bontraco_estimate_share(repeat('a', 43)) is not null
  then raise exception 'Reissued estimate left its old customer link active'; end if;
  payload := public.get_bontraco_estimate_share(repeat('b', 43));
  if payload->'share'->>'status' <> 'viewed'
    or payload->'customer'->>'first_name' <> 'Taylor'
  then raise exception 'Valid customer link did not return the frozen proposal'; end if;
  if (select status from public.estimates where id = 'e6000000-0000-4000-8000-000000000001') <> 'viewed'
  then raise exception 'Customer view did not update estimate status'; end if;
  if public.get_bontraco_estimate_share('not-a-token') is not null
  then raise exception 'Malformed customer token returned proposal data'; end if;
end $$;

do $$
declare denied boolean := false;
begin
  begin
    perform public.accept_bontraco_estimate_share(
      repeat('b', 43), 'Jordan Signer', 'JORDAN@EXAMPLE.COM', false,
      'Bontraco SQL acceptance test', repeat('d', 64)
    );
  exception when check_violation then denied := true;
  end;
  if not denied then raise exception 'Estimate acceptance succeeded without acknowledgment'; end if;
end $$;

select public.accept_bontraco_estimate_share(
  repeat('b', 43), ' Jordan Signer ', ' JORDAN@EXAMPLE.COM ', true,
  'Bontraco SQL acceptance test', repeat('d', 64)
);

do $$
declare repeated_payload jsonb;
declare exported jsonb;
begin
  repeated_payload := public.accept_bontraco_estimate_share(
    repeat('b', 43), 'Different Person', 'different@example.com', true,
    'Different device', repeat('e', 64)
  );
  if repeated_payload->'share'->>'signer_name' <> 'Jordan Signer'
  then raise exception 'Repeated acceptance overwrote the original signer'; end if;
  if not exists (
    select 1
    from private.estimate_share_tokens
    where estimate_id = 'e6000000-0000-4000-8000-000000000001'
      and accepted_at is not null
      and signer_name = 'Jordan Signer'
      and signer_email = 'jordan@example.com'
      and acceptance_statement is not null
      and acceptance_network_hash = repeat('d', 64)
  ) then raise exception 'Acceptance evidence was not stored and normalized'; end if;
  if (select status from public.estimates where id = 'e6000000-0000-4000-8000-000000000001') <> 'accepted'
  then raise exception 'Customer acceptance did not accept the estimate'; end if;
  if (select count(*) from public.activities where kind = 'estimate_customer_accepted') <> 1
  then raise exception 'Customer acceptance audit event was not idempotent'; end if;

  exported := public.export_bontraco_estimate_acceptances(
    'e2000000-0000-4000-8000-000000000001'
  );
  if jsonb_array_length(exported) <> 2
    or exported::text like '%' || repeat('a', 43) || '%'
    or exported::text like '%' || repeat('b', 43) || '%'
    or (exported->0) ? 'token_hash'
  then raise exception 'Acceptance export is incomplete or leaks a customer token'; end if;
end $$;

rollback;
select 'bontraco_estimate_customer_acceptance_passed' as result;
