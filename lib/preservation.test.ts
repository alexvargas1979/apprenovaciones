import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {preserveProperties,preservationSummary} from './preservation';
import {catalog,fresh,totals} from './model';

// Real SQLite, including transactions and foreign keys; only the D1 transport is adapted.
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
for(const file of ['0000_mute_galactus.sql','0001_wise_steel_serpent.sql','0002_busy_kang.sql']){
  sql.exec(readFileSync('drizzle/'+file,'utf8').replaceAll('--> statement-breakpoint',''));
}
function prepare(query:string){let args:any[]=[];return {
  bind(...values:any[]){args=values;return this;},
  async all(){return {results:sql.prepare(query).all(...args)};},
  async first(){return sql.prepare(query).get(...args)??null;},
  async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}};},
};}
const db={prepare,async batch(statements:ReturnType<typeof prepare>[]){
  sql.exec('BEGIN');try{const results=[];for(const stmt of statements)results.push(await stmt.run());sql.exec('COMMIT');return results;}
  catch(e){sql.exec('ROLLBACK');throw e;}
}} as unknown as D1Database;
function seed(id:string,uid='owner-a'){
  const p=fresh();p.id=id;p.name='Prueba '+id;p.apn='0000123 A';p.county='Fulton';
  p.values['5']='123 Prueba';p.values['8']=1274;
  p.lines[catalog[0].id]={selected:true,qty:20,price:7,actual:100.25};
  p.lines[catalog[1].id]={selected:false,qty:0,price:0,actual:25.5};
  p.lines[catalog[2].id]={actual:0};p.lines[catalog[3].id]={actual:null};
  (p as any).attom={at:'2026-09-01T00:00:00.000Z',address:'original',fields:{'8':null,'12':0}};
  p.costs[0].amount=1200;
  const payload=JSON.stringify({...p,unrecognizedLegacyField:{keep:true}});
  sql.prepare('INSERT INTO properties VALUES(?,?,?,?)').run(id,uid,payload,'2026-09-01T00:00:00.000Z');
  return {p,payload,total:totals(p)};
}
const original=seed('legacy-01');seed('other-owner','owner-b');
const before=sql.prepare('SELECT * FROM properties ORDER BY id').all();
assert.deepEqual(await preserveProperties(db,'owner-a'),{processed:1,remaining:0});
assert.deepEqual(sql.prepare('SELECT * FROM properties ORDER BY id').all(),before);
const baseline=sql.prepare('SELECT * FROM property_baselines WHERE property_id=?').get('legacy-01')!;
assert.equal(baseline.original_payload,original.payload);
assert.equal(baseline.original_updated_at,'2026-09-01T00:00:00.000Z');
assert.deepEqual(totals(JSON.parse(String(baseline.original_payload))),original.total);
const summary=await preservationSummary(db,'owner-a');
assert.equal(summary['legacy-01'].balanceCount,3);assert.equal(summary['legacy-01'].openingTotal,125.75);
assert.deepEqual(await preservationSummary(db,'owner-b'),{});
const snapshots=sql.prepare('SELECT * FROM property_baselines').all();
assert.deepEqual(await preserveProperties(db,'owner-a'),{processed:0,remaining:0});
assert.deepEqual(sql.prepare('SELECT * FROM property_baselines').all(),snapshots);

// New edits remain current; the initial copy and balances never change on retries.
const edited={...original.p,name:'Nombre posterior'};
sql.prepare('UPDATE properties SET payload=?,updated_at=? WHERE id=?').run(JSON.stringify(edited),'new-date','legacy-01');
await preserveProperties(db,'owner-a','legacy-01');
assert.equal(sql.prepare('SELECT original_payload FROM property_baselines').get()!.original_payload,original.payload);
assert.equal(JSON.parse(String(sql.prepare('SELECT payload FROM properties WHERE id=?').get('legacy-01')!.payload)).name,'Nombre posterior');

// Controlled restoration rehearsal on a disposable fixture, not user records.
sql.prepare(`UPDATE properties SET payload=(SELECT original_payload FROM property_baselines WHERE property_id=properties.id),
  updated_at=(SELECT original_updated_at FROM property_baselines WHERE property_id=properties.id)
  WHERE id=? AND user_id=? AND updated_at=?`).run('legacy-01','owner-a','new-date');
assert.deepEqual(sql.prepare('SELECT * FROM properties ORDER BY id').all(),before);

// Failure midway rolls back copy, opening balances and completion marker together.
seed('failure');sql.exec("CREATE TRIGGER fail_fixture BEFORE INSERT ON opening_balances WHEN NEW.property_id='failure' BEGIN SELECT RAISE(ABORT,'fixture failure'); END;");
await assert.rejects(preserveProperties(db,'owner-a','failure'));
assert.equal(sql.prepare("SELECT COUNT(*) n FROM property_baselines WHERE property_id='failure'").get()!.n,0);
assert.equal(sql.prepare("SELECT COUNT(*) n FROM investment_projects WHERE property_id='failure'").get()!.n,0);
sql.exec('DROP TRIGGER fail_fixture');await preserveProperties(db,'owner-a','failure');

// Bounded batches and resumability with multiple properties.
for(let i=0;i<23;i++)seed('batch-'+String(i).padStart(2,'0'));
assert.deepEqual(await preserveProperties(db,'owner-a'),{processed:20,remaining:3});
assert.deepEqual(await preserveProperties(db,'owner-a'),{processed:3,remaining:0});
assert.equal(sql.prepare("SELECT COUNT(*) n FROM investment_projects WHERE user_id='owner-a'").get()!.n,25);
assert.equal(sql.prepare("SELECT COUNT(*) n FROM opening_balances").get()!.n,75);

// Additive release rollback: the old application reads original properties unchanged.
assert.deepEqual(totals(JSON.parse(String(sql.prepare('SELECT payload FROM properties WHERE id=?').get('legacy-01')!.payload))),original.total);
console.log('HU-01 passed: exact preservation, budget reconciliation, null/zero/inactive balances, idempotence, per-user isolation, later edits, guarded restoration, atomic failure rollback, bounded resume, old-reader compatibility.');
sql.close();
