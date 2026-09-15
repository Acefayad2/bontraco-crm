-- Store an immutable account-scoped email snapshot for team administration.

alter table public.memberships add column email text;

update public.memberships m
set email = lower(u.email)
from auth.users u
where u.id = m.user_id;

alter table public.memberships alter column email set not null;
alter table public.memberships add constraint memberships_email_lowercase check (email = lower(email));
create index memberships_account_email_idx on public.memberships (account_id, email);

create or replace function public.set_membership_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select lower(email) into new.email from auth.users where id = new.user_id;
  if new.email is null then
    raise exception 'Membership user does not exist';
  end if;
  return new;
end;
$$;

revoke all on function public.set_membership_email() from public;
revoke execute on function public.set_membership_email() from anon, authenticated;

create trigger memberships_set_email
before insert on public.memberships
for each row execute function public.set_membership_email();
