-- Trade-specific field checklists generated for every job and protected by job visibility.

create table public.job_checklist_items (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  job_id uuid not null,
  trade public.bontraco_trade not null,
  code text not null check (code ~ '^[a-z0-9_]+$'),
  category text not null check (category in ('safety', 'diagnosis', 'documentation', 'production', 'closeout')),
  label text not null check (char_length(label) between 3 and 240),
  required boolean not null default true,
  sort_order smallint not null check (sort_order between 1 and 100),
  completed_at timestamptz,
  completed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, job_id, code),
  constraint job_checklist_items_job_fkey
    foreign key (account_id, job_id) references public.jobs(account_id, id) on delete cascade,
  constraint job_checklist_items_completed_by_fkey
    foreign key (account_id, completed_by) references public.memberships(account_id, user_id)
    on delete set null (completed_by),
  constraint job_checklist_completion_pair check (
    completed_at is not null or completed_by is null
  )
);

create index job_checklist_items_job_order_idx
  on public.job_checklist_items (account_id, job_id, sort_order);
create index job_checklist_items_incomplete_idx
  on public.job_checklist_items (account_id, job_id, required)
  where completed_at is null;
create index job_checklist_items_completed_by_idx
  on public.job_checklist_items (account_id, completed_by)
  where completed_by is not null;

create trigger job_checklist_items_touch_updated_at
before update on public.job_checklist_items
for each row execute function public.touch_updated_at();

create or replace function public.seed_bontraco_job_checklist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.trade = 'roofing' then
    insert into public.job_checklist_items (account_id, job_id, trade, code, category, label, sort_order) values
      (new.account_id, new.id, new.trade, 'site_weather_hazards', 'safety', 'Confirm weather, roof access, and site hazards before climbing', 10),
      (new.account_id, new.id, new.trade, 'fall_protection', 'safety', 'Set ladder, fall-protection, and ground-control plan', 20),
      (new.account_id, new.id, new.trade, 'interior_leak_check', 'diagnosis', 'Inspect and document interior leak or moisture locations', 30),
      (new.account_id, new.id, new.trade, 'roof_measurements_photos', 'documentation', 'Capture measurements and required slope, flashing, and damage photos', 40),
      (new.account_id, new.id, new.trade, 'materials_permit_scope', 'production', 'Confirm material, ventilation, permit, and scope requirements', 50),
      (new.account_id, new.id, new.trade, 'final_roof_inspection', 'closeout', 'Complete final roof and flashing inspection', 60),
      (new.account_id, new.id, new.trade, 'magnet_cleanup', 'closeout', 'Complete ground sweep, magnet cleanup, and customer handoff', 70);
  elsif new.trade = 'plumbing' then
    insert into public.job_checklist_items (account_id, job_id, trade, code, category, label, sort_order) values
      (new.account_id, new.id, new.trade, 'shutoff_location', 'safety', 'Locate and verify the appropriate water or gas shutoff', 10),
      (new.account_id, new.id, new.trade, 'active_hazards', 'safety', 'Check active leak, contamination, electrical, gas, and scald hazards', 20),
      (new.account_id, new.id, new.trade, 'diagnostic_readings', 'diagnosis', 'Record pressure, temperature, drainage, or equipment diagnostics', 30),
      (new.account_id, new.id, new.trade, 'protect_work_area', 'production', 'Protect the work area and control water before service', 40),
      (new.account_id, new.id, new.trade, 'code_permit_scope', 'documentation', 'Confirm code, permit, material, and approved-scope requirements', 50),
      (new.account_id, new.id, new.trade, 'pressure_leak_test', 'closeout', 'Restore service and complete pressure, drainage, and leak testing', 60),
      (new.account_id, new.id, new.trade, 'plumbing_cleanup_handoff', 'closeout', 'Clean the work area and explain shutoffs, operation, and warranty', 70);
  elsif new.trade = 'electrical' then
    insert into public.job_checklist_items (account_id, job_id, trade, code, category, label, sort_order) values
      (new.account_id, new.id, new.trade, 'immediate_electrical_hazard', 'safety', 'Check for shock, arcing, fire, water-contact, and energized-part hazards', 10),
      (new.account_id, new.id, new.trade, 'disconnect_verification', 'safety', 'Identify disconnects and verify de-energization before work', 20),
      (new.account_id, new.id, new.trade, 'lockout_ppe', 'safety', 'Apply required lockout/tagout, PPE, and approach boundaries', 30),
      (new.account_id, new.id, new.trade, 'electrical_diagnostics', 'diagnosis', 'Record panel, circuit, load, voltage, and fault diagnostics', 40),
      (new.account_id, new.id, new.trade, 'electrical_code_scope', 'documentation', 'Confirm code, permit, labeling, and approved-scope requirements', 50),
      (new.account_id, new.id, new.trade, 'energization_testing', 'closeout', 'Re-energize safely and complete functional and protection testing', 60),
      (new.account_id, new.id, new.trade, 'electrical_handoff', 'closeout', 'Label changes and explain operation and remaining safety concerns', 70);
  else
    insert into public.job_checklist_items (account_id, job_id, trade, code, category, label, sort_order) values
      (new.account_id, new.id, new.trade, 'site_hazards', 'safety', 'Identify site hazards and required controls before work', 10),
      (new.account_id, new.id, new.trade, 'document_existing_conditions', 'documentation', 'Document existing conditions and approved scope', 20),
      (new.account_id, new.id, new.trade, 'protect_work_area', 'production', 'Protect the work area before service or installation', 30),
      (new.account_id, new.id, new.trade, 'functional_test', 'closeout', 'Complete required functional and quality testing', 40),
      (new.account_id, new.id, new.trade, 'customer_handoff', 'closeout', 'Clean the site and complete customer handoff', 50);
  end if;
  return new;
end;
$$;

create trigger jobs_seed_trade_checklist
after insert on public.jobs
for each row execute function public.seed_bontraco_job_checklist();

insert into public.job_checklist_items (account_id, job_id, trade, code, category, label, sort_order)
select existing_job.account_id, existing_job.id, template.trade, template.code, template.category, template.label, template.sort_order
from public.jobs existing_job
join (values
  ('roofing'::public.bontraco_trade, 'site_weather_hazards', 'safety', 'Confirm weather, roof access, and site hazards before climbing', 10),
  ('roofing'::public.bontraco_trade, 'fall_protection', 'safety', 'Set ladder, fall-protection, and ground-control plan', 20),
  ('roofing'::public.bontraco_trade, 'interior_leak_check', 'diagnosis', 'Inspect and document interior leak or moisture locations', 30),
  ('roofing'::public.bontraco_trade, 'roof_measurements_photos', 'documentation', 'Capture measurements and required slope, flashing, and damage photos', 40),
  ('roofing'::public.bontraco_trade, 'materials_permit_scope', 'production', 'Confirm material, ventilation, permit, and scope requirements', 50),
  ('roofing'::public.bontraco_trade, 'final_roof_inspection', 'closeout', 'Complete final roof and flashing inspection', 60),
  ('roofing'::public.bontraco_trade, 'magnet_cleanup', 'closeout', 'Complete ground sweep, magnet cleanup, and customer handoff', 70),
  ('plumbing'::public.bontraco_trade, 'shutoff_location', 'safety', 'Locate and verify the appropriate water or gas shutoff', 10),
  ('plumbing'::public.bontraco_trade, 'active_hazards', 'safety', 'Check active leak, contamination, electrical, gas, and scald hazards', 20),
  ('plumbing'::public.bontraco_trade, 'diagnostic_readings', 'diagnosis', 'Record pressure, temperature, drainage, or equipment diagnostics', 30),
  ('plumbing'::public.bontraco_trade, 'protect_work_area', 'production', 'Protect the work area and control water before service', 40),
  ('plumbing'::public.bontraco_trade, 'code_permit_scope', 'documentation', 'Confirm code, permit, material, and approved-scope requirements', 50),
  ('plumbing'::public.bontraco_trade, 'pressure_leak_test', 'closeout', 'Restore service and complete pressure, drainage, and leak testing', 60),
  ('plumbing'::public.bontraco_trade, 'plumbing_cleanup_handoff', 'closeout', 'Clean the work area and explain shutoffs, operation, and warranty', 70),
  ('electrical'::public.bontraco_trade, 'immediate_electrical_hazard', 'safety', 'Check for shock, arcing, fire, water-contact, and energized-part hazards', 10),
  ('electrical'::public.bontraco_trade, 'disconnect_verification', 'safety', 'Identify disconnects and verify de-energization before work', 20),
  ('electrical'::public.bontraco_trade, 'lockout_ppe', 'safety', 'Apply required lockout/tagout, PPE, and approach boundaries', 30),
  ('electrical'::public.bontraco_trade, 'electrical_diagnostics', 'diagnosis', 'Record panel, circuit, load, voltage, and fault diagnostics', 40),
  ('electrical'::public.bontraco_trade, 'electrical_code_scope', 'documentation', 'Confirm code, permit, labeling, and approved-scope requirements', 50),
  ('electrical'::public.bontraco_trade, 'energization_testing', 'closeout', 'Re-energize safely and complete functional and protection testing', 60),
  ('electrical'::public.bontraco_trade, 'electrical_handoff', 'closeout', 'Label changes and explain operation and remaining safety concerns', 70),
  ('general'::public.bontraco_trade, 'site_hazards', 'safety', 'Identify site hazards and required controls before work', 10),
  ('general'::public.bontraco_trade, 'document_existing_conditions', 'documentation', 'Document existing conditions and approved scope', 20),
  ('general'::public.bontraco_trade, 'protect_work_area', 'production', 'Protect the work area before service or installation', 30),
  ('general'::public.bontraco_trade, 'functional_test', 'closeout', 'Complete required functional and quality testing', 40),
  ('general'::public.bontraco_trade, 'customer_handoff', 'closeout', 'Clean the site and complete customer handoff', 50)
) as template(trade, code, category, label, sort_order)
  on template.trade = existing_job.trade
on conflict (account_id, job_id, code) do nothing;

alter table public.job_checklist_items enable row level security;

create policy job_checklist_items_select_visible
on public.job_checklist_items for select to authenticated
using (public.can_access_bontraco_entity(account_id, null, null, job_id));

create policy job_checklist_items_update_visible
on public.job_checklist_items for update to authenticated
using (public.can_access_bontraco_entity(account_id, null, null, job_id))
with check (
  public.can_access_bontraco_entity(account_id, null, null, job_id)
  and (
    (completed_at is null and completed_by is null)
    or (completed_at is not null and completed_by = (select auth.uid()))
  )
);

grant select, update on public.job_checklist_items to authenticated;
revoke all on public.job_checklist_items from anon;

create or replace function public.audit_bontraco_checklist_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.completed_at is null and new.completed_at is not null then
    insert into public.activities (account_id, actor_id, job_id, kind, summary, metadata)
    values (
      new.account_id,
      new.completed_by,
      new.job_id,
      'job_checklist_completed',
      'Checklist completed: ' || new.label,
      jsonb_build_object('checklist_item_id', new.id, 'code', new.code, 'category', new.category)
    );
  end if;
  return new;
end;
$$;

create trigger job_checklist_items_audit_completion
after update on public.job_checklist_items
for each row execute function public.audit_bontraco_checklist_completion();

revoke all on function public.seed_bontraco_job_checklist() from public;
revoke all on function public.audit_bontraco_checklist_completion() from public;
