create or replace function public.create_bontraco_estimate(
  target_account_id uuid,
  target_job_id uuid,
  target_estimate_number text,
  target_tax_rate numeric,
  target_valid_until date,
  target_customer_note text,
  target_terms text,
  target_items jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  created_estimate_id uuid;
  item jsonb;
  item_order bigint;
  item_description text;
  item_quantity numeric;
  item_unit text;
  item_unit_price numeric;
  item_taxable boolean;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;
  if target_account_id is null or target_job_id is null then
    raise exception 'Workspace and job are required';
  end if;
  if public.can_access_commercial_job(target_account_id, target_job_id) is not true then
    raise exception 'Job not found or unavailable';
  end if;
  if char_length(btrim(coalesce(target_estimate_number, ''))) not between 3 and 80 then
    raise exception 'Estimate number must be between 3 and 80 characters';
  end if;
  if target_tax_rate is null or target_tax_rate < 0 or target_tax_rate > 1 then
    raise exception 'Tax rate must be between 0 and 1';
  end if;
  if target_customer_note is not null and char_length(btrim(target_customer_note)) > 2000 then
    raise exception 'Customer note must be 2000 characters or fewer';
  end if;
  if target_terms is not null and char_length(btrim(target_terms)) > 5000 then
    raise exception 'Estimate terms must be 5000 characters or fewer';
  end if;
  if jsonb_typeof(target_items) <> 'array'
    or jsonb_array_length(target_items) < 1
    or jsonb_array_length(target_items) > 50
  then
    raise exception 'An estimate requires between 1 and 50 line items';
  end if;

  insert into public.estimates (
    account_id,
    job_id,
    estimate_number,
    tax_rate,
    valid_until,
    customer_note,
    terms,
    created_by
  ) values (
    target_account_id,
    target_job_id,
    btrim(target_estimate_number),
    target_tax_rate,
    target_valid_until,
    nullif(btrim(target_customer_note), ''),
    nullif(btrim(target_terms), ''),
    auth.uid()
  )
  returning id into created_estimate_id;

  for item, item_order in
    select value, ordinality
    from jsonb_array_elements(target_items) with ordinality
  loop
    if jsonb_typeof(item) <> 'object' then
      raise exception 'Every estimate line item must be an object';
    end if;

    item_description := btrim(coalesce(item ->> 'description', ''));
    item_unit := btrim(coalesce(nullif(item ->> 'unit', ''), 'each'));
    if jsonb_typeof(item -> 'quantity') <> 'number'
      or jsonb_typeof(item -> 'unit_price') <> 'number'
      or (item ? 'taxable' and jsonb_typeof(item -> 'taxable') <> 'boolean')
    then
      raise exception 'Estimate line item values are malformed';
    end if;
    item_quantity := (item ->> 'quantity')::numeric;
    item_unit_price := (item ->> 'unit_price')::numeric;
    item_taxable := coalesce((item ->> 'taxable')::boolean, true);

    if char_length(item_description) not between 1 and 500 then
      raise exception 'Line item description must be between 1 and 500 characters';
    end if;
    if item_quantity <= 0 or item_quantity > 1000000 then
      raise exception 'Line item quantity is outside the allowed range';
    end if;
    if char_length(item_unit) not between 1 and 30 then
      raise exception 'Line item unit must be between 1 and 30 characters';
    end if;
    if item_unit_price < 0 or item_unit_price > 100000000 then
      raise exception 'Line item price is outside the allowed range';
    end if;

    insert into public.estimate_items (
      account_id,
      estimate_id,
      sort_order,
      description,
      quantity,
      unit,
      unit_price,
      taxable
    ) values (
      target_account_id,
      created_estimate_id,
      item_order - 1,
      item_description,
      item_quantity,
      item_unit,
      item_unit_price,
      item_taxable
    );
  end loop;

  return created_estimate_id;
end;
$$;

revoke all on function public.create_bontraco_estimate(
  uuid, uuid, text, numeric, date, text, text, jsonb
) from public, anon;
grant execute on function public.create_bontraco_estimate(
  uuid, uuid, text, numeric, date, text, text, jsonb
) to authenticated;
