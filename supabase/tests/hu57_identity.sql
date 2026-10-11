begin;
create function pg_temp.expect_error(statement text,expected text,label text) returns void language plpgsql as $$
begin
 begin execute statement;
 exception when others then if SQLSTATE=expected then raise notice 'PASS: %',label;return;end if;raise;end;
 raise exception 'FAIL: expected error for %',label;
end $$;
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end $$;
insert into auth.users(id,email_confirmed_at) values
('57000000-0000-4000-8000-000000000001',now()),('57000000-0000-4000-8000-000000000002',now()),('57000000-0000-4000-8000-000000000003',now()),('57000000-0000-4000-8000-000000000004',null);
insert into migration_private.identity_sources(source_id,snapshot_sha256,registered_by) values ('hu57-test',repeat('a',64),'reviewer-test');
insert into migration_private.identity_inventory values ('hu57-test','owner-a',array['owner'],2),('hu57-test','owner-b',array['owner'],1),('hu57-test','owner-c',array['owner'],1),('hu57-test','owner-d',array['owner'],1);
create function pg_temp.link(old_id text,new_id uuid,reviewed timestamptz default now(),expires timestamptz default now()+interval '1 hour') returns void language sql as $$
 insert into migration_private.identity_links(source_id,legacy_user_id,auth_user_id,legacy_proof_ref,target_proof_ref,review_sha256,reviewed_by,reviewed_at,proof_expires_at)
 values('hu57-test',old_id,new_id,'controlled-source-session-reference','verified-target-session-reference',repeat('b',64),'reviewer-test',reviewed,expires);
$$;
select pg_temp.link('owner-a','57000000-0000-4000-8000-000000000001');
select pg_temp.link('owner-b','57000000-0000-4000-8000-000000000002');
select pg_temp.assert_true((select count(*)=2 from migration_private.identity_links where source_id='hu57-test'),'two owners remain distinct');
select pg_temp.assert_true(not exists(select 1 from migration_private.identity_links where auth_user_id='57000000-0000-4000-8000-000000000003'),'unlinked account receives no match');
select pg_temp.expect_error($q$select pg_temp.link('owner-a','57000000-0000-4000-8000-000000000003')$q$,'23505','legacy identity cannot be claimed twice');
select pg_temp.expect_error($q$select pg_temp.link('owner-c','57000000-0000-4000-8000-000000000001')$q$,'23505','two owners cannot merge into one account');
select pg_temp.expect_error($q$select pg_temp.link('unknown','57000000-0000-4000-8000-000000000003')$q$,'23503','unknown source identity rejected');
select pg_temp.expect_error($q$select pg_temp.link('owner-d','57000000-0000-4000-8000-000000000004')$q$,'23514','unconfirmed target rejected');
select pg_temp.expect_error($q$select pg_temp.link('owner-c','57000000-0000-4000-8000-000000000003',now()-interval '2 hours',now()-interval '1 hour')$q$,'23514','expired verification rejected');
select pg_temp.expect_error($q$update migration_private.identity_links set auth_user_id='57000000-0000-4000-8000-000000000003' where legacy_user_id='owner-a'$q$,'23514','reassignment rejected');
select pg_temp.expect_error($q$update migration_private.identity_links set status='revoked' where legacy_user_id='owner-a'$q$,'23514','revocation requires administrator and reason');
update migration_private.identity_links set status='revoked',revoked_by='reviewer-test',revocation_reason='synthetic withdrawal' where source_id='hu57-test' and legacy_user_id='owner-a';
select pg_temp.assert_true((select count(*)=3 from migration_private.identity_link_events where source_id='hu57-test'),'verification and revocation audited');
select pg_temp.expect_error($q$update migration_private.identity_links set status='verified',revoked_at=null,revoked_by=null,revocation_reason=null where legacy_user_id='owner-a'$q$,'23514','revoked link cannot reactivate');
select pg_temp.expect_error($q$delete from migration_private.identity_links where legacy_user_id='owner-a'$q$,'23514','link history cannot be erased');
select pg_temp.expect_error($q$delete from migration_private.identity_link_events where source_id='hu57-test'$q$,'23514','audit append-only');
select pg_temp.expect_error($q$update migration_private.identity_sources set snapshot_sha256=repeat('c',64) where source_id='hu57-test'$q$,'23514','verified snapshot cannot be replaced');
select pg_temp.assert_true((select count(*)=4 and bool_and(relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='migration_private' and c.relkind='r'),'all identity tables have RLS');
set local role anon;
select pg_temp.expect_error($q$select * from migration_private.identity_links$q$,'42501','anonymous cannot inspect identities');
reset role;
set local role authenticated;
select pg_temp.expect_error($q$insert into migration_private.identity_links(source_id,legacy_user_id,auth_user_id) values('hu57-test','owner-b','57000000-0000-4000-8000-000000000001')$q$,'42501','signed-in user cannot claim another owner');
reset role;
set local role service_role;
select pg_temp.expect_error($q$select * from migration_private.identity_links$q$,'42501','service API cannot read private mapping');
reset role;
rollback;
