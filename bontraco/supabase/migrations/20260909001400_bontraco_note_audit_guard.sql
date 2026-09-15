-- Preserve note authorship as immutable audit data.

create or replace function public.preserve_created_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by cannot be changed';
  end if;
  return new;
end;
$$;

revoke all on function public.preserve_created_by() from public;
revoke execute on function public.preserve_created_by() from anon, authenticated;

create trigger notes_preserve_created_by
before update on public.notes
for each row execute function public.preserve_created_by();
