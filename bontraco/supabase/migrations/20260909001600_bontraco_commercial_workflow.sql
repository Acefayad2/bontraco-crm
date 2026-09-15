-- Estimates, invoices, and payments for the Bontraco job-to-cash workflow.

create or replace function public.can_access_commercial_job(target_account_id uuid, target_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.jobs j
    where j.account_id = target_account_id
      and j.id = target_job_id
      and public.can_access_assigned_record(j.account_id, j.assigned_to)
      and public.has_account_role(
        j.account_id,
        array['owner', 'admin', 'dispatcher', 'sales']::public.bontraco_member_role[]
      )
  );
$$;

revoke all on function public.can_access_commercial_job(uuid, uuid) from public;
revoke execute on function public.can_access_commercial_job(uuid, uuid) from anon;
grant execute on function public.can_access_commercial_job(uuid, uuid) to authenticated;

create table public.pricebook_items (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  trade public.bontraco_trade not null,
  code text not null check (char_length(trim(code)) between 1 and 40),
  name text not null check (char_length(trim(name)) between 2 and 160),
  description text,
  unit text not null default 'each' check (char_length(unit) between 1 and 30),
  unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  taxable boolean not null default true,
  active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, code),
  unique (account_id, id)
);

create table public.estimates (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  job_id uuid not null,
  estimate_number text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired', 'void')),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  tax_rate numeric(7,6) not null default 0 check (tax_rate between 0 and 1),
  tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  valid_until date,
  customer_note text,
  terms text,
  sent_at timestamptz,
  accepted_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, estimate_number),
  unique (account_id, id),
  constraint estimates_account_job_fkey foreign key (account_id, job_id)
    references public.jobs(account_id, id) on delete cascade
);

create table public.estimate_items (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  estimate_id uuid not null,
  pricebook_item_id uuid,
  sort_order integer not null default 0,
  description text not null check (char_length(trim(description)) between 1 and 500),
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit text not null default 'each',
  unit_price numeric(12,2) not null check (unit_price >= 0),
  unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
  taxable boolean not null default true,
  line_total numeric(12,2) generated always as (round(quantity * unit_price, 2)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint estimate_items_account_estimate_fkey foreign key (account_id, estimate_id)
    references public.estimates(account_id, id) on delete cascade,
  constraint estimate_items_account_pricebook_fkey foreign key (account_id, pricebook_item_id)
    references public.pricebook_items(account_id, id) on delete set null (pricebook_item_id)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  job_id uuid not null,
  estimate_id uuid,
  invoice_number text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'partial', 'paid', 'overdue', 'void')),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  tax_rate numeric(7,6) not null default 0 check (tax_rate between 0 and 1),
  tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  balance_due numeric(12,2) not null default 0 check (balance_due >= 0),
  issued_at timestamptz,
  due_date date,
  paid_at timestamptz,
  customer_note text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, invoice_number),
  unique (account_id, id),
  unique (account_id, estimate_id),
  constraint invoices_account_job_fkey foreign key (account_id, job_id)
    references public.jobs(account_id, id) on delete cascade,
  constraint invoices_account_estimate_fkey foreign key (account_id, estimate_id)
    references public.estimates(account_id, id) on delete set null (estimate_id)
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  invoice_id uuid not null,
  sort_order integer not null default 0,
  description text not null check (char_length(trim(description)) between 1 and 500),
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit text not null default 'each',
  unit_price numeric(12,2) not null check (unit_price >= 0),
  taxable boolean not null default true,
  line_total numeric(12,2) generated always as (round(quantity * unit_price, 2)) stored,
  created_at timestamptz not null default now(),
  constraint invoice_items_account_invoice_fkey foreign key (account_id, invoice_id)
    references public.invoices(account_id, id) on delete cascade
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  invoice_id uuid not null,
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'succeeded' check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  method text not null default 'other' check (method in ('cash', 'check', 'card', 'ach', 'financing', 'other')),
  provider text,
  provider_payment_id text,
  note text,
  received_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (provider, provider_payment_id),
  constraint payments_account_invoice_fkey foreign key (account_id, invoice_id)
    references public.invoices(account_id, id) on delete cascade
);

create index pricebook_items_account_trade_idx on public.pricebook_items (account_id, trade, active);
create index pricebook_items_created_by_idx on public.pricebook_items (created_by);
create index estimates_account_job_idx on public.estimates (account_id, job_id, created_at desc);
create index estimates_created_by_idx on public.estimates (created_by);
create index estimate_items_account_estimate_idx on public.estimate_items (account_id, estimate_id, sort_order);
create index estimate_items_account_pricebook_idx on public.estimate_items (account_id, pricebook_item_id) where pricebook_item_id is not null;
create index invoices_account_job_idx on public.invoices (account_id, job_id, created_at desc);
create index invoices_account_estimate_idx on public.invoices (account_id, estimate_id) where estimate_id is not null;
create index invoices_created_by_idx on public.invoices (created_by);
create index invoice_items_account_invoice_idx on public.invoice_items (account_id, invoice_id, sort_order);
create index payments_account_invoice_idx on public.payments (account_id, invoice_id, received_at desc);
create index payments_created_by_idx on public.payments (created_by) where created_by is not null;

create trigger pricebook_items_touch_updated_at before update on public.pricebook_items
for each row execute function public.touch_updated_at();
create trigger estimates_touch_updated_at before update on public.estimates
for each row execute function public.touch_updated_at();
create trigger estimate_items_touch_updated_at before update on public.estimate_items
for each row execute function public.touch_updated_at();
create trigger invoices_touch_updated_at before update on public.invoices
for each row execute function public.touch_updated_at();

create trigger pricebook_items_preserve_created_by before update on public.pricebook_items
for each row execute function public.preserve_created_by();
create trigger estimates_preserve_created_by before update on public.estimates
for each row execute function public.preserve_created_by();
create trigger invoices_preserve_created_by before update on public.invoices
for each row execute function public.preserve_created_by();

create or replace function public.recalculate_estimate_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare target_estimate_id uuid;
begin
  target_estimate_id := case when tg_op = 'DELETE' then old.estimate_id else new.estimate_id end;
  update public.estimates e
  set
    subtotal = totals.subtotal,
    tax_amount = round(totals.taxable_subtotal * e.tax_rate, 2),
    total = totals.subtotal + round(totals.taxable_subtotal * e.tax_rate, 2)
  from (
    select
      coalesce(sum(i.line_total), 0)::numeric(12,2) as subtotal,
      coalesce(sum(i.line_total) filter (where i.taxable), 0)::numeric(12,2) as taxable_subtotal
    from public.estimate_items i where i.estimate_id = target_estimate_id
  ) totals
  where e.id = target_estimate_id;
  return coalesce(new, old);
end;
$$;

create trigger estimate_items_recalculate
after insert or update or delete on public.estimate_items
for each row execute function public.recalculate_estimate_totals();

create or replace function public.recalculate_invoice_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare target_invoice_id uuid;
begin
  target_invoice_id := case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;

  update public.invoices i
  set
    subtotal = values_row.subtotal,
    tax_amount = values_row.tax_amount,
    total = values_row.subtotal + values_row.tax_amount,
    amount_paid = values_row.amount_paid,
    balance_due = greatest(values_row.subtotal + values_row.tax_amount - values_row.amount_paid, 0),
    status = case
      when i.status = 'void' then 'void'
      when values_row.amount_paid >= values_row.subtotal + values_row.tax_amount
        and values_row.subtotal + values_row.tax_amount > 0 then 'paid'
      when values_row.amount_paid > 0 then 'partial'
      else i.status
    end,
    paid_at = case
      when values_row.amount_paid >= values_row.subtotal + values_row.tax_amount
        and values_row.subtotal + values_row.tax_amount > 0 then coalesce(i.paid_at, now())
      else null
    end
  from (
    select
      coalesce((select sum(ii.line_total) from public.invoice_items ii where ii.invoice_id = target_invoice_id), 0)::numeric(12,2) as subtotal,
      coalesce((
        select round(coalesce(sum(ii.line_total) filter (where ii.taxable), 0) * inv.tax_rate, 2)
        from public.invoices inv
        left join public.invoice_items ii on ii.invoice_id = inv.id
        where inv.id = target_invoice_id
        group by inv.tax_rate
      ), 0)::numeric(12,2) as tax_amount,
      coalesce((select sum(p.amount) from public.payments p where p.invoice_id = target_invoice_id and p.status = 'succeeded'), 0)::numeric(12,2) as amount_paid
  ) values_row
  where i.id = target_invoice_id;
  return coalesce(new, old);
end;
$$;

create trigger invoice_items_recalculate after insert or update or delete on public.invoice_items
for each row execute function public.recalculate_invoice_balance();
create trigger payments_recalculate after insert or update or delete on public.payments
for each row execute function public.recalculate_invoice_balance();

revoke all on function public.recalculate_estimate_totals() from public;
revoke execute on function public.recalculate_estimate_totals() from anon, authenticated;
revoke all on function public.recalculate_invoice_balance() from public;
revoke execute on function public.recalculate_invoice_balance() from anon, authenticated;

create or replace function public.create_invoice_from_estimate(
  target_estimate_id uuid,
  target_invoice_number text,
  target_due_date date default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  source_estimate public.estimates%rowtype;
  created_invoice_id uuid;
begin
  select * into source_estimate
  from public.estimates
  where id = target_estimate_id;

  if not found then
    raise exception 'Estimate not found or unavailable';
  end if;

  if source_estimate.status <> 'accepted' then
    raise exception 'Only accepted estimates can become invoices';
  end if;

  if public.can_access_commercial_job(source_estimate.account_id, source_estimate.job_id) is not true then
    raise exception 'Not authorized for this job';
  end if;

  insert into public.invoices (
    account_id, job_id, estimate_id, invoice_number, status, tax_rate,
    issued_at, due_date, customer_note, created_by
  ) values (
    source_estimate.account_id, source_estimate.job_id, source_estimate.id,
    trim(target_invoice_number), 'draft', source_estimate.tax_rate,
    now(), target_due_date, source_estimate.customer_note, auth.uid()
  )
  on conflict (account_id, estimate_id) do update
    set invoice_number = public.invoices.invoice_number
  returning id into created_invoice_id;

  if not exists (select 1 from public.invoice_items where invoice_id = created_invoice_id) then
    insert into public.invoice_items (
      account_id, invoice_id, sort_order, description, quantity, unit, unit_price, taxable
    )
    select
      account_id, created_invoice_id, sort_order, description, quantity, unit, unit_price, taxable
    from public.estimate_items
    where estimate_id = source_estimate.id
    order by sort_order, created_at;
  end if;

  return created_invoice_id;
end;
$$;

revoke all on function public.create_invoice_from_estimate(uuid, text, date) from public;
revoke execute on function public.create_invoice_from_estimate(uuid, text, date) from anon;
grant execute on function public.create_invoice_from_estimate(uuid, text, date) to authenticated;

alter table public.pricebook_items enable row level security;
alter table public.estimates enable row level security;
alter table public.estimate_items enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;

create policy pricebook_select_commercial on public.pricebook_items for select to authenticated
using (public.has_account_role(account_id, array['owner','admin','dispatcher','sales']::public.bontraco_member_role[]));
create policy pricebook_insert_admin on public.pricebook_items for insert to authenticated
with check (created_by = (select auth.uid()) and public.has_account_role(account_id, array['owner','admin']::public.bontraco_member_role[]));
create policy pricebook_update_admin on public.pricebook_items for update to authenticated
using (public.has_account_role(account_id, array['owner','admin']::public.bontraco_member_role[]))
with check (public.has_account_role(account_id, array['owner','admin']::public.bontraco_member_role[]));
create policy pricebook_delete_admin on public.pricebook_items for delete to authenticated
using (public.has_account_role(account_id, array['owner','admin']::public.bontraco_member_role[]));

create policy estimates_select_visible on public.estimates for select to authenticated
using (public.can_access_commercial_job(account_id, job_id));
create policy estimates_insert_visible on public.estimates for insert to authenticated
with check (created_by = (select auth.uid()) and public.can_access_commercial_job(account_id, job_id));
create policy estimates_update_visible on public.estimates for update to authenticated
using (public.can_access_commercial_job(account_id, job_id))
with check (public.can_access_commercial_job(account_id, job_id));
create policy estimates_delete_draft on public.estimates for delete to authenticated
using (status = 'draft' and public.can_access_commercial_job(account_id, job_id));

create policy estimate_items_select_visible on public.estimate_items for select to authenticated
using (exists (select 1 from public.estimates e where e.id = estimate_id and e.account_id = account_id and public.can_access_commercial_job(e.account_id, e.job_id)));
create policy estimate_items_manage_draft on public.estimate_items for all to authenticated
using (exists (select 1 from public.estimates e where e.id = estimate_id and e.account_id = account_id and e.status = 'draft' and public.can_access_commercial_job(e.account_id, e.job_id)))
with check (exists (select 1 from public.estimates e where e.id = estimate_id and e.account_id = account_id and e.status = 'draft' and public.can_access_commercial_job(e.account_id, e.job_id)));

create policy invoices_select_visible on public.invoices for select to authenticated
using (public.can_access_commercial_job(account_id, job_id));
create policy invoices_insert_visible on public.invoices for insert to authenticated
with check (created_by = (select auth.uid()) and public.can_access_commercial_job(account_id, job_id));
create policy invoices_update_visible on public.invoices for update to authenticated
using (public.can_access_commercial_job(account_id, job_id))
with check (public.can_access_commercial_job(account_id, job_id));

create policy invoice_items_select_visible on public.invoice_items for select to authenticated
using (exists (select 1 from public.invoices i where i.id = invoice_id and i.account_id = account_id and public.can_access_commercial_job(i.account_id, i.job_id)));
create policy invoice_items_manage_draft on public.invoice_items for all to authenticated
using (exists (select 1 from public.invoices i where i.id = invoice_id and i.account_id = account_id and i.status = 'draft' and public.can_access_commercial_job(i.account_id, i.job_id)))
with check (exists (select 1 from public.invoices i where i.id = invoice_id and i.account_id = account_id and i.status = 'draft' and public.can_access_commercial_job(i.account_id, i.job_id)));

create policy payments_select_visible on public.payments for select to authenticated
using (exists (select 1 from public.invoices i where i.id = invoice_id and i.account_id = account_id and public.can_access_commercial_job(i.account_id, i.job_id)));
create policy payments_insert_staff on public.payments for insert to authenticated
with check (created_by = (select auth.uid()) and public.has_account_role(account_id, array['owner','admin','dispatcher']::public.bontraco_member_role[]));
create policy payments_update_staff on public.payments for update to authenticated
using (public.has_account_role(account_id, array['owner','admin','dispatcher']::public.bontraco_member_role[]))
with check (public.has_account_role(account_id, array['owner','admin','dispatcher']::public.bontraco_member_role[]));
create policy payments_delete_staff on public.payments for delete to authenticated
using (public.has_account_role(account_id, array['owner','admin','dispatcher']::public.bontraco_member_role[]));

grant select, insert, update, delete on public.pricebook_items to authenticated;
grant select, insert, update, delete on public.estimates to authenticated;
grant select, insert, update, delete on public.estimate_items to authenticated;
grant select, insert, update on public.invoices to authenticated;
grant select, insert, update, delete on public.invoice_items to authenticated;
grant select, insert, update, delete on public.payments to authenticated;

revoke all on public.pricebook_items, public.estimates, public.estimate_items, public.invoices, public.invoice_items, public.payments from anon;
