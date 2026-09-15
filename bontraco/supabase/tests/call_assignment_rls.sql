-- Repeatable receptionist-call assignment checks. Fixtures always roll back.
begin;

insert into auth.users (id,email,aud,role,created_at,updated_at) values
('1b100000-0000-0000-0000-000000000001','call-route-owner@example.invalid','authenticated','authenticated',now(),now()),
('1b100000-0000-0000-0000-000000000002','call-route-dispatch@example.invalid','authenticated','authenticated',now(),now()),
('1b100000-0000-0000-0000-000000000003','call-route-sales@example.invalid','authenticated','authenticated',now(),now()),
('1b100000-0000-0000-0000-000000000004','call-route-other@example.invalid','authenticated','authenticated',now(),now()),
('1b100000-0000-0000-0000-000000000005','call-route-field@example.invalid','authenticated','authenticated',now(),now()),
('1b100000-0000-0000-0000-000000000006','call-route-outside@example.invalid','authenticated','authenticated',now(),now());

insert into public.accounts (id,name,slug,trades,created_by) values
('2b100000-0000-0000-0000-000000000001','Call Routing One','bontraco-call-routing-one',array['roofing']::public.bontraco_trade[],'1b100000-0000-0000-0000-000000000001'),
('2b100000-0000-0000-0000-000000000002','Call Routing Two','bontraco-call-routing-two',array['plumbing']::public.bontraco_trade[],'1b100000-0000-0000-0000-000000000006');

insert into public.memberships (account_id,user_id,role,display_name,email) values
('2b100000-0000-0000-0000-000000000001','1b100000-0000-0000-0000-000000000001','owner','Call Owner','call-route-owner@example.invalid'),
('2b100000-0000-0000-0000-000000000001','1b100000-0000-0000-0000-000000000002','dispatcher','Call Dispatcher','call-route-dispatch@example.invalid'),
('2b100000-0000-0000-0000-000000000001','1b100000-0000-0000-0000-000000000003','sales','Call Sales','call-route-sales@example.invalid'),
('2b100000-0000-0000-0000-000000000001','1b100000-0000-0000-0000-000000000004','sales','Other Sales','call-route-other@example.invalid'),
('2b100000-0000-0000-0000-000000000001','1b100000-0000-0000-0000-000000000005','field','Call Field','call-route-field@example.invalid'),
('2b100000-0000-0000-0000-000000000002','1b100000-0000-0000-0000-000000000006','owner','Call Outside','call-route-outside@example.invalid');

insert into public.calls (id,account_id,provider,provider_call_id,status,caller_name) values
('3b100000-0000-0000-0000-000000000001','2b100000-0000-0000-0000-000000000001','retell','call-route-one','completed','Route Customer');

set local role authenticated;
select set_config('request.jwt.claim.sub','1b100000-0000-0000-0000-000000000002',true);

update public.calls
set assigned_to = '1b100000-0000-0000-0000-000000000003'
where id = '3b100000-0000-0000-0000-000000000001';

do $$
declare rejected boolean := false;
begin
  if not exists (
    select 1 from public.calls
    where id = '3b100000-0000-0000-0000-000000000001'
      and assigned_to = '1b100000-0000-0000-0000-000000000003'
  ) then raise exception 'Dispatcher could not route the call'; end if;

  begin
    update public.calls
    set assigned_to = '1b100000-0000-0000-0000-000000000005'
    where id = '3b100000-0000-0000-0000-000000000001';
  exception when others then rejected := true;
  end;
  if not rejected and exists (
    select 1 from public.calls
    where id = '3b100000-0000-0000-0000-000000000001'
      and assigned_to = '1b100000-0000-0000-0000-000000000005'
  ) then raise exception 'Call was routed to a field-only teammate'; end if;

  rejected := false;
  begin
    update public.calls
    set assigned_to = '1b100000-0000-0000-0000-000000000006'
    where id = '3b100000-0000-0000-0000-000000000001';
  exception when others then rejected := true;
  end;
  if not rejected and exists (
    select 1 from public.calls
    where id = '3b100000-0000-0000-0000-000000000001'
      and assigned_to = '1b100000-0000-0000-0000-000000000006'
  ) then raise exception 'Call crossed the workspace assignment boundary'; end if;
end $$;

select set_config('request.jwt.claim.sub','1b100000-0000-0000-0000-000000000003',true);
do $$
declare rejected boolean := false;
begin
  if (select count(*) from public.calls) <> 1 then raise exception 'Assigned sales could not see the call'; end if;
  begin
    update public.calls
    set assigned_to = '1b100000-0000-0000-0000-000000000004'
    where id = '3b100000-0000-0000-0000-000000000001';
  exception when others then rejected := true;
  end;
  if not rejected and exists (
    select 1 from public.calls
    where id = '3b100000-0000-0000-0000-000000000001'
      and assigned_to = '1b100000-0000-0000-0000-000000000004'
  ) then raise exception 'Sales reassigned a call'; end if;
end $$;

select set_config('request.jwt.claim.sub','1b100000-0000-0000-0000-000000000004',true);
do $$ begin
  if exists (select 1 from public.calls) then raise exception 'Unassigned sales could see the call'; end if;
end $$;

select set_config('request.jwt.claim.sub','1b100000-0000-0000-0000-000000000005',true);
do $$ begin
  if exists (select 1 from public.calls) then raise exception 'Field role could see private calls'; end if;
end $$;

select set_config('request.jwt.claim.sub','1b100000-0000-0000-0000-000000000006',true);
do $$ begin
  if exists (select 1 from public.calls where id = '3b100000-0000-0000-0000-000000000001') then
    raise exception 'Outside tenant could see the call';
  end if;
end $$;

reset role;
rollback;
select 'bontraco_call_assignment_rls_passed' as result;
