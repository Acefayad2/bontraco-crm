-- Tenant-safe in-app alerts for high-value lead and receptionist events.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  lead_id uuid,
  call_id uuid,
  kind text not null check (kind in ('new_lead', 'urgent_call', 'appointment_booked', 'system')),
  title text not null check (char_length(trim(title)) between 2 and 160),
  body text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_account_lead_fkey
    foreign key (account_id, lead_id) references public.leads(account_id, id) on delete cascade,
  constraint notifications_account_call_fkey
    foreign key (account_id, call_id) references public.calls(account_id, id) on delete cascade
);

create index notifications_account_time_idx
  on public.notifications (account_id, created_at desc);
create index notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;
create index notifications_account_lead_idx
  on public.notifications (account_id, lead_id)
  where lead_id is not null;
create index notifications_account_call_idx
  on public.notifications (account_id, call_id)
  where call_id is not null;

alter table public.notifications enable row level security;

create policy notifications_select_relevant
on public.notifications for select to authenticated
using (
  (user_id is null and public.has_account_role(
    account_id,
    array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[]
  ))
  or user_id = (select auth.uid())
  or (
    lead_id is not null and exists (
      select 1 from public.leads l
      where l.account_id = notifications.account_id
        and l.id = notifications.lead_id
        and public.can_access_assigned_record(l.account_id, l.assigned_to)
    )
  )
  or (
    call_id is not null and exists (
      select 1 from public.calls c
      where c.account_id = notifications.account_id
        and c.id = notifications.call_id
        and public.can_access_assigned_record(c.account_id, c.assigned_to)
    )
  )
);

create policy notifications_update_relevant
on public.notifications for update to authenticated
using (
  user_id = (select auth.uid())
  or public.has_account_role(
    account_id,
    array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[]
  )
)
with check (
  user_id = (select auth.uid())
  or public.has_account_role(
    account_id,
    array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[]
  )
);

grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
revoke all on table public.notifications from anon;

create or replace function public.notify_high_value_lead()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.score, 0) >= 80 then
    insert into public.notifications (
      account_id, lead_id, kind, title, body, metadata
    ) values (
      new.account_id,
      new.id,
      'new_lead',
      'New high-priority lead',
      new.title,
      jsonb_build_object(
        'score', new.score,
        'source', new.source,
        'has_phone', new.contact_phone is not null,
        'location', new.location_text
      )
    );
  end if;
  return new;
end;
$$;

revoke all on function public.notify_high_value_lead() from public;
revoke execute on function public.notify_high_value_lead() from anon, authenticated;

create trigger leads_create_priority_notification
after insert on public.leads
for each row execute function public.notify_high_value_lead();
