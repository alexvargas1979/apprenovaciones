from contextlib import closing
import unittest
import tempfile
import sqlite3
import json
from pathlib import Path
from audit_snapshot import snapshot, audit, validate_pages

class AuditTests(unittest.TestCase):
    def test_snapshot_preserves_data_and_refuses_overwrite(self):
        with tempfile.TemporaryDirectory() as d:
            src, dst = Path(d)/'source.sqlite', Path(d)/'copy.sqlite'
            with closing(sqlite3.connect(src)) as db:
                db.execute('create table properties(id text primary key,payload text)')
                db.execute('insert into properties values (?,?)', ('p1', '{"amount":123.45}'))
                db.commit()
            result = snapshot(src, dst, 'local-rehearsal')
            self.assertTrue(result['database']['data_valid'])
            self.assertFalse(result['production_ready'])
            with closing(sqlite3.connect(dst)) as db:
                self.assertEqual(db.execute('select payload from properties').fetchone()[0], '{"amount":123.45}')
            with self.assertRaises(ValueError): snapshot(src,dst,'local-rehearsal')
    def test_invalid_json_and_orphan_fail(self):
        with closing(sqlite3.connect(':memory:')) as db:
            db.executescript('create table parent(id text primary key);create table child(id text references parent(id),payload text);insert into child values ("missing","broken");')
            result=audit(db)
            self.assertFalse(result['data_valid'])
            self.assertEqual(result['foreign_key_errors'],1)
    def test_complete_page_and_truncation(self):
        p={'table_name':'properties','offset':0,'rows':[],'has_more':False,'model_projection':{'truncated':False,'next_offset':None}}
        self.assertTrue(validate_pages([p],['properties']))
        p['model_projection']['truncated_values']=1
        with self.assertRaises(ValueError):validate_pages([p],['properties'])
    def test_missing_or_unfinished_pages_fail(self):
        with self.assertRaises(ValueError):validate_pages([],['properties'])
        p={'table_name':'properties','offset':0,'has_more':True,'model_projection':{'truncated':False,'next_offset':25}}
        with self.assertRaises(ValueError):validate_pages([p],['properties'])
        p['offset']=25
        with self.assertRaises(ValueError):validate_pages([p],['properties'])

if __name__=='__main__':unittest.main()
