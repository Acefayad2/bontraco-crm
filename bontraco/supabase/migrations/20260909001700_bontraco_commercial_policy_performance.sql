-- Avoid duplicate SELECT policy evaluation while preserving draft-only mutations.

drop policy estimate_items_manage_draft on public.estimate_items;
create policy estimate_items_insert_draft on public.estimate_items for insert to authenticated
with check (exists (
  select 1 from public.estimates e
  where e.id = estimate_id and e.account_id = account_id and e.status = 'draft'
    and public.can_access_commercial_job(e.account_id, e.job_id)
));
create policy estimate_items_update_draft on public.estimate_items for update to authenticated
using (exists (
  select 1 from public.estimates e
  where e.id = estimate_id and e.account_id = account_id and e.status = 'draft'
    and public.can_access_commercial_job(e.account_id, e.job_id)
))
with check (exists (
  select 1 from public.estimates e
  where e.id = estimate_id and e.account_id = account_id and e.status = 'draft'
    and public.can_access_commercial_job(e.account_id, e.job_id)
));
create policy estimate_items_delete_draft on public.estimate_items for delete to authenticated
using (exists (
  select 1 from public.estimates e
  where e.id = estimate_id and e.account_id = account_id and e.status = 'draft'
    and public.can_access_commercial_job(e.account_id, e.job_id)
));

drop policy invoice_items_manage_draft on public.invoice_items;
create policy invoice_items_insert_draft on public.invoice_items for insert to authenticated
with check (exists (
  select 1 from public.invoices i
  where i.id = invoice_id and i.account_id = account_id and i.status = 'draft'
    and public.can_access_commercial_job(i.account_id, i.job_id)
));
create policy invoice_items_update_draft on public.invoice_items for update to authenticated
using (exists (
  select 1 from public.invoices i
  where i.id = invoice_id and i.account_id = account_id and i.status = 'draft'
    and public.can_access_commercial_job(i.account_id, i.job_id)
))
with check (exists (
  select 1 from public.invoices i
  where i.id = invoice_id and i.account_id = account_id and i.status = 'draft'
    and public.can_access_commercial_job(i.account_id, i.job_id)
));
create policy invoice_items_delete_draft on public.invoice_items for delete to authenticated
using (exists (
  select 1 from public.invoices i
  where i.id = invoice_id and i.account_id = account_id and i.status = 'draft'
    and public.can_access_commercial_job(i.account_id, i.job_id)
));

create trigger payments_preserve_created_by before update on public.payments
for each row execute function public.preserve_created_by();
