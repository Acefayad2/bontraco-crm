create or replace function private.enforce_bontraco_estimate_line_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  first_estimate_id uuid;
  second_estimate_id uuid;
begin
  if tg_table_name = 'estimates' then
    first_estimate_id := new.id;
  elsif tg_op = 'DELETE' then
    first_estimate_id := old.estimate_id;
  else
    first_estimate_id := old.estimate_id;
    if new.estimate_id is distinct from old.estimate_id then
      second_estimate_id := new.estimate_id;
    end if;
  end if;

  if exists (select 1 from public.estimates where id = first_estimate_id)
    and not exists (
      select 1 from public.estimate_items where estimate_id = first_estimate_id
    )
  then
    raise check_violation using message = 'An estimate requires at least one line item';
  end if;

  if second_estimate_id is not null
    and exists (select 1 from public.estimates where id = second_estimate_id)
    and not exists (
      select 1 from public.estimate_items where estimate_id = second_estimate_id
    )
  then
    raise check_violation using message = 'An estimate requires at least one line item';
  end if;

  return null;
end;
$$;

revoke all on function private.enforce_bontraco_estimate_line_scope()
from public, anon, authenticated;

create constraint trigger estimates_require_line_items
after insert on public.estimates
deferrable initially deferred
for each row execute function private.enforce_bontraco_estimate_line_scope();

create constraint trigger estimate_items_preserve_scope
after delete or update of estimate_id on public.estimate_items
deferrable initially deferred
for each row execute function private.enforce_bontraco_estimate_line_scope();
