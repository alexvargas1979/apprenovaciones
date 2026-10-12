"""HU-59 import, retry, conflict and restore rehearsal in disposable local databases.

No remote URL, project ref or database destination can be supplied. Never imports
into the running application's postgres database. With no arguments uses synthetic
fixtures; real snapshots require the same strict offline identity/manifest inputs.
"""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
import tempfile
import time
import uuid

from identity_plan import save_private, strict_json
from transfer_plan import ROOT, ORDER, COLUMNS, build_plan, transfer_sql, literal
from test_transfer_plan import fixture

CONTAINER='supabase_db_apprenovaciones-local'


def command(args,data=None):
    r=subprocess.run(args,input=data,text=True,capture_output=True)
    if r.returncode:
        # PostgreSQL diagnostics may contain real payloads. Never echo them.
        raise RuntimeError('Local database command failed; no raw data logged.')
    return r.stdout


def sql(database,statement):
    return command(['docker','exec','-i',CONTAINER,'psql','-X','-q','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-At'],statement)


def run(plan):
    if not plan['ready_for_rehearsal']:raise ValueError('Quarantined rows must be resolved first')
    if 'project_id = "apprenovaciones-local"' not in (ROOT/'supabase/config.toml').read_text():raise ValueError('Unexpected local project')
    migrations=sorted((ROOT/'supabase/migrations').glob('*.sql'))
    if not migrations or any(not m.name.endswith(('_hu55_business_schema.sql','_hu57_identity_mapping.sql','_hu58_read_isolation.sql','_hu60_owner_read_snapshot.sql','_hu60_property_name_transaction.sql','_hu60_scenario_duplicate.sql','_hu60_scenario_save.sql','_hu60_scenario_approve.sql')) for m in migrations):raise ValueError('Review the rehearsal for new migrations')
    database='hu59_rehearsal_'+uuid.uuid4().hex;restored='hu59_rehearsal_'+uuid.uuid4().hex
    created=[];started=time.monotonic();report={'started_at':datetime.now(timezone.utc).isoformat(),'snapshot_sha256':plan['snapshot_sha256'],'source_id':plan['source_id'],'production_modified':False,'production_ready':False}
    try:
        sql('postgres',f'create database {database};');created.append(database)
        sql(database,"create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,deleted_at timestamptz,is_anonymous boolean,banned_until timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;")
        for migration in migrations:sql(database,'begin;\n'+migration.read_text()+'\ncommit;')
        identities={r[c['target_column']] for t in ORDER for r in plan['rows'][t] for c in COLUMNS[t] if c['postgres_type']=='uuid' and r[c['target_column']] is not None}
        if identities:sql(database,'insert into auth.users(id) values '+','.join('('+literal(i)+')' for i in sorted(identities))+';')
        statement=transfer_sql(plan)
        # An interrupted attempt must not leave even earlier parent rows behind.
        bad=statement.replace('commit;','select 1/0;\ncommit;')
        try:sql(database,bad)
        except RuntimeError:pass
        else:raise RuntimeError('Expected injected failure')
        count=sql(database,'select '+ '+'.join('(select count(*) from public.'+t+')' for t in ORDER))
        if int(count)!=0:raise RuntimeError('Atomic rollback failed')
        report['injected_failure_rolled_back']=True
        sql(database,statement);sql(database,statement)
        report['repeat_without_duplicates']=True
        # Exact row equality inside each run includes nested JSON and raw backups.
        report['tables_reconciled']=len(ORDER);report['rows']=sum(plan['counts'].values());report['counts_by_owner']=plan['counts_by_owner']
        actual=json.loads(sql(database,"select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select user_id::text,property_id,sum(subtotal+tax)::text amount from public.expense_lines group by user_id,property_id order by user_id,property_id)x;"))
        from decimal import Decimal
        expected={(x['user_id'],x['property_id']):Decimal(x['amount']) for x in plan['gross_line_totals']}
        if {(x['user_id'],x['property_id']):Decimal(x['amount']) for x in actual}!=expected:raise RuntimeError('Financial reconciliation mismatch')
        report['gross_line_totals_match']=True
        # Prove a changed payload is refused, never silently overwritten.
        if plan['rows']['properties']:
            row=plan['rows']['properties'][0]
            sql(database,"update public.properties set payload=jsonb_set(payload,'{hu59_conflict}','true') where id="+literal(row['id'])+';')
            try:sql(database,statement)
            except RuntimeError:pass
            else:raise RuntimeError('Conflict should reject import')
            sql(database,'update public.properties set payload='+literal(row['payload'])+'::jsonb where id='+literal(row['id'])+';')
            report['changed_target_rejected']=True
        dump=command(['docker','exec',CONTAINER,'pg_dump','-U','postgres','-d',database,'--no-owner'])
        sql('postgres',f'create database {restored};');created.append(restored)
        sql(restored,dump);sql(restored,statement)
        report['dump_restore_reconciled']=True
        report['elapsed_seconds']=round(time.monotonic()-started,3)
        return report
    finally:
        for name in reversed(created):sql('postgres',f'drop database {name};')


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for name in ('snapshot','manifest','source-id','links'):p.add_argument('--'+name)
    p.add_argument('--output',required=True,help='New report path under ignored migration-private/')
    args=p.parse_args();provided=[args.snapshot,args.manifest,args.source_id,args.links]
    if any(provided) and not all(provided):p.error('Supply all four source arguments, or none for synthetic data')
    try:
        with tempfile.TemporaryDirectory(prefix='hu59-synthetic-') as temp:
            if all(provided):
                plan=build_plan(args.snapshot,strict_json(Path(args.manifest).read_text()),args.source_id,strict_json(Path(args.links).read_text()))
            else:
                source=Path(temp)/'source.sqlite';manifest,links=fixture(source);plan=build_plan(source,manifest,'synthetic',links)
            report=run(plan);save_private(args.output,report)
            print(json.dumps({k:v for k,v in report.items() if k not in ('counts_by_owner','source_id','snapshot_sha256')}))
    except (RuntimeError,ValueError,subprocess.SubprocessError,OSError):
        raise SystemExit('Rehearsal did not complete. Check Docker/local Supabase, source validation and private output path. No production changes.')
