-- Record role and access changes while keeping team-security history manager-private.

drop policy if exists activities_select_visible_record on public.activities;
create policy activities_select_visible_record
on public.activities
for select
to authenticated
using (
  case
    when kind like 'team_%' then
      public.has_account_role(
        account_id,
        array['owner', 'admin']::public.bontraco_member_role[]
      )
    else
      public.has_account_role(
        account_id,
        array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[]
      )
      or actor_id = (select auth.uid())
      or exists (
        select 1 from public.contacts c
        where c.id = contact_id
          and c.account_id = account_id
          and public.can_access_assigned_record(c.account_id, c.assigned_to)
      )
      or exists (
        select 1 from public.leads l
        where l.id = lead_id
          and l.account_id = account_id
          and public.can_access_assigned_record(l.account_id, l.assigned_to)
      )
      or exists (
        select 1 from public.jobs j
        where j.id = job_id
          and j.account_id = account_id
          and public.can_access_assigned_record(j.account_id, j.assigned_to)
      )
  end
);

create or replace function public.record_bontraco_membership_activity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_label text := coalesce(nullif(trim(new.display_name), ''), new.email);
begin
  if old.role is distinct from new.role then
    insert into public.activities (account_id, actor_id, kind, summary, metadata)
    values (
      new.account_id,
      (select auth.uid()),
      'team_role_changed',
      'Team role changed for ' || target_label || ': ' || old.role || ' to ' || new.role,
      jsonb_build_object(
        'target_user_id', new.user_id,
        'old_role', old.role,
        'new_role', new.role
      )
    );
  end if;

  if old.active is distinct from new.active then
    insert into public.activities (account_id, actor_id, kind, summary, metadata)
    values (
      new.account_id,
      (select auth.uid()),
      'team_access_changed',
      'Team access ' || case when new.active then 'reactivated' else 'deactivated' end
        || ' for ' || target_label,
      jsonb_build_object(
        'target_user_id', new.user_id,
        'old_active', old.active,
        'new_active', new.active
      )
    );
  end if;

  return new;
end;
$$;

revoke all on function public.record_bontraco_membership_activity()
from public, anon, authenticated;

create trigger memberships_record_activity
after update of role, active on public.memberships
for each row
when (old.role is distinct from new.role or old.active is distinct from new.active)
execute function public.record_bontraco_membership_activity();
