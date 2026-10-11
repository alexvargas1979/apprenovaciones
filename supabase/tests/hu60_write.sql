begin;
create function pg_temp.check_write(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end$$;
create function pg_temp.expect_write(statement text,code text,label text) returns void language plpgsql as $$begin begin execute statement;exception when others then if sqlstate=code then raise notice 'PASS: %',label;return;end if;raise;end;raise exception 'FAIL: %',label;end$$;
insert into auth.users(id) values ('60010000-0000-4000-8000-000000000001'),('60010000-0000-4000-8000-000000000002');
insert into public.properties values
 ('hu60-write-a','60010000-0000-4000-8000-000000000001','{"name":"Original","lines":{"1":{"actual":0.30}},"investment":{"purchase":100000}}','2026-10-11T00:00:00Z'),
 ('hu60-write-b','60010000-0000-4000-8000-000000000002','{"name":"Other"}','2026-10-11T00:00:00Z'),
 ('hu60-write-fail','60010000-0000-4000-8000-000000000001','{"name":"Before failure","lines":{}}','2026-10-11T00:00:00Z');
set local role authenticated;
select set_config('request.jwt.claim.sub','60010000-0000-4000-8000-000000000001',true);
select pg_temp.check_write(public.rename_owned_property('hu60-write-a','2026-10-11T00:00:00Z','New name','Correction','60010000-0000-4000-8000-000000000010')->>'name'='New name','transaction renames property');
select pg_temp.check_write((select count(*)=1 from public.audit_events where property_id='hu60-write-a'),'exactly one audit event');
select pg_temp.check_write((select payload->'investment'->>'purchase'='100000' and payload->'dataHistory'->0->>'actor'='60010000-0000-4000-8000-000000000001' from public.properties where id='hu60-write-a'),'actor assigned by database and financial fields preserved');
select pg_temp.check_write((select original_payload::jsonb->>'name'='Original' from public.property_baselines where property_id='hu60-write-a'),'baseline captured before edit');
select pg_temp.check_write((select amount=0.30 from public.opening_balances where property_id='hu60-write-a'),'opening amount preserved');
select pg_temp.check_write((public.rename_owned_property('hu60-write-a','2026-10-11T00:00:00Z','New name','Correction','60010000-0000-4000-8000-000000000010')->>'replayed')::boolean and (select count(*)=1 from public.audit_events where property_id='hu60-write-a'),'retry idempotent');
select pg_temp.expect_write($q$select public.rename_owned_property('hu60-write-a','2026-10-11T00:00:00Z','Different','Correction','60010000-0000-4000-8000-000000000010')$q$,'40001','same request changed payload denied');
select pg_temp.expect_write($q$select public.rename_owned_property('hu60-write-a','2026-10-11T00:00:00Z','Stale','Correction','60010000-0000-4000-8000-000000000011')$q$,'40001','stale version denied');
select pg_temp.expect_write($q$select public.rename_owned_property('hu60-write-b','2026-10-11T00:00:00Z','Other','Correction','60010000-0000-4000-8000-000000000012')$q$,'42501','other owner denied');
select pg_temp.expect_write($q$select public.rename_owned_property('hu60-write-a','2026-10-11T00:00:00Z','Invalid','','60010000-0000-4000-8000-000000000013')$q$,'22023','reason mandatory');
reset role;
create function pg_temp.fail_audit() returns trigger language plpgsql as $$begin if new.property_id='hu60-write-fail' then raise exception using errcode='P0001',message='Synthetic audit failure';end if;return new;end$$;
create trigger hu60_test_audit_failure before insert on public.audit_events for each row execute function pg_temp.fail_audit();
set local role authenticated;
select pg_temp.expect_write($q$select public.rename_owned_property('hu60-write-fail','2026-10-11T00:00:00Z','Should roll back','Failure test','60010000-0000-4000-8000-000000000014')$q$,'P0001','audit failure propagates');
select pg_temp.check_write((select payload->>'name'='Before failure' from public.properties where id='hu60-write-fail') and not exists(select 1 from public.property_baselines where property_id='hu60-write-fail') and not exists(select 1 from public.investment_projects where property_id='hu60-write-fail'),'entire write and preservation rolled back');
reset role;
select pg_temp.check_write(not has_function_privilege('anon','public.rename_owned_property(text,timestamptz,text,text,uuid)','execute') and not has_table_privilege('authenticated','public.properties','update'),'no anonymous RPC or direct table update');
rollback;
