import hashlib,json,pathlib,sqlite3,tempfile,unittest
from identity_plan import inventory,reconcile,save_private
from unittest.mock import patch

class IdentityPlanTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.file=pathlib.Path(self.temp.name)/'snapshot.sqlite'
        patcher=patch('identity_plan.PRIVATE_ROOT',pathlib.Path(self.temp.name)/'migration-private');patcher.start();self.addCleanup(patcher.stop)
        db=sqlite3.connect(self.file)
        db.executescript('create table properties(id text,user_id text,payload text); create table team_members(id text,owner_id text,member_id text,payload text); create table settings(secret text);')
        db.executemany('insert into properties values(?,?,?)',[('p1','owner-a','{"actor":"historical-author"}'),('p2','owner-b','{}')])
        db.executemany('insert into team_members values(?,?,?,?)',[('g1','owner-a','member-a','{"status":"Revocado","email":"same@example.invalid"}'),('g2','owner-b',None,'{"status":"Invitación","email":"same@example.invalid"}')])
        db.execute("insert into settings values('retired credential must never be exported')");db.commit();db.close()
        self.manifest={'sha256':hashlib.sha256(self.file.read_bytes()).hexdigest(),'database':{'data_valid':True,'tables':[{'name':n} for n in ['properties','team_members','settings']]}}
        self.inv=inventory(self.file,self.manifest,'source-test')
    def links(self):
        return [dict(source_id='source-test',snapshot_sha256=self.inv['snapshot_sha256'],legacy_user_id=i['legacy_user_id'],auth_user_id=f'57000000-0000-4000-8000-{n:012d}',status='verified') for n,i in enumerate(self.inv['identities'],1)]
    def test_missing_accounts_block_without_email_matching(self):
        report=reconcile(self.inv,[])
        self.assertEqual(report['required_identities'],4);self.assertFalse(report['identity_coverage_complete'])
        self.assertNotIn('same@example',json.dumps(self.inv));self.assertNotIn('retired credential',json.dumps(self.inv))
        self.assertIn('historical-author',[i['legacy_user_id'] for i in self.inv['identities']])
    def test_complete_coverage_never_grants_access(self):
        report=reconcile(self.inv,self.links());self.assertTrue(report['identity_coverage_complete']);self.assertFalse(report['production_ready'])
        self.assertEqual(report['team_actions'][0]['action'],'keep_revoked')
        self.assertEqual(report['team_actions'][1]['action'],'reissue_with_owner_approval_and_expiry')
        self.assertTrue(all(not x['grants_access'] for x in report['team_actions']))
    def test_duplicate_and_merged_links_rejected(self):
        links=self.links()
        with self.assertRaises(ValueError):reconcile(self.inv,links+[links[0]])
        links[1]['auth_user_id']=links[0]['auth_user_id']
        with self.assertRaises(ValueError):reconcile(self.inv,links)
    def test_wrong_source_snapshot_unknown_id_and_revocation(self):
        for field,value in [('source_id','other'),('snapshot_sha256','0'*64),('legacy_user_id','unknown')]:
            links=self.links();links[0][field]=value
            with self.assertRaises(ValueError):reconcile(self.inv,links)
        links=self.links();links[0]['status']='revoked';self.assertFalse(reconcile(self.inv,links)['identity_coverage_complete'])
    def test_modified_snapshot_rejected(self):
        self.file.write_bytes(self.file.read_bytes()+b'changed')
        with self.assertRaises(ValueError):inventory(self.file,self.manifest,'source-test')
    def test_duplicate_json_keys_and_active_unidentified_member_block(self):
        for payload in ['{"status":"Activo","status":"Revocado"}', '{"status":"Activo"}']:
            db=sqlite3.connect(self.file)
            db.execute('update team_members set payload=? where id=?',(payload,'g2'));db.commit();db.close()
            self.manifest['sha256']=hashlib.sha256(self.file.read_bytes()).hexdigest()
            with self.assertRaises(ValueError):inventory(self.file,self.manifest,'source-test')
    def test_private_output_and_no_overwrite(self):
        with self.assertRaises(ValueError):save_private(pathlib.Path(self.temp.name)/'public.json',self.inv)
        dest=pathlib.Path(self.temp.name)/'migration-private'/'identities.json';save_private(dest,self.inv)
        self.assertEqual(dest.stat().st_mode & 0o777,0o600)
        with self.assertRaises(FileExistsError):save_private(dest,self.inv)
if __name__=='__main__':unittest.main()
