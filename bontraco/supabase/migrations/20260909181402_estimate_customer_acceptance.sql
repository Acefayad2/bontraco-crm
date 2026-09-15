-- Hashed customer links and immutable proposal snapshots for electronic estimate acceptance.
create table private.estimate_share_tokens (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  estimate_id uuid not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  document_snapshot jsonb not null check (jsonb_typeof(document_snapshot) = 'object'),
  expires_at timestamptz not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  viewed_at timestamptz,
  accepted_at timestamptz,
  signer_name text,
  signer_email text,
  acceptance_statement text,
  acceptance_user_agent text,
  acceptance_network_hash text,
  revoked_at timestamptz,
  constraint estimate_share_tokens_account_estimate_fkey
    foreign key (account_id, estimate_id)
    references public.estimates(account_id, id) on delete cascade,
  constraint estimate_share_tokens_expiry_after_creation
    check (expires_at > created_at),
  constraint estimate_share_tokens_signer_name_length
    check (signer_name is null or char_length(signer_name) between 2 and 120),
  constraint estimate_share_tokens_signer_email_format
    check (
      signer_email is null or (
        char_length(signer_email) between 3 and 254
        and signer_email = lower(signer_email)
        and signer_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      )
    ),
  constraint estimate_share_tokens_user_agent_length
    check (acceptance_user_agent is null or char_length(acceptance_user_agent) <= 500),
  constraint estimate_share_tokens_network_hash_format
    check (acceptance_network_hash is null or acceptance_network_hash ~ '^[0-9a-f]{64}$'),
  constraint estimate_share_tokens_acceptance_complete
    check (
      (
        accepted_at is null
        and signer_name is null
        and signer_email is null
        and acceptance_statement is null
        and acceptance_user_agent is null
        and acceptance_network_hash is null
      )
      or
      (accepted_at is not null and signer_name is not null and acceptance_statement is not null)
    )
);

create index estimate_share_tokens_account_estimate_idx
on private.estimate_share_tokens (account_id, estimate_id, created_at desc);

create unique index estimate_share_tokens_one_active_idx
on private.estimate_share_tokens (estimate_id)
where revoked_at is null and accepted_at is null;

revoke all on private.estimate_share_tokens from public, anon, authenticated;

create or replace function public.create_bontraco_estimate_share(
  target_account_id uuid,
  target_estimate_id uuid,
  target_token_hash text,
  actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  source record;
  snapshot jsonb;
  share_id uuid;
  share_expires_at timestamptz;
  issued_at timestamptz;
begin
  if target_token_hash is null or target_token_hash !~ '^[0-9a-fA-F]{64}$' then
    raise check_violation using message = 'Estimate share token hash is invalid';
  end if;

  select
    e.id as estimate_id,
    e.account_id,
    e.estimate_number,
    e.status,
    e.subtotal,
    e.tax_rate,
    e.tax_amount,
    e.total,
    e.valid_until,
    e.customer_note,
    e.terms,
    e.sent_at,
    e.created_at as estimate_created_at,
    j.id as job_id,
    j.title as job_title,
    j.trade,
    j.assigned_to,
    c.first_name,
    c.last_name,
    c.company_name as customer_company_name,
    c.phone as customer_phone,
    c.email as customer_email,
    p.address_line_1,
    p.address_line_2,
    p.city,
    p.region,
    p.postal_code,
    a.name as company_name,
    a.legal_name,
    a.business_phone,
    a.business_email,
    a.business_website,
    a.proposal_accent_color
  into source
  from public.estimates e
  join public.jobs j on j.account_id = e.account_id and j.id = e.job_id
  join public.contacts c on c.account_id = j.account_id and c.id = j.contact_id
  left join public.properties p on p.account_id = j.account_id and p.id = j.property_id
  join public.accounts a on a.id = e.account_id
  where e.account_id = target_account_id and e.id = target_estimate_id
  for update of e;

  if not found then
    raise invalid_parameter_value using message = 'Estimate was not found in this workspace';
  end if;
  if source.status not in ('draft', 'sent', 'viewed') then
    raise check_violation using message = 'Only open estimates can receive a new customer link';
  end if;
  if not exists (
    select 1
    from public.memberships m
    where m.account_id = target_account_id
      and m.user_id = actor_id
      and m.active
      and (
        m.role in ('owner', 'admin', 'dispatcher')
        or (m.role = 'sales' and source.assigned_to = actor_id)
      )
  ) then
    raise insufficient_privilege using message = 'This user cannot share the selected estimate';
  end if;

  issued_at := coalesce(source.sent_at, now());
  share_expires_at := least(
    now() + interval '90 days',
    coalesce(
      (source.valid_until + 1)::timestamp at time zone 'UTC',
      now() + interval '30 days'
    )
  );
  if share_expires_at <= now() + interval '5 minutes' then
    raise check_violation using message = 'Estimate validity must extend beyond the next five minutes';
  end if;

  snapshot := jsonb_strip_nulls(jsonb_build_object(
    'schema_version', 1,
    'company', jsonb_build_object(
      'name', source.company_name,
      'legal_name', source.legal_name,
      'phone', source.business_phone,
      'email', source.business_email,
      'website', source.business_website,
      'accent_color', source.proposal_accent_color
    ),
    'customer', jsonb_build_object(
      'first_name', source.first_name,
      'last_name', source.last_name,
      'company_name', source.customer_company_name,
      'phone', source.customer_phone,
      'email', source.customer_email
    ),
    'property', jsonb_build_object(
      'address_line_1', source.address_line_1,
      'address_line_2', source.address_line_2,
      'city', source.city,
      'region', source.region,
      'postal_code', source.postal_code
    ),
    'job', jsonb_build_object(
      'title', source.job_title,
      'trade', source.trade
    ),
    'estimate', jsonb_build_object(
      'number', source.estimate_number,
      'status', 'sent',
      'subtotal', source.subtotal,
      'tax_rate', source.tax_rate,
      'tax_amount', source.tax_amount,
      'total', source.total,
      'valid_until', source.valid_until,
      'customer_note', source.customer_note,
      'terms', source.terms,
      'issued_at', issued_at,
      'created_at', source.estimate_created_at
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'description', i.description,
        'quantity', i.quantity,
        'unit', i.unit,
        'unit_price', i.unit_price,
        'taxable', i.taxable,
        'line_total', i.line_total
      ) order by i.sort_order, i.id)
      from public.estimate_items i
      where i.account_id = target_account_id and i.estimate_id = target_estimate_id
    ), '[]'::jsonb)
  ));

  if jsonb_array_length(snapshot->'items') = 0 then
    raise check_violation using message = 'An estimate must have scope lines before sharing';
  end if;

  update private.estimate_share_tokens
  set revoked_at = now()
  where estimate_id = target_estimate_id and revoked_at is null and accepted_at is null;

  insert into private.estimate_share_tokens (
    account_id, estimate_id, token_hash, document_snapshot, expires_at, created_by
  ) values (
    target_account_id,
    target_estimate_id,
    lower(target_token_hash),
    snapshot,
    share_expires_at,
    actor_id
  ) returning id into share_id;

  update public.estimates
  set status = case when status = 'draft' then 'sent' else status end,
      sent_at = coalesce(sent_at, issued_at)
  where id = target_estimate_id and account_id = target_account_id;

  insert into public.activities (account_id, actor_id, contact_id, job_id, kind, summary, metadata)
  values (
    target_account_id,
    actor_id,
    (select contact_id from public.jobs where id = source.job_id and account_id = target_account_id),
    source.job_id,
    'estimate_share_created',
    'Customer estimate link created: ' || source.estimate_number,
    jsonb_build_object('estimate_id', target_estimate_id, 'expires_at', share_expires_at)
  );

  return share_id;
end;
$$;

create or replace function public.accept_bontraco_estimate_share(
  raw_token text,
  signer_name_input text,
  signer_email_input text,
  acknowledged boolean,
  user_agent_input text,
  network_hash_input text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  share private.estimate_share_tokens%rowtype;
  token_hash_value text;
  normalized_name text;
  normalized_email text;
  acceptance_time timestamptz;
  current_status text;
  statement constant text := 'I reviewed and accept this estimate, including its scope, price, and terms.';
begin
  if raw_token is null or raw_token !~ '^[A-Za-z0-9_-]{43}$' then
    raise invalid_parameter_value using message = 'Estimate link is invalid';
  end if;
  if acknowledged is not true then
    raise check_violation using message = 'Acceptance acknowledgment is required';
  end if;
  normalized_name := btrim(coalesce(signer_name_input, ''));
  if char_length(normalized_name) not between 2 and 120 then
    raise check_violation using message = 'Signer name must contain 2 to 120 characters';
  end if;
  normalized_email := lower(nullif(btrim(signer_email_input), ''));
  if normalized_email is not null and (
    char_length(normalized_email) not between 3 and 254
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ) then
    raise check_violation using message = 'Signer email is invalid';
  end if;
  if user_agent_input is not null and char_length(user_agent_input) > 500 then
    raise check_violation using message = 'Acceptance device description is too long';
  end if;
  if network_hash_input is not null and network_hash_input !~ '^[0-9a-f]{64}$' then
    raise check_violation using message = 'Acceptance network evidence is invalid';
  end if;

  token_hash_value := encode(extensions.digest(convert_to(raw_token, 'UTF8'), 'sha256'), 'hex');
  select * into share
  from private.estimate_share_tokens
  where token_hash = token_hash_value
  for update;
  if not found or share.revoked_at is not null or share.expires_at <= now() then
    raise invalid_parameter_value using message = 'Estimate link is invalid or expired';
  end if;

  if share.accepted_at is not null then
    return share.document_snapshot || jsonb_build_object(
      'share', jsonb_strip_nulls(jsonb_build_object(
        'status', 'accepted',
        'expires_at', share.expires_at,
        'viewed_at', share.viewed_at,
        'accepted_at', share.accepted_at,
        'signer_name', share.signer_name,
        'signer_email', share.signer_email
      ))
    );
  end if;

  select status into current_status
  from public.estimates
  where id = share.estimate_id and account_id = share.account_id
  for update;
  if current_status not in ('sent', 'viewed') then
    raise check_violation using message = 'Estimate is no longer open for acceptance';
  end if;

  acceptance_time := now();
  update private.estimate_share_tokens
  set viewed_at = coalesce(viewed_at, acceptance_time),
      accepted_at = acceptance_time,
      signer_name = normalized_name,
      signer_email = normalized_email,
      acceptance_statement = statement,
      acceptance_user_agent = nullif(left(btrim(coalesce(user_agent_input, '')), 500), ''),
      acceptance_network_hash = network_hash_input
  where id = share.id;

  update public.estimates
  set status = 'accepted', accepted_at = acceptance_time
  where id = share.estimate_id and account_id = share.account_id;

  insert into public.activities (account_id, actor_id, contact_id, job_id, kind, summary, metadata)
  select
    share.account_id,
    null,
    j.contact_id,
    e.job_id,
    'estimate_customer_accepted',
    'Customer accepted estimate: ' || e.estimate_number,
    jsonb_build_object(
      'estimate_id', share.estimate_id,
      'accepted_at', acceptance_time,
      'signer_name', normalized_name,
      'signer_email', normalized_email,
      'acceptance_statement', statement
    )
  from public.estimates e
  join public.jobs j on j.account_id = e.account_id and j.id = e.job_id
  where e.id = share.estimate_id and e.account_id = share.account_id;

  return share.document_snapshot || jsonb_build_object(
    'share', jsonb_strip_nulls(jsonb_build_object(
      'status', 'accepted',
      'expires_at', share.expires_at,
      'viewed_at', coalesce(share.viewed_at, acceptance_time),
      'accepted_at', acceptance_time,
      'signer_name', normalized_name,
      'signer_email', normalized_email
    ))
  );
end;
$$;

create or replace function public.export_bontraco_estimate_acceptances(target_account_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'estimate_id', s.estimate_id,
    'document_snapshot', s.document_snapshot,
    'expires_at', s.expires_at,
    'created_by', s.created_by,
    'created_at', s.created_at,
    'viewed_at', s.viewed_at,
    'accepted_at', s.accepted_at,
    'signer_name', s.signer_name,
    'signer_email', s.signer_email,
    'acceptance_statement', s.acceptance_statement,
    'acceptance_user_agent', s.acceptance_user_agent,
    'acceptance_network_hash', s.acceptance_network_hash,
    'revoked_at', s.revoked_at
  ) order by s.created_at desc), '[]'::jsonb)
  from private.estimate_share_tokens s
  where s.account_id = target_account_id;
$$;

create or replace function public.get_bontraco_estimate_share(raw_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  share record;
  token_hash_value text;
  live_status text;
  first_viewed_at timestamptz;
begin
  if raw_token is null or raw_token !~ '^[A-Za-z0-9_-]{43}$' then
    return null;
  end if;
  token_hash_value := encode(extensions.digest(convert_to(raw_token, 'UTF8'), 'sha256'), 'hex');

  select s.*, e.status as estimate_status
  into share
  from private.estimate_share_tokens s
  join public.estimates e on e.account_id = s.account_id and e.id = s.estimate_id
  where s.token_hash = token_hash_value
    and s.revoked_at is null
    and s.expires_at > now()
    and e.status in ('sent', 'viewed', 'accepted');
  if not found then return null; end if;

  first_viewed_at := coalesce(share.viewed_at, now());
  update private.estimate_share_tokens
  set viewed_at = first_viewed_at
  where id = share.id and viewed_at is null;

  live_status := share.estimate_status;
  if live_status = 'sent' then
    update public.estimates
    set status = 'viewed'
    where id = share.estimate_id and account_id = share.account_id and status = 'sent';
    live_status := 'viewed';
  end if;

  return share.document_snapshot || jsonb_build_object(
    'share', jsonb_strip_nulls(jsonb_build_object(
      'status', live_status,
      'expires_at', share.expires_at,
      'viewed_at', first_viewed_at,
      'accepted_at', share.accepted_at,
      'signer_name', share.signer_name,
      'signer_email', share.signer_email
    ))
  );
end;
$$;

revoke all on function public.create_bontraco_estimate_share(uuid, uuid, text, uuid)
from public, anon, authenticated;
revoke all on function public.get_bontraco_estimate_share(text)
from public, anon, authenticated;
revoke all on function public.accept_bontraco_estimate_share(text, text, text, boolean, text, text)
from public, anon, authenticated;
revoke all on function public.export_bontraco_estimate_acceptances(uuid)
from public, anon, authenticated;

grant execute on function public.create_bontraco_estimate_share(uuid, uuid, text, uuid)
to service_role;
grant execute on function public.get_bontraco_estimate_share(text)
to service_role;
grant execute on function public.accept_bontraco_estimate_share(text, text, text, boolean, text, text)
to service_role;
grant execute on function public.export_bontraco_estimate_acceptances(uuid)
to service_role;
