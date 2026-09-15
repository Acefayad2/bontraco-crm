-- Repeatable trade checklist generation and tenant/assignment isolation check. Fixtures roll back.

begin;

insert into auth.users (id, email, aud, role, created_at, updated_at) values
  ('16000000-0000-0000-0000-000000000001', 'checklist-owner@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('16000000-0000-0000-0000-000000000002', 'checklist-sales@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('16000000-0000-0000-0000-000000000003', 'checklist-outsider@example.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.accounts (id, name, slug, trades, created_by) values
  ('26000000-0000-0000-0000-000000000001', 'Checklist Test One', 'bontraco-checklist-test-one', array['roofing','plumbing','electrical']::public.bontraco_trade[], '16000000-0000-0000-0000-000000000001'),
  ('26000000-0000-0000-0000-000000000002', 'Checklist Test Two', 'bontraco-checklist-test-two', array['general']::public.bontraco_trade[], '16000000-0000-0000-0000-000000000003');

insert into public.memberships (account_id, user_id, role, display_name, email) values
  ('26000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000001', 'owner', 'Checklist Owner', 'checklist-owner@example.invalid'),
  ('26000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000002', 'sales', 'Checklist Sales', 'checklist-sales@example.invalid'),
  ('26000000-0000-0000-0000-000000000002', '16000000-0000-0000-0000-000000000003', 'owner', 'Checklist Outsider', 'checklist-outsider@example.invalid');

insert into public.contacts (id, account_id, assigned_to, first_name, created_by) values
  ('36000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000002', 'Assigned', '16000000-0000-0000-0000-000000000001'),
  ('36000000-0000-0000-0000-000000000002', '26000000-0000-0000-0000-000000000001', null, 'Unassigned', '16000000-0000-0000-0000-000000000001'),
  ('36000000-0000-0000-0000-000000000003', '26000000-0000-0000-0000-000000000002', null, 'Outside', '16000000-0000-0000-0000-000000000003');

insert into public.jobs (id, account_id, contact_id, assigned_to, title, trade, safety_intake, created_by) values
  ('46000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000002', 'Assigned roof job', 'roofing', '{"site_occupied":true,"active_leak":true,"stories":2}'::jsonb, '16000000-0000-0000-0000-000000000001'),
  ('46000000-0000-0000-0000-000000000002', '26000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000002', null, 'Unassigned plumbing job', 'plumbing', '{"water_shutoff_known":false,"sewage_backup":true}'::jsonb, '16000000-0000-0000-0000-000000000001'),
  ('46000000-0000-0000-0000-000000000003', '26000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000002', null, 'Unassigned electrical job', 'electrical', '{"power_isolated":true,"panel_location":"Basement"}'::jsonb, '16000000-0000-0000-0000-000000000001'),
  ('46000000-0000-0000-0000-000000000004', '26000000-0000-0000-0000-000000000002', '36000000-0000-0000-0000-000000000003', null, 'Outside general job', 'general', '{}'::jsonb, '16000000-0000-0000-0000-000000000003');

do $$
declare
  invalid_intake_denied boolean := false;
begin
  if (select count(*) from public.job_checklist_items where job_id = '46000000-0000-0000-0000-000000000001') <> 7 then
    raise exception 'Roofing checklist template was not generated';
  end if;
  if (select count(*) from public.job_checklist_items where job_id = '46000000-0000-0000-0000-000000000002') <> 7 then
    raise exception 'Plumbing checklist template was not generated';
  end if;
  if (select count(*) from public.job_checklist_items where job_id = '46000000-0000-0000-0000-000000000003') <> 7 then
    raise exception 'Electrical checklist template was not generated';
  end if;
  if (select count(*) from public.job_checklist_items where job_id = '46000000-0000-0000-0000-000000000004') <> 5 then
    raise exception 'General checklist template was not generated';
  end if;
  if (select safety_intake ->> 'active_leak' from public.jobs where id = '46000000-0000-0000-0000-000000000001') <> 'true' then
    raise exception 'Roofing safety intake was not stored';
  end if;
  begin
    update public.jobs
    set safety_intake = '{"gas_odor":true}'::jsonb
    where id = '46000000-0000-0000-0000-000000000003';
  exception when check_violation then
    invalid_intake_denied := true;
  end;
  if not invalid_intake_denied then
    raise exception 'Electrical job accepted a plumbing-only safety field';
  end if;
end
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000002', true);

do $$
declare
  assigned_item uuid;
  changed integer;
  spoof_denied boolean := false;
begin
  if (select count(*) from public.job_checklist_items where job_id = '46000000-0000-0000-0000-000000000001') <> 7 then
    raise exception 'Salesperson cannot read their assigned checklist';
  end if;
  if (select count(*) from public.job_checklist_items where job_id = '46000000-0000-0000-0000-000000000002') <> 0 then
    raise exception 'Salesperson can read an unassigned checklist';
  end if;
  if (select safety_intake ->> 'active_leak' from public.jobs where id = '46000000-0000-0000-0000-000000000001') <> 'true' then
    raise exception 'Salesperson cannot read assigned job safety intake';
  end if;

  select id into assigned_item from public.job_checklist_items
  where job_id = '46000000-0000-0000-0000-000000000001'
  order by sort_order limit 1;
  update public.job_checklist_items
  set completed_at = now(), completed_by = '16000000-0000-0000-0000-000000000002'
  where id = assigned_item;
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'Salesperson could not complete assigned checklist item'; end if;
  if not exists (
    select 1 from public.activities
    where job_id = '46000000-0000-0000-0000-000000000001'
      and kind = 'job_checklist_completed'
  ) then raise exception 'Checklist completion was not audited'; end if;

  update public.job_checklist_items
  set completed_at = now(), completed_by = '16000000-0000-0000-0000-000000000002'
  where job_id = '46000000-0000-0000-0000-000000000002';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Salesperson updated an unassigned checklist'; end if;

  begin
    update public.job_checklist_items
    set completed_by = '16000000-0000-0000-0000-000000000001'
    where id = assigned_item;
  exception when others then spoof_denied := true;
  end;
  if not spoof_denied then raise exception 'Salesperson spoofed checklist completion identity'; end if;
end
$$;

select set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000003', true);
do $$
begin
  if exists (
    select 1 from public.job_checklist_items
    where account_id = '26000000-0000-0000-0000-000000000001'
  ) then raise exception 'Outside tenant read checklist data'; end if;
end
$$;

reset role;
rollback;
select 'bontraco_trade_job_checklists_rls_passed' as result;
