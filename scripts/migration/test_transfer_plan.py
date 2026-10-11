"""Synthetic HU-59 fixtures and offline regression tests; no personal data."""
from contextlib import closing
import hashlib
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

from audit_snapshot import audit
from transfer_plan import build_plan, transfer_sql, COLUMNS, ORDER, timestamp, money

OWNER='59000000-0000-4000-8000-000000000001'
MEMBER='59000000-0000-4000-8000-000000000002'
AT='2026-10-11T10:00:00-04:00'


def fixture(path):
    db=sqlite3.connect(path)
    for table in ORDER:
        columns=[c for c in COLUMNS[table] if c['source_column']!='(derivado)']
        db.execute('create table '+table+' ('+','.join('"'+c['source_column']+'" '+('integer' if c['postgres_type'] in ('integer','bigint') else 'real' if c['postgres_type']=='numeric' else 'text') for c in columns)+')')
        row={}
        for c in columns:
            col=c['source_column'];kind=c['postgres_type']
            row[col]=None if c['nullable'] else 1 if kind in ('integer','bigint') else .30 if kind=='numeric' else AT if kind=='timestamptz' else 'owner' if kind=='uuid' else '[]' if col=='object_keys' else '{}' if col in ('payload','original_payload') else table+'-'+col
        if 'id' in row:row['id']=table+'-1'
        if 'property_id' in row:row['property_id']='properties-1'
        if table=='property_deletions':row['id']='deleted-property'
        if table=='property_documents':row.update(sha256='a'*64,version=1,size=50)
        if table=='analysis_baselines':row['scenario_id']='analysis_scenarios-1'
        if table=='team_members':row.update(member_id='member',payload=json.dumps({'role':'Analista','status':'Activo','propertyIds':['properties-1'],'taskIds':[]}),token_hash='old-invitation-secret')
        if table=='team_contributions':row.update(grant_id='team_members-1',payload='{"actor":"member","message":"Historical note"}')
        if table=='expense_drafts':row['status']='Borrador'
        if table=='expense_invoices':row['payload']='{"declaredTotal":0.30,"number":"SYNTHETIC"}'
        if table=='expense_lines':row.update(invoice_id='expense_invoices-1',payload='{"subtotal":0.10,"tax":0.20,"retention":0,"included":0}')
        if table=='expense_allocations':row.update(line_id='expense_lines-1',payload='{"centerId":"kitchen","subtotal":0.10,"tax":0.20}')
        if table=='expense_classification_history':row['payload']='{"lineId":"expense_lines-1","value":{"splits":[{"centerId":"kitchen","subtotal":0.10,"tax":0.20}]}}'
        if table=='property_baselines':row['original_payload']='{ "amount": 0.30 }\n'
        if table=='accounting_books':row['payload']='{"invoiceStorage":1,"invoices":[],"movements":[{"amount":0.10,"actor":"owner"}],"suppliers":[{"name":"Synthetic"}]}'
        db.execute('insert into '+table+' ('+','.join('"'+k+'"' for k in row)+') values ('+','.join('?' for _ in row)+')',list(row.values()))
    db.execute('create table settings(secret text)');db.execute("insert into settings values('excluded-secret')")
    db.commit();db.close()
    return inputs(path)


def inputs(path):
    with closing(sqlite3.connect(path)) as db:manifest={'sha256':hashlib.sha256(Path(path).read_bytes()).hexdigest(),'database':audit(db)}
    links=[{'source_id':'synthetic','snapshot_sha256':manifest['sha256'],'legacy_user_id':old,'auth_user_id':new,'status':'verified'} for old,new in [('owner',OWNER),('member',MEMBER)]]
    return manifest,links


class TransferTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.path=Path(self.temp.name)/'source.sqlite';self.manifest,self.links=fixture(self.path)
    def plan(self):return build_plan(self.path,self.manifest,'synthetic',self.links)
    def mutate(self,sql,args=()):
        with closing(sqlite3.connect(self.path)) as db:
            db.execute(sql,args);db.commit()
        self.manifest,self.links=inputs(self.path)
    def test_all_twenty_tables_and_exact_payload(self):
        p=self.plan();self.assertTrue(p['ready_for_rehearsal']);self.assertEqual(sum(p['counts'].values()),20)
        self.assertEqual(p['rows']['property_baselines'][0]['original_payload'],'{ "amount": 0.30 }\n')
        self.assertEqual(p['rows']['opening_balances'][0]['user_id'],OWNER)
        self.assertEqual(p['gross_line_totals'][0]['amount'],'0.30');self.assertFalse(p['production_ready'])
    def test_grants_require_reapproval_and_old_tokens_removed(self):
        p=self.plan();g=p['rows']['team_members'][0];self.assertEqual(json.loads(g['payload'])['status'],'Por aprobar')
        self.assertNotIn('old-invitation-secret',json.dumps(p));self.assertNotIn('excluded-secret',json.dumps(p))
        self.assertIn('"actor":"member"',p['rows']['team_contributions'][0]['payload'])
    def test_revoked_grant_stays_revoked(self):
        self.mutate("update team_members set payload=json_set(payload,'$.status','Revocado')")
        self.assertEqual(json.loads(self.plan()['rows']['team_members'][0]['payload'])['status'],'Revocado')
    def test_missing_mapping_blocks(self):
        self.links.pop()
        with self.assertRaises(ValueError):self.plan()
    def test_snapshot_hash_mismatch_blocks(self):
        self.manifest['sha256']='0'*64
        with self.assertRaises(ValueError):self.plan()
    def test_forged_counts_rejected(self):
        self.manifest['database']['tables'][0]['rows']=999
        with self.assertRaises(ValueError):self.plan()
    def test_unknown_column_quarantined(self):
        self.mutate('alter table properties add column new_field text');p=self.plan()
        self.assertFalse(p['ready_for_rehearsal']);self.assertEqual(p['quarantine'][0]['code'],'source_columns_mismatch')
    def test_duplicate_key_quarantined(self):
        self.mutate('insert into properties select * from properties');p=self.plan()
        self.assertFalse(p['ready_for_rehearsal'])
        with self.assertRaises(ValueError):transfer_sql(p)
    def test_json_duplicate_keys_rejected(self):
        self.mutate('update properties set payload=?',('{"a":1,"a":2}',))
        with self.assertRaises(ValueError):self.plan()
    def test_money_precision_quarantined(self):
        self.mutate('update expense_lines set payload=?',('{"subtotal":0.001,"tax":0,"retention":0,"included":0}',))
        self.assertFalse(self.plan()['ready_for_rehearsal'])
    def test_timezone_required_and_revisions_not_truncated(self):
        for value in ['2026-10-11T10:00:00','2026-10-11T10:00:00Z-uuid','2026-10-11T10:00:00.1234567Z']:
            with self.assertRaises(ValueError):timestamp(value)
        self.assertEqual(timestamp(AT),'2026-10-11T14:00:00+00:00')
    def test_ambiguous_revision_quarantined(self):
        self.mutate('update team_members set updated_at=?',(AT+'-revision',));self.assertFalse(self.plan()['ready_for_rehearsal'])
    def test_numeric_contract(self):
        for value in [-1,True,.001,float('inf'),1000000001]:
            with self.assertRaises(ValueError):money(value)
    def test_sql_guard_atomic_and_no_overwrite(self):
        sql=transfer_sql(self.plan(),1);self.assertIn('hu59_rehearsal_',sql);self.assertTrue(sql.startswith('begin;'));self.assertTrue(sql.endswith('commit;'))
        self.assertEqual(sql.count('on conflict do nothing'),20);self.assertEqual(sql.count('Reconciliation mismatch:'),20)
        self.assertNotIn('do update',sql.lower());self.assertIn('except all',sql)
    def test_sql_text_escaping(self):
        self.mutate('update properties set payload=?',(json.dumps({'name':"House'; DROP TABLE properties; -- \\ backslash"}),))
        sql=transfer_sql(self.plan());self.assertIn("House''; DROP",sql);self.assertIn('standard_conforming_strings=on',sql)

if __name__=='__main__':unittest.main()
