"""Rehearse HU-55 against local Supabase and an isolated disposable database."""
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
    if len(migrations)!=1 or not migrations[0].name.endswith('_hu55_business_schema.sql'):
        raise RuntimeError('Review this HU-55 initial-schema test before replaying later migrations')
    tests=(ROOT/'supabase/tests/hu55_schema.sql').read_text()
    temporary='hu55_replay_'+uuid.uuid4().hex
    created=False
    try:
        _, messages=sql('postgres',tests)
        live_passes=messages.count('PASS:')
        sql('postgres',f'create database {temporary};')
        created=True
        # Minimal Auth FK target in disposable DB; real Auth runs in the local test above.
        sql(temporary,'create schema auth; create table auth.users(id uuid primary key);')
        sql(temporary,'begin;\n'+migrations[0].read_text()+'\ncommit;')
        _, messages=sql(temporary,tests)
        replay_passes=messages.count('PASS:')
        if live_passes!=15 or replay_passes!=15:
            raise RuntimeError('Unexpected assertion count')
        count,_=sql(temporary,"select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")
        print(json.dumps({'local_assertions':live_passes,'fresh_database_assertions':replay_passes,'recreated_tables':int(count),'production_modified':False}))
    finally:
        if created:
            sql('postgres',f'drop database {temporary};')

if __name__=='__main__':
    run()
