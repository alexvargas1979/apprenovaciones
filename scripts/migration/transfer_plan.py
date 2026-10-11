"""HU-59: strict offline transfer plan; no remote credentials or production apply mode."""
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import hashlib
import json
from pathlib import Path
import re
import sqlite3

from audit_snapshot import audit
from identity_plan import inventory, reconcile, save_private, strict_json

ROOT = Path(__file__).resolve().parents[2]
SPECS = json.loads((ROOT/'docs/migration/hu55-column-mapping.json').read_text())
ORDER = 'properties property_baselines investment_projects opening_balances property_documents analysis_scenarios analysis_baselines accounting_books audit_events workbook_imports team_members team_contributions expense_invoices expense_lines expense_allocations expense_classification_history expense_legacy_backup expense_drafts expense_reports property_deletions'.split()
COLUMNS = {t: [c for c in SPECS if c['source_table']==t and '(generated)' not in c['postgres_type']] for t in ORDER}
PK = {}
for constraint in json.loads((ROOT/'docs/migration/hu55-constraints.json').read_text()):
    if constraint['definition'].startswith('PRIMARY KEY ('):
        PK[constraint['table_name']] = [c.strip(chr(34)) for c in constraint['definition'][13:-1].split(', ')]


def exact_json(raw):
    # Validate duplicate keys first; parse money as Decimal without a float round trip.
    strict_json(raw)
    return json.loads(raw, parse_float=Decimal, parse_int=Decimal)


def money(value):
    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
        raise ValueError('invalid_money')
    amount=Decimal(str(value))
    if not amount.is_finite() or amount<0 or amount>Decimal('1000000000') or amount.as_tuple().exponent < -2:
        raise ValueError('invalid_money_precision_or_range')
    return str(amount)


def timestamp(value):
    if not isinstance(value,str) or not re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)',value):
        raise ValueError('ambiguous_timestamp_or_revision_token')
    try:
        return datetime.fromisoformat(value.replace('Z','+00:00')).astimezone(timezone.utc).isoformat()
    except ValueError:
        raise ValueError('invalid_timestamp') from None


def build_plan(snapshot, manifest, source_id, links):
    source=inventory(snapshot,manifest,source_id)
    coverage=reconcile(source,links)
    if not coverage['identity_coverage_complete']:
        raise ValueError('identity_coverage_incomplete')
    raw=Path(snapshot).read_bytes()
    if hashlib.sha256(raw).hexdigest()!=source['snapshot_sha256']:
        raise ValueError('snapshot_changed')
    db=sqlite3.connect(':memory:');db.deserialize(raw);db.row_factory=sqlite3.Row
    try:
        observed=audit(db)
        if observed!=manifest['database'] or not observed['data_valid']:
            raise ValueError('audit_manifest_mismatch')
        actual={t['name'] for t in observed['tables']}
        baseline={r['property_id']:r['user_id'] for r in db.execute('select property_id,user_id from property_baselines')} if 'property_baselines' in actual else {}
        output={t:[] for t in ORDER};quarantine=[];counts={};totals=defaultdict(Decimal);seen=set()
        for table in ORDER:
            if table not in actual:
                counts[table]=0;continue
            wanted={c['source_column'] for c in COLUMNS[table] if c['source_column']!='(derivado)'}
            columns={r[1] for r in db.execute('pragma table_info("'+table+'")')}
            if columns!=wanted:
                quarantine.append({'table':table,'row':None,'code':'source_columns_mismatch'});continue
            for index,row in enumerate(db.execute('select * from "'+table+'"'),1):
                try:
                    transformed={}
                    for spec in COLUMNS[table]:
                        col=spec['target_column'];kind=spec['postgres_type']
                        value=baseline.get(row['property_id']) if spec['source_column']=='(derivado)' else row[spec['source_column']]
                        if value is None:
                            if not spec['nullable']:raise ValueError('required_value_missing')
                        elif kind=='uuid':
                            if value not in coverage['mapping']:raise ValueError('identity_mapping_missing')
                            value=coverage['mapping'][value]
                        elif kind=='timestamptz':value=timestamp(value)
                        elif kind=='jsonb':
                            parsed=exact_json(value)
                            if not isinstance(parsed,list if col=='object_keys' else dict):raise ValueError('invalid_json_shape')
                            # Generated financial columns must not silently round.
                            for generated in SPECS:
                                if generated['source_table']==table and '(generated)' in generated['postgres_type']:
                                    money(parsed.get(generated['source_column'].split('.')[1]))
                        elif kind=='numeric':value=money(value)
                        elif kind in ('integer','bigint'):
                            if type(value) is not int:raise ValueError('invalid_integer')
                        elif not isinstance(value,str):raise ValueError('invalid_text')
                        if isinstance(value,str) and '\x00' in value:raise ValueError('nul_character')
                        transformed[col]=value
                    # Never restore invitation secrets or activate a migrated grant automatically.
                    if table=='team_members':
                        grant=strict_json(transformed['payload'])
                        if grant.get('status')!='Revocado':grant['status']='Por aprobar'
                        transformed['payload']=json.dumps(grant,ensure_ascii=False,separators=(',',':'))
                        transformed['token_hash']='migration-disabled:'+hashlib.sha256((source['snapshot_sha256']+row['id']).encode()).hexdigest()
                    key=(table,tuple(transformed[k] for k in PK[table]))
                    if key in seen:raise ValueError('duplicate_primary_key')
                    seen.add(key);output[table].append(transformed)
                    if table=='expense_lines':
                        p=exact_json(transformed['payload']);group=(transformed['user_id'],transformed['property_id'])
                        totals[group]+=p['subtotal']+p['tax']
                except (ValueError,TypeError,KeyError,InvalidOperation,OverflowError):
                    # No payloads, names, tokens or SQL contents in logs/quarantine.
                    quarantine.append({'table':table,'row':index,'code':'invalid_row_requires_review'})
            counts[table]=len(output[table])
        per_owner={t:dict(Counter(r.get('user_id',r.get('owner_id')) for r in rows)) for t,rows in output.items()}
        return {'version':1,'source_id':source_id,'snapshot_sha256':source['snapshot_sha256'],
                'rows':output,'counts':counts,'counts_by_owner':per_owner,'quarantine':quarantine,
                'gross_line_totals':[{'user_id':u,'property_id':p,'amount':str(v)} for (u,p),v in sorted(totals.items())],
                'missing_source_tables':sorted(set(ORDER)-actual),'retired_tables_excluded':source['retired_tables_excluded'],
                'team_requires_reapproval':True,'ready_for_rehearsal':not quarantine,'production_ready':False}
    finally:db.close()


def literal(value):
    if value is None:return 'NULL'
    return "'"+str(value).replace("'","''")+"'"


def transfer_sql(plan, batch_size=250):
    """Atomic, repeatable import for the disposable rehearsal DB only.

    SQL is generated internally, never saved as a production migration. A conflict
    is acceptable only when every imported column already matches. Whole-table
    equality deliberately rejects extra target records in this empty-DB rehearsal.
    """
    if not plan['ready_for_rehearsal'] or plan['quarantine']:raise ValueError('quarantine_blocks_import')
    if type(batch_size) is not int or not 1<=batch_size<=1000:raise ValueError('invalid_batch_size')
    statements=["begin; set local standard_conforming_strings=on; set local timezone='UTC';",
                "do $$ begin if current_database() !~ '^hu59_rehearsal_[0-9a-f]{32}$' then raise exception 'Only a disposable HU59 rehearsal database is allowed';end if;end $$;"]
    for table in ORDER:
        columns=','.join('"'+c['target_column']+'"' for c in COLUMNS[table]);tmp='expected_'+table
        statements.append(f'create temp table {tmp} on commit drop as select {columns} from public.{table} with no data;')
        rows=plan['rows'][table]
        for offset in range(0,len(rows),batch_size):
            values=[]
            for row in rows[offset:offset+batch_size]:
                values.append('('+','.join(literal(row[c['target_column']])+'::'+c['postgres_type'] for c in COLUMNS[table])+')')
            statements.append(f'insert into {tmp} ({columns}) values '+','.join(values)+';')
        statements.append(f'insert into public.{table} ({columns}) select {columns} from {tmp} on conflict do nothing;')
        statements.append(f"do $$ begin if exists((select {columns} from {tmp} except all select {columns} from public.{table}) union all (select {columns} from public.{table} except all select {columns} from {tmp})) then raise exception 'Reconciliation mismatch: {table}'; end if; end $$;")
    statements.append('commit;')
    return '\n'.join(statements)


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for name in ('snapshot','manifest','source-id','links','output'):p.add_argument('--'+name,required=True)
    args=p.parse_args()
    try:
        plan=build_plan(args.snapshot,strict_json(Path(args.manifest).read_text()),args.source_id,strict_json(Path(args.links).read_text()))
        save_private(args.output,plan)
        print(json.dumps({'rows':sum(plan['counts'].values()),'quarantined':len(plan['quarantine']),'ready_for_rehearsal':plan['ready_for_rehearsal'],'production_ready':False}))
    except (ValueError,TypeError,KeyError,sqlite3.Error):
        raise SystemExit('Plan rejected: verify snapshot, manifest, schema and identity coverage. No data imported.')
