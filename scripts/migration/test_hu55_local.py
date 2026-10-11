"""Replay the approved HU-55/HU-57/HU-58 migrations in a disposable local database."""
import json
import pathlib
import subprocess
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[2]
CONTAINER = 'supabase_db_apprenovaciones-local'

def command(args, data=None):
    result = subprocess.run(args, input=data, text=True, capture_output=True, check=True)
    return result.stdout, result.stderr

def sql(database, statement):
    return command(['docker','exec','-i',CONTAINER,'psql','-X','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-At'], statement)

def run():
    config=(ROOT/'supabase/config.toml').read_text()
    if 'project_id = "apprenovaciones-local"' not in config:
        raise RuntimeError('Only the reserved local project may be tested')
    migrations=sorted((ROOT/'supabase/migrations').glob('*.sql'))
    if not migrations or any(not m.name.endswith(('_hu55_business_schema.sql','_hu57_identity_mapping.sql','_hu58_read_isolation.sql','_hu60_owner_read_snapshot.sql','_hu60_property_name_transaction.sql','_hu60_scenario_duplicate.sql')) for m in migrations):
        raise RuntimeError('Review the local replay harness before adding later migrations')
    cases=[('hu55_schema.sql',15)]
    if any(m.name.endswith('_hu57_identity_mapping.sql') for m in migrations):
        cases.append(('hu57_identity.sql',18))
    if any(m.name.endswith('_hu58_read_isolation.sql') for m in migrations):
        cases.append(('hu58_access.sql',8))
    if any(m.name.endswith('_hu60_owner_read_snapshot.sql') for m in migrations):
        cases.append(('hu60_read.sql',4))
    if any(m.name.endswith('_hu60_property_name_transaction.sql') for m in migrations):
        cases.append(('hu60_write.sql',13))
    if any(m.name.endswith('_hu60_scenario_duplicate.sql') for m in migrations):
        cases.append(('hu60_scenarios.sql',13))
    tests='\n'.join((ROOT/'supabase/tests'/name).read_text() for name,_ in cases)
    expected=sum(count for _,count in cases)
    temporary='hu55_replay_'+uuid.uuid4().hex
    created=False
    try:
        _, messages=sql('postgres',tests)
        live_passes=messages.count('PASS:')
        sql('postgres',f'create database {temporary};')
        created=True
        # Minimal Auth FK target in disposable DB; real Auth runs in the local test above.
        sql(temporary,'create schema auth; create table auth.users(id uuid primary key,email_confirmed_at timestamptz,deleted_at timestamptz,is_anonymous boolean,banned_until timestamptz);')
        sql(temporary,"create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated;")
        for migration in migrations:
            sql(temporary,'begin;\n'+migration.read_text()+'\ncommit;')
        _, messages=sql(temporary,tests)
        replay_passes=messages.count('PASS:')
        if live_passes!=expected or replay_passes!=expected:
            raise RuntimeError('Unexpected assertion count')
        count,_=sql(temporary,"select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")
        print(json.dumps({'local_assertions':live_passes,'fresh_database_assertions':replay_passes,'recreated_tables':int(count),'production_modified':False}))
    finally:
        if created:
            sql('postgres',f'drop database {temporary};')

if __name__=='__main__':
    run()
