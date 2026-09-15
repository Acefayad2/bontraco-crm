-- Connected lead-to-paid-job acceptance across sales, field, manager, and outsider roles.
-- Fixtures always roll back.
begin;

insert into auth.users (id,email,aud,role,created_at,updated_at) values
('1f000000-0000-0000-0000-000000000001','workflow-owner@example.invalid','authenticated','authenticated',now(),now()),
('1f000000-0000-0000-0000-000000000002','workflow-sales@example.invalid','authenticated','authenticated',now(),now()),
('1f000000-0000-0000-0000-000000000003','workflow-field@example.invalid','authenticated','authenticated',now(),now()),
('1f000000-0000-0000-0000-000000000004','workflow-other-sales@example.invalid','authenticated','authenticated',now(),now()),
('1f000000-0000-0000-0000-000000000005','workflow-outsider@example.invalid','authenticated','authenticated',now(),now());

insert into public.accounts (id,name,slug,trades,created_by) values
('2f000000-0000-0000-0000-000000000001','Workflow Acceptance One','bontraco-workflow-acceptance-one',array['roofing']::public.bontraco_trade[],'1f000000-0000-0000-0000-000000000001'),
('2f000000-0000-0000-0000-000000000002','Workflow Acceptance Two','bontraco-workflow-acceptance-two',array['electrical']::public.bontraco_trade[],'1f000000-0000-0000-0000-000000000005');

insert into public.memberships (account_id,user_id,role,display_name,email) values
('2f000000-0000-0000-0000-000000000001','1f000000-0000-0000-0000-000000000001','owner','Workflow Owner','workflow-owner@example.invalid'),
('2f000000-0000-0000-0000-000000000001','1f000000-0000-0000-0000-000000000002','sales','Workflow Sales','workflow-sales@example.invalid'),
('2f000000-0000-0000-0000-000000000001','1f000000-0000-0000-0000-000000000003','field','Workflow Field','workflow-field@example.invalid'),
('2f000000-0000-0000-0000-000000000001','1f000000-0000-0000-0000-000000000004','sales','Workflow Other Sales','workflow-other-sales@example.invalid'),
('2f000000-0000-0000-0000-000000000002','1f000000-0000-0000-0000-000000000005','owner','Workflow Outsider','workflow-outsider@example.invalid');

set local role authenticated;
select set_config('request.jwt.claim.sub','1f000000-0000-0000-0000-000000000002',true);

insert into public.leads (
  id,account_id,assigned_to,title,trade,source,contact_name,contact_phone,
  location_text,dedup_key
) values (
  '3f000000-0000-0000-0000-000000000001',
  '2f000000-0000-0000-0000-000000000001',
  '1f000000-0000-0000-0000-000000000002',
  'Fresh storm-damage request',
  'roofing',
  'manual',
  'Workflow Customer',
  '(312) 555-0109',
  'Chicago, IL',
  'workflow-acceptance-lead'
);

select * from public.convert_bontraco_lead(
  '2f000000-0000-0000-0000-000000000001',
  '3f000000-0000-0000-0000-000000000001',
  'Workflow',
  'Customer',
  'Storm-damage roof replacement',
  15000
);

select public.create_bontraco_estimate(
  '2f000000-0000-0000-0000-000000000001',
  (select id from public.jobs where lead_id = '3f000000-0000-0000-0000-000000000001'),
  'EST-WORKFLOW-1',
  0.1,
  current_date + 30,
  'Thank you for choosing Bontraco.',
  'Payment is due after completion.',
  '[{"description":"Roof replacement","quantity":1,"unit":"job","unit_price":12000,"taxable":true},{"description":"Permit","quantity":1,"unit":"each","unit_price":300,"taxable":false}]'::jsonb
);

do $$ begin
  if not exists (
    select 1
    from public.leads l
    join public.contacts c on c.id = l.contact_id and c.account_id = l.account_id
    join public.jobs j on j.lead_id = l.id and j.contact_id = c.id and j.account_id = l.account_id
    where l.id = '3f000000-0000-0000-0000-000000000001'
      and l.status = 'won'
      and l.assigned_to = '1f000000-0000-0000-0000-000000000002'
      and c.assigned_to = l.assigned_to
      and j.assigned_to = l.assigned_to
  ) then raise exception 'Lead conversion did not preserve the assigned customer/job chain'; end if;

  if (select total from public.estimates where estimate_number = 'EST-WORKFLOW-1') <> 13500 then
    raise exception 'Connected estimate total is incorrect';
  end if;

end $$;

select set_config('request.jwt.claim.sub','1f000000-0000-0000-0000-000000000001',true);

insert into public.appointments (
  id,account_id,job_id,contact_id,assigned_to,title,starts_at,ends_at,created_by
) select
  '4f000000-0000-0000-0000-000000000002',
  j.account_id,
  j.id,
  j.contact_id,
  '1f000000-0000-0000-0000-000000000003',
  'Roof inspection',
  now() + interval '1 day',
  now() + interval '25 hours',
  '1f000000-0000-0000-0000-000000000001'
from public.jobs j
where j.lead_id = '3f000000-0000-0000-0000-000000000001';

update public.estimates
set status = 'accepted', accepted_at = now()
where estimate_number = 'EST-WORKFLOW-1';

select public.create_invoice_from_estimate(
  (select id from public.estimates where estimate_number = 'EST-WORKFLOW-1'),
  'INV-WORKFLOW-1',
  current_date + 14
);

select set_config('request.jwt.claim.sub','1f000000-0000-0000-0000-000000000002',true);
do $$
declare denied boolean := false;
begin
  begin
    insert into public.payments (account_id,invoice_id,amount,method,created_by)
    select account_id,id,100,'card','1f000000-0000-0000-0000-000000000002'
    from public.invoices
    where invoice_number = 'INV-WORKFLOW-1';
  exception when others then denied := true;
  end;
  if not denied then raise exception 'Sales role recorded a payment'; end if;
end $$;

select set_config('request.jwt.claim.sub','1f000000-0000-0000-0000-000000000001',true);

insert into public.payments (account_id,invoice_id,amount,method,status,created_by)
select
  account_id,
  id,
  total,
  'card',
  'succeeded',
  '1f000000-0000-0000-0000-000000000001'
from public.invoices
where invoice_number = 'INV-WORKFLOW-1';

do $$ begin
  if not exists (
    select 1 from public.invoices
    where invoice_number = 'INV-WORKFLOW-1'
      and total = 13500
      and amount_paid = 13500
      and balance_due = 0
      and status = 'paid'
  ) then raise exception 'Accepted estimate did not complete the paid invoice chain'; end if;
end $$;

select set_config('request.jwt.claim.sub','1f000000-0000-0000-0000-000000000003',true);

update public.appointments
set status = 'confirmed'
where id = '4f000000-0000-0000-0000-000000000002';

do $$ begin
  if not exists (
    select 1 from public.appointments
    where id = '4f000000-0000-0000-0000-000000000002' and status = 'confirmed'
  ) then raise exception 'Assigned field user could not confirm the appointment'; end if;
  if exists (select 1 from public.estimates) or exists (select 1 from public.invoices) then
    raise exception 'Field role could see commercial records';
  end if;
end $$;

select set_config('request.jwt.claim.sub','1f000000-0000-0000-0000-000000000004',true);
do $$ begin
  if exists (select 1 from public.leads)
    or exists (select 1 from public.contacts)
    or exists (select 1 from public.jobs)
    or exists (select 1 from public.appointments)
    or exists (select 1 from public.estimates)
    or exists (select 1 from public.invoices)
  then raise exception 'Unassigned sales role could see the connected workflow'; end if;
end $$;

select set_config('request.jwt.claim.sub','1f000000-0000-0000-0000-000000000005',true);
do $$ begin
  if exists (select 1 from public.leads where id = '3f000000-0000-0000-0000-000000000001')
    or exists (select 1 from public.appointments where id = '4f000000-0000-0000-0000-000000000002')
    or exists (select 1 from public.invoices where invoice_number = 'INV-WORKFLOW-1')
  then raise exception 'Outside tenant could see the connected workflow'; end if;
end $$;

reset role;
rollback;
select 'bontraco_core_workflow_acceptance_passed' as result;
