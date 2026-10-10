-- Synthetic, transactional tests: no real records and no persistent users.
begin;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
create function pg_temp.expect_error(statement text, expected text, label text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if SQLSTATE=expected then raise notice 'PASS: %',label; return; end if;
    raise;
  end;
  raise exception 'FAIL: expected error for %',label;
end $$;
select pg_temp.assert_true((select count(*)=20 and bool_and(relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),'20 tables with RLS');
select pg_temp.assert_true(not exists(select 1 from information_schema.tables t cross join (values ('anon'),('authenticated'),('service_role')) r(role) where t.table_schema='public' and has_table_privilege(r.role, 'public.'||t.table_name, 'SELECT,INSERT,UPDATE,DELETE')),'API roles have no table grants');
insert into auth.users(id) values ('55550000-0000-4000-8000-000000000001'),('55550000-0000-4000-8000-000000000002');
insert into public.properties values
('hu55-p1','55550000-0000-4000-8000-000000000001','{}','2026-10-10T12:00:00-04:00'),
('hu55-p2','55550000-0000-4000-8000-000000000001','{}','2026-10-10T16:00:00Z'),
('hu55-p3','55550000-0000-4000-8000-000000000002','{}','2026-10-10T16:00:00Z');
select pg_temp.assert_true((select count(distinct updated_at)=1 from public.properties where id like 'hu55-%'),'timezone instants equivalent');
insert into public.expense_invoices(user_id,id,position,request_id,payload) values ('55550000-0000-4000-8000-000000000001','hu55-invoice',0,'hu55-request','{"declaredTotal":0.30}');
insert into public.expense_lines(user_id,id,invoice_id,property_id,position,payload) values
('55550000-0000-4000-8000-000000000001','hu55-l1','hu55-invoice','hu55-p1',0,'{"subtotal":0.10,"tax":0,"retention":0,"included":0}'),
('55550000-0000-4000-8000-000000000001','hu55-l2','hu55-invoice','hu55-p2',1,'{"subtotal":0.20,"tax":0,"retention":0,"included":0}');
select pg_temp.assert_true((select sum(subtotal)=0.30 and count(distinct property_id)=2 from public.expense_lines where invoice_id='hu55-invoice'),'multiproperty invoice and exact decimal sum');
select pg_temp.expect_error($q$update public.expense_lines set property_id='hu55-p3' where id='hu55-l1'$q$,'23503','cross-owner property rejected');
select pg_temp.expect_error($q$update public.expense_lines set invoice_id='missing' where id='hu55-l1'$q$,'23503','orphan invoice rejected');
select pg_temp.expect_error($q$update public.expense_lines set payload='{"subtotal":0.001,"tax":0,"retention":0,"included":0}' where id='hu55-l1'$q$,'23514','excess decimal precision rejected without rounding');
select pg_temp.expect_error($q$update public.expense_lines set payload='{"subtotal":-1,"tax":0,"retention":0,"included":0}' where id='hu55-l1'$q$,'23514','negative expense rejected');
select pg_temp.expect_error($q$update public.expense_lines set payload='{}' where id='hu55-l1'$q$,'23502','missing financial amount rejected');
select pg_temp.expect_error($q$insert into public.expense_invoices(user_id,id,position,request_id,payload) values ('55550000-0000-4000-8000-000000000001','hu55-duplicate',1,'hu55-request','{"declaredTotal":0}')$q$,'23505','duplicate request rejected');
select pg_temp.expect_error($q$update public.properties set payload='[]' where id='hu55-p1'$q$,'23514','non-object operational JSON rejected');
select pg_temp.expect_error($q$delete from public.properties where id='hu55-p1'$q$,'23503','financial parent deletion restricted');
insert into public.analysis_scenarios(id,property_id,user_id,label,payload,created_at) values ('hu55-s1','hu55-p1','55550000-0000-4000-8000-000000000001','test','{}',now());
select pg_temp.expect_error($q$insert into public.analysis_baselines values ('hu55-p2','55550000-0000-4000-8000-000000000001','hu55-s1',now())$q$,'23503','scenario from another property rejected');
insert into public.property_baselines values ('hu55-p1','55550000-0000-4000-8000-000000000001',E'{ "value" : 1.00 }\n','2026-10-10T12:00:00-04:00',now());
select pg_temp.assert_true((select original_payload=E'{ "value" : 1.00 }\n' from public.property_baselines where property_id='hu55-p1'),'original JSON formatting preserved');
insert into public.audit_events values ('hu55-a1','55550000-0000-4000-8000-000000000002','hu55-p3','test','{}',now());
delete from public.properties where id='hu55-p3';
select pg_temp.assert_true(exists(select 1 from public.audit_events where id='hu55-a1'),'audit survives property deletion');
rollback;
