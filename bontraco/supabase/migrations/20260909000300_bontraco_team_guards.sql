-- Protect account ownership and add secure invitation acceptance.

drop policy if exists memberships_insert_admin on public.memberships;
drop policy if exists memberships_update_admin on public.memberships;

create policy memberships_insert_admin on public.memberships for insert to authenticated
with check (
  role <> 'owner'
  and public.has_account_role(account_id, array['owner', 'admin']::public.bontraco_member_role[])
);

create policy memberships_update_admin on public.memberships for update to authenticated
using (
  role <> 'owner'
  and public.has_account_role(account_id, array['owner', 'admin']::public.bontraco_member_role[])
)
with check (
  role <> 'owner'
  and public.has_account_role(account_id, array['owner', 'admin']::public.bontraco_member_role[])
);

create or replace function public.accept_bontraco_invitation(raw_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_invitation public.invitations%rowtype;
  authenticated_email text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  authenticated_email := lower(coalesce((select auth.jwt() ->> 'email'), ''));

  select * into matched_invitation
  from public.invitations
  where token_digest = encode(extensions.digest(raw_token, 'sha256'), 'hex')
    and accepted_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Invitation is invalid or expired';
  end if;

  if authenticated_email = '' or authenticated_email <> matched_invitation.email then
    raise exception 'Sign in with the email address that received this invitation';
  end if;

  if exists (
    select 1 from public.memberships
    where user_id = (select auth.uid()) and active
  ) then
    raise exception 'User already belongs to an active Bontraco account';
  end if;

  insert into public.memberships (account_id, user_id, role, display_name)
  values (
    matched_invitation.account_id,
    (select auth.uid()),
    matched_invitation.role,
    nullif(trim(coalesce((select auth.jwt() -> 'user_metadata' ->> 'full_name'), '')), '')
  );

  update public.invitations
  set accepted_at = now()
  where id = matched_invitation.id;

  return matched_invitation.account_id;
end;
$$;

revoke all on function public.accept_bontraco_invitation(text) from public;
revoke execute on function public.accept_bontraco_invitation(text) from anon;
grant execute on function public.accept_bontraco_invitation(text) to authenticated;
