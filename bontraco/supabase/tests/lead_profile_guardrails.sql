-- Repeatable lead-profile domain allowlist checks.

begin;

insert into auth.users (id, email, aud, role, created_at, updated_at)
values (
  '6a000000-0000-0000-0000-000000000001',
  'lead-profile-owner@example.invalid',
  'authenticated',
  'authenticated',
  now(),
  now()
);

insert into public.accounts (id, name, slug, trades, created_by)
values (
  '6b000000-0000-0000-0000-000000000001',
  'Lead Profile Guardrail Test',
  'bontraco-lead-profile-guardrail-test',
  array['roofing']::public.bontraco_trade[],
  '6a000000-0000-0000-0000-000000000001'
);

insert into public.memberships (account_id, user_id, role, display_name, email)
values (
  '6b000000-0000-0000-0000-000000000001',
  '6a000000-0000-0000-0000-000000000001',
  'owner',
  'Lead Profile Owner',
  'lead-profile-owner@example.invalid'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '6a000000-0000-0000-0000-000000000001', true);

insert into public.lead_source_profiles (
  account_id, name, provider, trades, search_terms, geography, allowed_domains, created_by
) values (
  '6b000000-0000-0000-0000-000000000001',
  'Valid public sources',
  'tavily',
  array['roofing']::public.bontraco_trade[],
  array['roof leak'],
  '{"city":"Chicago","region":"IL"}'::jsonb,
  array['reddit.com', 'patch.com'],
  '6a000000-0000-0000-0000-000000000001'
);

insert into public.lead_source_profiles (
  account_id, name, provider, trades, search_terms, geography, allowed_domains, created_by
) values (
  '6b000000-0000-0000-0000-000000000001',
  'Valid Places source',
  'google_places',
  array['roofing']::public.bontraco_trade[],
  array['property management company'],
  '{"city":"Chicago","region":"IL"}'::jsonb,
  array[]::text[],
  '6a000000-0000-0000-0000-000000000001'
);

do $$
declare denied boolean := false;
begin
  begin
    insert into public.lead_source_profiles (
      account_id, name, provider, trades, search_terms, allowed_domains, created_by
    ) values (
      '6b000000-0000-0000-0000-000000000001',
      'Unsafe broad web search',
      'tavily',
      array['roofing']::public.bontraco_trade[],
      array['roof leak'],
      array[]::text[],
      '6a000000-0000-0000-0000-000000000001'
    );
  exception when check_violation then denied := true;
  end;
  if not denied then raise exception 'Tavily profile accepted an empty domain allowlist'; end if;
end $$;

do $$
declare denied boolean := false;
begin
  begin
    insert into public.lead_source_profiles (
      account_id, name, provider, trades, search_terms, allowed_domains, created_by
    ) values (
      '6b000000-0000-0000-0000-000000000001',
      'Unsafe path source',
      'tavily',
      array['roofing']::public.bontraco_trade[],
      array['roof leak'],
      array['reddit.com/r/chicago'],
      '6a000000-0000-0000-0000-000000000001'
    );
  exception when check_violation then denied := true;
  end;
  if not denied then raise exception 'Lead profile accepted a domain path'; end if;
end $$;

do $$ begin
  if (select count(*) from public.lead_source_profiles) <> 2 then
    raise exception 'Unexpected lead-profile visibility or guardrail result';
  end if;
end $$;

rollback;
