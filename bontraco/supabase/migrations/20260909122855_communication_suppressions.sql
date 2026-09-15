-- Durable consent history and do-not-contact enforcement for every workspace.

create table public.communication_suppressions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  contact_id uuid,
  channel text not null check (channel in ('voice', 'sms', 'email')),
  destination text not null check (
    (channel = 'email' and destination = lower(btrim(destination)) and destination ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
    or (channel in ('voice', 'sms') and destination ~ '^\+[1-9][0-9]{7,14}$')
  ),
  reason text not null check (char_length(btrim(reason)) between 2 and 500),
  source text not null check (source in ('manual', 'recipient_request', 'provider', 'complaint', 'import')),
  created_by uuid not null references auth.users(id),
  suppressed_at timestamptz not null default now(),
  lifted_at timestamptz,
  lifted_by uuid references auth.users(id),
  lift_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint communication_suppressions_contact_fkey
    foreign key (account_id, contact_id) references public.contacts(account_id, id) on delete cascade,
  constraint communication_suppressions_lift_check check (
    (lifted_at is null and lifted_by is null and lift_reason is null)
    or (
      lifted_at is not null
      and lifted_by is not null
      and lift_reason is not null
      and char_length(btrim(lift_reason)) between 2 and 500
      and lifted_at >= suppressed_at
    )
  )
);

create unique index communication_suppressions_active_destination_idx
  on public.communication_suppressions (account_id, channel, destination)
  where lifted_at is null;
create index communication_suppressions_contact_idx
  on public.communication_suppressions (account_id, contact_id, suppressed_at desc);

create table public.communication_consents (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  contact_id uuid,
  channel text not null check (channel in ('voice', 'sms', 'email')),
  purpose text not null check (purpose in ('marketing', 'transactional', 'artificial_voice', 'recording')),
  destination text not null check (
    (channel = 'email' and destination = lower(btrim(destination)) and destination ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
    or (channel in ('voice', 'sms') and destination ~ '^\+[1-9][0-9]{7,14}$')
  ),
  status text not null check (status in ('granted', 'revoked')),
  source text not null check (source in ('written', 'web_form', 'recorded_call', 'manual', 'provider', 'import')),
  disclosure_version text not null check (char_length(btrim(disclosure_version)) between 1 and 100),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
  recorded_at timestamptz not null default now(),
  expires_at timestamptz check (expires_at is null or expires_at > recorded_at),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint communication_consents_contact_fkey
    foreign key (account_id, contact_id) references public.contacts(account_id, id) on delete cascade
);

create index communication_consents_effective_idx
  on public.communication_consents (account_id, channel, purpose, destination, recorded_at desc);
create index communication_consents_contact_idx
  on public.communication_consents (account_id, contact_id, recorded_at desc);

alter table public.communication_suppressions enable row level security;
alter table public.communication_consents enable row level security;

create policy communication_suppressions_select_visible
on public.communication_suppressions for select to authenticated
using (
  public.has_account_role(
    account_id,
    array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[]
  )
  or (
    public.has_account_role(account_id, array['sales']::public.bontraco_member_role[])
    and contact_id is not null
    and exists (
      select 1 from public.contacts c
      where c.account_id = communication_suppressions.account_id
        and c.id = communication_suppressions.contact_id
        and c.assigned_to = (select auth.uid())
    )
  )
);

create policy communication_suppressions_insert_visible
on public.communication_suppressions for insert to authenticated
with check (
  created_by = (select auth.uid())
  and lifted_at is null
  and (
    public.has_account_role(
      account_id,
      array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[]
    )
    or (
      public.has_account_role(account_id, array['sales']::public.bontraco_member_role[])
      and contact_id is not null
      and exists (
        select 1 from public.contacts c
        where c.account_id = communication_suppressions.account_id
          and c.id = communication_suppressions.contact_id
          and c.assigned_to = (select auth.uid())
      )
    )
  )
);

create policy communication_suppressions_lift_admin
on public.communication_suppressions for update to authenticated
using (
  lifted_at is null
  and public.has_account_role(
    account_id,
    array['owner', 'admin']::public.bontraco_member_role[]
  )
)
with check (
  public.has_account_role(
    account_id,
    array['owner', 'admin']::public.bontraco_member_role[]
  )
);

create policy communication_consents_select_visible
on public.communication_consents for select to authenticated
using (
  public.has_account_role(
    account_id,
    array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[]
  )
  or (
    public.has_account_role(account_id, array['sales']::public.bontraco_member_role[])
    and contact_id is not null
    and exists (
      select 1 from public.contacts c
      where c.account_id = communication_consents.account_id
        and c.id = communication_consents.contact_id
        and c.assigned_to = (select auth.uid())
    )
  )
);

create policy communication_consents_insert_visible
on public.communication_consents for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (
    public.has_account_role(
      account_id,
      array['owner', 'admin', 'dispatcher']::public.bontraco_member_role[]
    )
    or (
      public.has_account_role(account_id, array['sales']::public.bontraco_member_role[])
      and contact_id is not null
      and exists (
        select 1 from public.contacts c
        where c.account_id = communication_consents.account_id
          and c.id = communication_consents.contact_id
          and c.assigned_to = (select auth.uid())
      )
    )
  )
);

create or replace function public.validate_communication_suppression_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.lifted_at is not null then
    raise exception 'A lifted suppression is immutable';
  end if;
  if new.id is distinct from old.id
    or new.account_id is distinct from old.account_id
    or new.contact_id is distinct from old.contact_id
    or new.channel is distinct from old.channel
    or new.destination is distinct from old.destination
    or new.reason is distinct from old.reason
    or new.source is distinct from old.source
    or new.created_by is distinct from old.created_by
    or new.suppressed_at is distinct from old.suppressed_at
    or new.created_at is distinct from old.created_at then
    raise exception 'Suppression evidence is immutable';
  end if;
  if new.lifted_at is null
    or new.lifted_by is distinct from (select auth.uid())
    or new.lift_reason is null
    or char_length(btrim(new.lift_reason)) < 2 then
    raise exception 'Lifting requires the current actor, timestamp, and reason';
  end if;
  return new;
end;
$$;

create trigger communication_suppressions_validate_update
before update on public.communication_suppressions
for each row execute function public.validate_communication_suppression_update();
create trigger communication_suppressions_touch_updated_at
before update on public.communication_suppressions
for each row execute function public.touch_updated_at();

create or replace function public.audit_communication_preference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'communication_consents' then
    insert into public.activities (account_id, actor_id, contact_id, kind, summary, metadata)
    values (
      new.account_id,
      new.created_by,
      new.contact_id,
      'communication_consent_' || new.status,
      case when new.status = 'granted' then 'Communication consent recorded' else 'Communication consent revoked' end,
      jsonb_build_object('channel', new.channel, 'purpose', new.purpose, 'source', new.source)
    );
  elsif tg_op = 'INSERT' then
    insert into public.activities (account_id, actor_id, contact_id, kind, summary, metadata)
    values (
      new.account_id,
      new.created_by,
      new.contact_id,
      'communication_suppressed',
      'Do-not-contact preference recorded',
      jsonb_build_object('channel', new.channel, 'source', new.source)
    );
  elsif old.lifted_at is null and new.lifted_at is not null then
    insert into public.activities (account_id, actor_id, contact_id, kind, summary, metadata)
    values (
      new.account_id,
      new.lifted_by,
      new.contact_id,
      'communication_suppression_lifted',
      'Do-not-contact preference lifted',
      jsonb_build_object('channel', new.channel)
    );
  end if;
  return new;
end;
$$;

create trigger communication_consents_audit
after insert on public.communication_consents
for each row execute function public.audit_communication_preference();
create trigger communication_suppressions_audit
after insert or update on public.communication_suppressions
for each row execute function public.audit_communication_preference();

create or replace function public.is_communication_suppressed(
  target_account_id uuid,
  target_channel text,
  target_destination text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.communication_suppressions s
    where s.account_id = target_account_id
      and s.channel = target_channel
      and s.destination = case
        when target_channel = 'email' then lower(btrim(target_destination))
        else target_destination
      end
      and s.lifted_at is null
  );
$$;

create or replace function public.has_active_communication_consent(
  target_account_id uuid,
  target_channel text,
  target_purpose text,
  target_destination text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not public.is_communication_suppressed(target_account_id, target_channel, target_destination)
    and coalesce((
      select c.status = 'granted' and (c.expires_at is null or c.expires_at > now())
      from public.communication_consents c
      where c.account_id = target_account_id
        and c.channel = target_channel
        and c.purpose = target_purpose
        and c.destination = case
          when target_channel = 'email' then lower(btrim(target_destination))
          else target_destination
        end
      order by c.recorded_at desc, c.created_at desc
      limit 1
    ), false);
$$;

revoke all on public.communication_suppressions, public.communication_consents from anon;
grant select, insert, update on public.communication_suppressions to authenticated;
grant select, insert on public.communication_consents to authenticated;

revoke all on function public.validate_communication_suppression_update() from public, anon, authenticated;
revoke all on function public.audit_communication_preference() from public, anon, authenticated;
revoke all on function public.is_communication_suppressed(uuid, text, text) from public, anon, authenticated;
revoke all on function public.has_active_communication_consent(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.is_communication_suppressed(uuid, text, text) to service_role;
grant execute on function public.has_active_communication_consent(uuid, text, text, text) to service_role;
