-- Create a customer and optional first service location in one transaction.

create or replace function public.create_bontraco_contact(
  target_account_id uuid,
  contact_first_name text,
  contact_last_name text default null,
  contact_company_name text default null,
  contact_phone text default null,
  contact_email text default null,
  contact_source text default 'manual',
  property_address_line_1 text default null,
  property_city text default null,
  property_region text default 'IL',
  property_postal_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_role public.bontraco_member_role;
  new_contact_id uuid;
  normalized_address text := nullif(trim(coalesce(property_address_line_1, '')), '');
  normalized_city text := nullif(trim(coalesce(property_city, '')), '');
begin
  if actor_id is null then raise exception 'Authentication required'; end if;
  select m.role into actor_role from public.memberships m
  where m.account_id = target_account_id and m.user_id = actor_id and m.active;
  if actor_role is null or actor_role = 'field' then
    raise exception 'Owner, administrator, dispatcher, or salesperson required';
  end if;
  if char_length(trim(coalesce(contact_first_name, ''))) not between 1 and 80 then
    raise exception 'First name is required';
  end if;
  if (normalized_address is null) <> (normalized_city is null) then
    raise exception 'Address and city are both required for a service location';
  end if;

  insert into public.contacts (
    account_id, assigned_to, first_name, last_name, company_name,
    phone, email, source, created_by
  ) values (
    target_account_id,
    case when actor_role = 'sales' then actor_id else null end,
    trim(contact_first_name),
    nullif(trim(coalesce(contact_last_name, '')), ''),
    nullif(trim(coalesce(contact_company_name, '')), ''),
    nullif(trim(coalesce(contact_phone, '')), ''),
    nullif(lower(trim(coalesce(contact_email, ''))), ''),
    coalesce(nullif(trim(coalesce(contact_source, '')), ''), 'manual'),
    actor_id
  ) returning id into new_contact_id;

  if normalized_address is not null then
    insert into public.properties (
      account_id, contact_id, label, address_line_1, city, region, postal_code
    ) values (
      target_account_id,
      new_contact_id,
      'Primary service location',
      normalized_address,
      normalized_city,
      coalesce(nullif(trim(coalesce(property_region, '')), ''), 'IL'),
      nullif(trim(coalesce(property_postal_code, '')), '')
    );
  end if;
  return new_contact_id;
end;
$$;

revoke all on function public.create_bontraco_contact(
  uuid, text, text, text, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.create_bontraco_contact(
  uuid, text, text, text, text, text, text, text, text, text, text
) to authenticated;
